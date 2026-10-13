import Constants from 'expo-constants';
import type { User } from 'firebase/auth';

import { getFirebaseAuth } from '@/services/firebase/auth';

import {
  getDeliveryWidgetActionsNative,
  type DeliveryWidgetActionsNativeModule,
} from './DeliveryWidgetActionsNative';

const AUTHORIZATION_REISSUE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const AUTHORIZATION_REQUEST_TIMEOUT_MS = 12_000;

type IssuedAuthorization = {
  sessionId: string;
  uid: string;
  refreshCapability: string;
  expiresAt: number;
  absoluteExpiresAt: number;
};

export type DeliveryWidgetAuthorizationDependencies = {
  native?: DeliveryWidgetActionsNativeModule | null;
  authUser: () => Pick<User, 'uid' | 'getIdToken'> | null;
  endpoint: string | undefined;
  request: typeof fetch;
  now: () => number;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isIssuedAuthorization(
  value: unknown,
  expectedUid: string,
  now: number,
): value is IssuedAuthorization {
  if (!value || typeof value !== 'object') return false;
  const authorization = value as Partial<IssuedAuthorization>;
  return (
    typeof authorization.sessionId === 'string' &&
    authorization.sessionId.length > 0 &&
    authorization.uid === expectedUid &&
    typeof authorization.refreshCapability === 'string' &&
    /^[A-Za-z0-9_-]{32,256}$/.test(authorization.refreshCapability) &&
    isFiniteNumber(authorization.expiresAt) &&
    authorization.expiresAt > now &&
    isFiniteNumber(authorization.absoluteExpiresAt) &&
    authorization.absoluteExpiresAt >= authorization.expiresAt
  );
}

export class DeliveryWidgetAuthorizationService {
  private readonly native: DeliveryWidgetActionsNativeModule | null;
  private readonly authUser: DeliveryWidgetAuthorizationDependencies['authUser'];
  private readonly endpoint: string | undefined;
  private readonly request: typeof fetch;
  private readonly now: () => number;
  private activeSession: { uid: string; sessionVersion: number } | null = null;
  private preparedSession: { uid: string | null; sessionVersion: number } | null = null;
  private generation = 0;
  private queue: Promise<void> = Promise.resolve();
  private pendingIssueController: AbortController | null = null;

  public constructor(dependencies: DeliveryWidgetAuthorizationDependencies) {
    this.native = dependencies.native ?? null;
    this.authUser = dependencies.authUser;
    this.endpoint = dependencies.endpoint;
    this.request = dependencies.request;
    this.now = dependencies.now;
  }

  public activateSession(uid: string | null, sessionVersion: number): Promise<void> {
    const normalizedUid = uid?.trim() || null;
    const nextSession = normalizedUid ? { uid: normalizedUid, sessionVersion } : null;
    let prepared = true;
    const identityChanged =
      this.activeSession?.uid !== nextSession?.uid ||
      this.activeSession?.sessionVersion !== nextSession?.sessionVersion;
    const needsPreparation =
      identityChanged ||
      this.preparedSession?.uid !== normalizedUid ||
      this.preparedSession?.sessionVersion !== sessionVersion;
    if (identityChanged) {
      this.pendingIssueController?.abort();
      this.activeSession = nextSession;
      this.generation += 1;
    }
    if (needsPreparation && this.native) {
      try {
        prepared = this.native.prepareDeliveryWidgetAuthorizationSession(
          normalizedUid,
          sessionVersion,
        );
        this.preparedSession = prepared ? { uid: normalizedUid, sessionVersion } : null;
      } catch {
        prepared = false;
        this.preparedSession = null;
      }
    } else if (needsPreparation) {
      this.preparedSession = { uid: normalizedUid, sessionVersion };
    }
    const generation = this.generation;

    return this.enqueue(async () => {
      if (!prepared) {
        await this.revokeLocalAuthorization();
        return;
      }
      if (!nextSession) {
        await this.revokeLocalAuthorization();
        return;
      }
      await this.ensureAuthorization(nextSession.uid, nextSession.sessionVersion, generation);
    });
  }

  public ensureCurrent(uid: string, sessionVersion: number): Promise<void> {
    const normalizedUid = uid.trim();
    if (
      !normalizedUid ||
      this.activeSession?.uid !== normalizedUid ||
      this.activeSession.sessionVersion !== sessionVersion
    ) {
      return Promise.resolve();
    }
    const generation = this.generation;
    return this.enqueue(() => this.ensureAuthorization(normalizedUid, sessionVersion, generation));
  }

  /** Clears the local credential before Firebase signs out; server revocation is queued if offline. */
  public revokeBeforeLogout(): Promise<void> {
    this.activeSession = null;
    this.generation += 1;
    this.pendingIssueController?.abort();
    try {
      const prepared = this.native?.prepareDeliveryWidgetAuthorizationSession(
        null,
        this.generation,
      );
      this.preparedSession = prepared ? { uid: null, sessionVersion: this.generation } : null;
    } catch {
      this.preparedSession = null;
      // The queued revocation below still removes local authority.
    }
    return this.enqueue(() => this.revokeLocalAuthorization());
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const next = this.queue.then(operation, operation);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private isCurrent(uid: string, sessionVersion: number, generation: number): boolean {
    return (
      generation === this.generation &&
      this.activeSession?.uid === uid &&
      this.activeSession.sessionVersion === sessionVersion
    );
  }

  private async ensureAuthorization(
    uid: string,
    sessionVersion: number,
    generation: number,
  ): Promise<void> {
    const native = this.native;
    if (!native || !this.isCurrent(uid, sessionVersion, generation)) return;
    if (
      this.preparedSession?.uid !== uid ||
      this.preparedSession.sessionVersion !== sessionVersion
    ) {
      return;
    }

    try {
      const revocationsFlushed = await native.flushDeliveryWidgetRevocations().catch(() => false);
      if (!revocationsFlushed || !this.isCurrent(uid, sessionVersion, generation)) return;
      const metadata = native.deliveryWidgetAuthorizationMetadata();
      const reusable =
        metadata?.uid === uid &&
        metadata.sessionVersion === sessionVersion &&
        metadata.absoluteExpiresAt > this.now() + AUTHORIZATION_REISSUE_WINDOW_MS;
      if (reusable) return;

      if (!this.isCurrent(uid, sessionVersion, generation)) return;

      const user = this.authUser();
      if (!user || user.uid !== uid || !this.endpoint?.startsWith('https://')) return;
      const issueController = new AbortController();
      const timeout = setTimeout(() => issueController.abort(), AUTHORIZATION_REQUEST_TIMEOUT_MS);
      this.pendingIssueController = issueController;
      let value: unknown;
      try {
        const idToken = await this.getIdTokenOrAbort(user, issueController.signal);
        if (!this.isCurrent(uid, sessionVersion, generation)) return;
        value = await this.post('issue', idToken, {}, issueController.signal);
      } finally {
        clearTimeout(timeout);
        if (this.pendingIssueController === issueController) this.pendingIssueController = null;
      }
      if (!isIssuedAuthorization(value, uid, this.now())) {
        throw new Error('Invalid delivery widget authorization response.');
      }

      const authorization = value as IssuedAuthorization;
      if (!this.isCurrent(uid, sessionVersion, generation)) {
        await this.revokeIssuedAuthorization(authorization);
        return;
      }

      let stored: boolean;
      try {
        stored = await native.storeDeliveryWidgetAuthorization(
          authorization.sessionId,
          authorization.uid,
          sessionVersion,
          authorization.refreshCapability,
          authorization.expiresAt,
          authorization.absoluteExpiresAt,
        );
      } catch (error) {
        await this.revokeIssuedAuthorization(authorization);
        throw error;
      }
      if (!stored) await this.revokeIssuedAuthorization(authorization);
      if (!stored) throw new Error('Delivery widget authorization could not be stored.');

      if (!this.isCurrent(uid, sessionVersion, generation)) {
        await this.revokeLocalAuthorization();
      }
    } catch (error) {
      if (!this.isCurrent(uid, sessionVersion, generation)) return;
      throw error instanceof Error ? error : new Error('Delivery widget authorization failed.');
    }
  }

  private async revokeLocalAuthorization(): Promise<void> {
    if (!this.native) return;
    try {
      await this.native.revokeDeliveryWidgetAuthorization();
    } catch {
      // The native module removes local authority before attempting remote revocation.
    }
  }

  private async revokeIssuedAuthorization(authorization: IssuedAuthorization): Promise<void> {
    try {
      await this.post('revoke', authorization.refreshCapability, {
        sessionId: authorization.sessionId,
      });
    } catch {
      // The server authorization expires automatically if this best-effort revoke is offline.
    }
  }

  private async post(
    operation: 'issue' | 'revoke',
    bearer: string,
    fields: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    if (!this.endpoint?.startsWith('https://'))
      throw new Error('Delivery widget endpoint missing.');
    const response = await this.request(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ operation, ...fields }),
      ...(signal ? { signal } : {}),
    });
    let result: unknown;
    try {
      result = await response.json();
    } catch {
      throw new Error('Delivery widget service returned an invalid response.');
    }
    if (!response.ok) throw new Error('Delivery widget service rejected the request.');
    return result;
  }

  private getIdTokenOrAbort(
    user: Pick<User, 'uid' | 'getIdToken'>,
    signal: AbortSignal,
  ): Promise<string> {
    if (signal.aborted) return Promise.reject(new Error('Authorization request was cancelled.'));
    return new Promise((resolve, reject) => {
      const cleanup = () => signal.removeEventListener('abort', onAbort);
      const onAbort = () => {
        cleanup();
        reject(new Error('Authorization request was cancelled.'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
      void user.getIdToken().then(
        (token) => {
          cleanup();
          resolve(token);
        },
        (error: unknown) => {
          cleanup();
          reject(error);
        },
      );
    });
  }
}

const authorizationService = new DeliveryWidgetAuthorizationService({
  native: getDeliveryWidgetActionsNative(),
  authUser: () => {
    try {
      return getFirebaseAuth().currentUser;
    } catch {
      return null;
    }
  },
  endpoint: Constants.expoConfig?.extra?.deliveryWidgetActionsEndpoint,
  request: (...args) => fetch(...args),
  now: () => Date.now(),
});

export const deliveryWidgetAuthorizationService = authorizationService;
