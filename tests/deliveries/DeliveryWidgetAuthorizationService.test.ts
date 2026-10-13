import {
  DeliveryWidgetAuthorizationService,
  type DeliveryWidgetAuthorizationDependencies,
} from '@/services/deliveries/DeliveryWidgetAuthorizationService';
import type { DeliveryWidgetActionsNativeModule } from '@/services/deliveries/DeliveryWidgetActionsNative';

jest.mock('@/services/firebase/auth', () => ({
  getFirebaseAuth: () => ({ currentUser: null }),
}));

const NOW = 1_800_000_000_000;
const ENDPOINT = 'https://us-central1-venda-e-faturamento.cloudfunctions.net/deliveryWidgetActions';
const AUTHORIZATION_LIFETIME_MS = 24 * 60 * 60 * 1000;

function makeAuthorization(uid: string, sessionId = `session-${uid}`) {
  return {
    sessionId,
    uid,
    refreshCapability: `opaque-capability-${uid}-01234567890123456789`,
    expiresAt: NOW + AUTHORIZATION_LIFETIME_MS,
    absoluteExpiresAt: NOW + AUTHORIZATION_LIFETIME_MS,
  };
}

function response(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response;
}

function makeHarness(
  options: {
    uid?: string;
    metadata?: {
      uid: string;
      sessionId: string;
      sessionVersion: number;
      expiresAt: number;
      absoluteExpiresAt: number;
    } | null;
    request?: DeliveryWidgetAuthorizationDependencies['request'];
  } = {},
) {
  let metadata = options.metadata ?? null;
  let remoteOnline = true;
  let pendingRevocation = false;
  const stored: string[] = [];
  const native: DeliveryWidgetActionsNativeModule = {
    deliveryWidgetAuthorizationMetadata: () => metadata as never,
    prepareDeliveryWidgetAuthorizationSession: jest.fn((uid, sessionVersion) => {
      if (metadata && (metadata.uid !== uid || metadata.sessionVersion !== sessionVersion)) {
        metadata = null;
      }
      return true;
    }),
    storeDeliveryWidgetAuthorization: jest.fn(async (sessionId, uid, sessionVersion) => {
      metadata = {
        uid,
        sessionId,
        sessionVersion,
        expiresAt: NOW + AUTHORIZATION_LIFETIME_MS,
        absoluteExpiresAt: NOW + AUTHORIZATION_LIFETIME_MS,
      };
      stored.push(uid);
      return true;
    }),
    revokeDeliveryWidgetAuthorization: jest.fn(async () => {
      metadata = null;
      pendingRevocation = true;
      if (!remoteOnline) throw new Error('offline');
      pendingRevocation = false;
      return true;
    }),
    flushDeliveryWidgetRevocations: jest.fn(async () => {
      if (pendingRevocation && !remoteOnline) return false;
      pendingRevocation = false;
      return true;
    }),
    deliveryWidgetActionRevision: jest.fn(() => 0),
    pendingDeliveryWidgetActionReceipts: jest.fn(() => []),
    acknowledgeDeliveryWidgetActionReceipts: jest.fn(),
  };
  const request =
    options.request ?? jest.fn(async () => response(makeAuthorization(options.uid ?? 'uid-a')));
  const service = new DeliveryWidgetAuthorizationService({
    native,
    authUser: () => ({ uid: options.uid ?? 'uid-a', getIdToken: async () => 'firebase-id-token' }),
    endpoint: ENDPOINT,
    request,
    now: () => NOW,
  });

  return {
    service,
    native,
    request: jest.mocked(request),
    stored,
    setRemoteOnline: (online: boolean) => {
      remoteOnline = online;
    },
    hasPendingRevocation: () => pendingRevocation,
  };
}

describe('DeliveryWidgetAuthorizationService', () => {
  it('issues a UID-bound scoped capability with the Firebase ID token and reuses it', async () => {
    const issue = makeAuthorization('uid-a');
    const request = jest.fn(async () => response(issue));
    const harness = makeHarness({ uid: 'uid-a', request });

    await harness.service.activateSession('uid-a', 3);
    await harness.service.ensureCurrent('uid-a', 3);

    expect(harness.request).toHaveBeenCalledTimes(1);
    expect(harness.request.mock.calls[0]?.[0]).toBe(ENDPOINT);
    expect(harness.request.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer firebase-id-token' },
      body: JSON.stringify({ operation: 'issue' }),
    });
    expect(harness.request.mock.calls[0]?.[1]?.body).not.toContain('uid');
    expect(harness.native.prepareDeliveryWidgetAuthorizationSession).toHaveBeenCalledWith(
      'uid-a',
      3,
    );
    expect(
      jest.mocked(harness.native.prepareDeliveryWidgetAuthorizationSession).mock
        .invocationCallOrder[0],
    ).toBeLessThan(harness.request.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER);
    expect(harness.stored).toEqual(['uid-a']);
    expect(harness.native.storeDeliveryWidgetAuthorization).toHaveBeenCalledWith(
      issue.sessionId,
      'uid-a',
      3,
      issue.refreshCapability,
      issue.expiresAt,
      issue.absoluteExpiresAt,
    );
  });

  it('replaces persisted authorization when a fresh app runtime starts', async () => {
    const request = jest.fn(async () => response(makeAuthorization('uid-a', 'new-session')));
    const harness = makeHarness({
      uid: 'uid-a',
      metadata: {
        uid: 'uid-a',
        sessionId: 'persisted-session',
        sessionVersion: 3,
        expiresAt: NOW + AUTHORIZATION_LIFETIME_MS,
        absoluteExpiresAt: NOW + AUTHORIZATION_LIFETIME_MS,
      },
      request,
    });

    await harness.service.activateSession('uid-a', 3);

    expect(harness.request).toHaveBeenCalledTimes(1);
    expect(harness.native.storeDeliveryWidgetAuthorization).toHaveBeenCalledWith(
      'new-session',
      'uid-a',
      3,
      expect.any(String),
      NOW + AUTHORIZATION_LIFETIME_MS,
      NOW + AUTHORIZATION_LIFETIME_MS,
    );
  });

  it('revokes the previous account locally before issuing for a different UID', async () => {
    const request = jest.fn(async () => response(makeAuthorization('uid-b')));
    const harness = makeHarness({
      uid: 'uid-b',
      metadata: {
        uid: 'uid-a',
        sessionId: 'old-session',
        sessionVersion: 3,
        expiresAt: NOW + 100_000_000,
        absoluteExpiresAt: NOW + 100_000_000,
      },
      request,
    });

    await harness.service.activateSession('uid-b', 4);

    expect(harness.native.revokeDeliveryWidgetAuthorization).not.toHaveBeenCalled();
    expect(harness.native.prepareDeliveryWidgetAuthorizationSession).toHaveBeenCalledWith(
      'uid-b',
      4,
    );
    expect(harness.stored).toEqual(['uid-b']);
  });

  it('waits for queued server revocation before issuing authorization for the next account', async () => {
    const harness = makeHarness({
      uid: 'uid-b',
      metadata: {
        uid: 'uid-a',
        sessionId: 'old-session',
        sessionVersion: 3,
        expiresAt: NOW + 100_000_000,
        absoluteExpiresAt: NOW + 100_000_000,
      },
    });
    jest.mocked(harness.native.flushDeliveryWidgetRevocations).mockResolvedValueOnce(false);

    await harness.service.activateSession('uid-b', 4);

    expect(harness.request).not.toHaveBeenCalled();
    expect(harness.native.storeDeliveryWidgetAuthorization).not.toHaveBeenCalled();
  });

  it('reissues authorization within the renewal window and ignores another Firebase UID', async () => {
    const request = jest.fn(async () => response(makeAuthorization('uid-a')));
    const harness = makeHarness({
      uid: 'uid-a',
      metadata: {
        uid: 'uid-a',
        sessionId: 'near-expiry',
        sessionVersion: 5,
        expiresAt: NOW + 1_000,
        absoluteExpiresAt: NOW + 1_000,
      },
      request,
    });

    await harness.service.activateSession('uid-a', 5);
    await harness.service.ensureCurrent('uid-b', 6);

    expect(harness.native.revokeDeliveryWidgetAuthorization).not.toHaveBeenCalled();
    expect(harness.stored).toEqual(['uid-a']);
    expect(harness.request).toHaveBeenCalledTimes(1);
  });

  it('does not issue a capability when Firebase Auth and the application UID differ', async () => {
    const native = makeHarness({ uid: 'uid-a' }).native;
    const request = jest.fn(async () => response(makeAuthorization('uid-a')));
    const service = new DeliveryWidgetAuthorizationService({
      native,
      authUser: () => ({ uid: 'uid-from-another-account', getIdToken: async () => 'id-token' }),
      endpoint: ENDPOINT,
      request,
      now: () => NOW,
    });

    await service.activateSession('uid-a', 6);

    expect(request).not.toHaveBeenCalled();
    expect(native.storeDeliveryWidgetAuthorization).not.toHaveBeenCalled();
  });

  it('does not issue a capability when native session fencing cannot be stored', async () => {
    const harness = makeHarness();
    jest
      .mocked(harness.native.prepareDeliveryWidgetAuthorizationSession)
      .mockReturnValueOnce(false);

    await harness.service.activateSession('uid-a', 6);

    expect(harness.request).not.toHaveBeenCalled();
    expect(harness.native.storeDeliveryWidgetAuthorization).not.toHaveBeenCalled();
    expect(harness.native.revokeDeliveryWidgetAuthorization).toHaveBeenCalledTimes(1);
  });

  it('revokes an authorization issued after the app session has already changed', async () => {
    let resolveIssue: ((value: Response) => void) | undefined;
    let markIssueStarted: (() => void) | undefined;
    const issueStarted = new Promise<void>((resolve) => {
      markIssueStarted = resolve;
    });
    const request = jest.fn((_: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { operation: string };
      if (body.operation === 'issue' && !resolveIssue) {
        return new Promise<Response>((resolve) => {
          resolveIssue = resolve;
          markIssueStarted?.();
        });
      }
      return Promise.resolve(
        response(body.operation === 'revoke' ? { revoked: true } : makeAuthorization('uid-b')),
      );
    });
    let activeUid = 'uid-a';
    const harness = makeHarness({
      uid: 'uid-a',
      request: request as DeliveryWidgetAuthorizationDependencies['request'],
    });
    const userProvider = jest.fn(() => ({
      uid: activeUid,
      getIdToken: async () => 'firebase-id-token',
    }));
    const service = new DeliveryWidgetAuthorizationService({
      native: harness.native,
      authUser: userProvider,
      endpoint: ENDPOINT,
      request: request as DeliveryWidgetAuthorizationDependencies['request'],
      now: () => NOW,
    });

    const first = service.activateSession('uid-a', 1);
    await issueStarted;
    activeUid = 'uid-b';
    const second = service.activateSession('uid-b', 2);
    resolveIssue?.(response(makeAuthorization('uid-a')));
    await Promise.all([first, second]);

    expect(harness.stored).toEqual(['uid-b']);
    expect(request.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).operation)).toEqual([
      'issue',
      'revoke',
      'issue',
    ]);
  });

  it('removes local authority offline and retries queued revocation before issuing again', async () => {
    const harness = makeHarness({
      uid: 'uid-b',
      metadata: {
        uid: 'uid-a',
        sessionId: 'active-session',
        sessionVersion: 1,
        expiresAt: NOW + 50_000,
        absoluteExpiresAt: NOW + 50_000,
      },
    });
    harness.setRemoteOnline(false);

    await expect(harness.service.revokeBeforeLogout()).resolves.toBeUndefined();
    expect(harness.native.deliveryWidgetAuthorizationMetadata()).toBeNull();
    expect(harness.hasPendingRevocation()).toBe(true);

    const requestCountBeforeOfflineRetry = harness.request.mock.calls.length;
    await harness.service.activateSession('uid-b', 2);
    expect(harness.request).toHaveBeenCalledTimes(requestCountBeforeOfflineRetry);
    expect(harness.hasPendingRevocation()).toBe(true);

    harness.setRemoteOnline(true);
    await harness.service.ensureCurrent('uid-b', 2);

    expect(harness.native.revokeDeliveryWidgetAuthorization).toHaveBeenCalledTimes(1);
    expect(harness.hasPendingRevocation()).toBe(false);
    expect(harness.request).toHaveBeenCalledTimes(requestCountBeforeOfflineRetry + 1);
    expect(harness.stored).toEqual(['uid-b']);
  });

  it('cancels pending authorization on logout and does not block local revocation', async () => {
    let markIssueStarted: (() => void) | undefined;
    const issueStarted = new Promise<void>((resolve) => {
      markIssueStarted = resolve;
    });
    const request = jest.fn((_: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { operation: string };
      if (body.operation !== 'issue') return Promise.resolve(response({ revoked: true }));
      return new Promise<Response>((_, reject) => {
        const signal = init?.signal;
        markIssueStarted?.();
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
          once: true,
        });
      });
    });
    const harness = makeHarness({
      request: request as DeliveryWidgetAuthorizationDependencies['request'],
    });

    const issue = harness.service.activateSession('uid-a', 8);
    await issueStarted;
    const logout = harness.service.revokeBeforeLogout();
    await Promise.all([issue, logout]);

    expect(harness.request.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    expect((harness.request.mock.calls[0]?.[1]?.signal as AbortSignal).aborted).toBe(true);
    expect(harness.native.revokeDeliveryWidgetAuthorization).toHaveBeenCalledTimes(1);
    expect(harness.native.storeDeliveryWidgetAuthorization).not.toHaveBeenCalled();
  });

  it('does not store an authorization when the endpoint request fails', async () => {
    const harness = makeHarness({
      request: jest.fn(async () => {
        throw new Error('network unavailable');
      }),
    });

    await expect(harness.service.activateSession('uid-a', 7)).rejects.toThrow(
      'network unavailable',
    );
    expect(harness.stored).toEqual([]);
  });
});
