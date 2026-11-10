import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { useCarSettings } from '@/hooks/useCarSettings';
import { useAuth } from '@/providers';
import { setActiveAuthSession } from '@/services/auth/ActiveAuthSession';
import {
  carSettingsStorage,
  EMPTY_CAR_SETTINGS,
  firestoreCarSettingsDataSource,
  type CarSettings,
  type FirestoreCarSettingsLoadResult,
} from '@/services/car';

jest.mock('@/config/featureFlags', () => ({ ENABLE_FIRESTORE_CAR_SETTINGS: true }));
jest.mock('@/providers', () => ({ useAuth: jest.fn() }));
jest.mock('@/services/car', () => ({
  carSettingsStorage: {
    acceptPatch: jest.fn(),
    acceptConfirmed: jest.fn(),
    beginRemoteRead: jest.fn(),
    getCached: jest.fn(),
    getConfirmed: jest.fn(),
    invalidate: jest.fn(),
    load: jest.fn(),
    recordDraft: jest.fn(),
    resolveAcknowledgedDrafts: jest.fn(),
    save: jest.fn(),
  },
  EMPTY_CAR_SETTINGS: { alcoholAutonomy: '5,6 Km/l', gasolineAutonomy: '7,4 Km/l' },
  firestoreCarSettingsDataSource: {
    load: jest.fn(),
    loadWithMetadata: jest.fn(),
    save: jest.fn(),
    saveFields: jest.fn(),
    watchForConfirmation: jest.fn(),
  },
}));

const mockUseAuth = jest.mocked(useAuth);
const mockGetCached = jest.mocked(carSettingsStorage.getCached);
const mockGetConfirmed = jest.mocked(carSettingsStorage.getConfirmed);
const mockBeginRemoteRead = jest.mocked(carSettingsStorage.beginRemoteRead);
const mockAcceptConfirmed = jest.mocked(carSettingsStorage.acceptConfirmed);
const mockAcceptPatch = jest.mocked(carSettingsStorage.acceptPatch);
const mockInvalidate = jest.mocked(carSettingsStorage.invalidate);
const mockLocalLoad = jest.mocked(carSettingsStorage.load);
const mockLocalSave = jest.mocked(carSettingsStorage.save);
const mockRecordDraft = jest.mocked(carSettingsStorage.recordDraft);
const mockResolveAcknowledgedDrafts = jest.mocked(carSettingsStorage.resolveAcknowledgedDrafts);
const mockRemoteLoad = jest.mocked(firestoreCarSettingsDataSource.loadWithMetadata);
const mockRemoteSave = jest.mocked(firestoreCarSettingsDataSource.saveFields);
const mockWatch = jest.mocked(firestoreCarSettingsDataSource.watchForConfirmation);
const accountASettings = {
  alcoholAutonomy: 'A-only alcohol value',
  gasolineAutonomy: 'A-only gasoline value',
};
type WriteResult =
  | { kind: 'patch'; changes: Partial<CarSettings> }
  | { kind: 'snapshot'; settings: CarSettings }
  | undefined;

function Harness({ onRender }: { onRender: (value: ReturnType<typeof useCarSettings>) => void }) {
  onRender(useCarSettings());
  return null;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function setTestAuth(user: { id: string } | null, sessionVersion: number): void {
  mockUseAuth.mockReturnValue({ user, sessionVersion } as never);
  setActiveAuthSession(user?.id ?? null, sessionVersion);
}

async function settle(): Promise<void> {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

describe('useCarSettings account and session isolation', () => {
  let current: ReturnType<typeof useCarSettings> | undefined;
  let renderer: ReactTestRenderer | undefined;

  async function renderSettings() {
    const element = createElement(Harness, { onRender: (value) => (current = value) });
    await act(async () => {
      if (renderer) renderer.update(element);
      else renderer = create(element);
      await settle();
    });
  }

  beforeEach(() => {
    current = undefined;
    renderer = undefined;
    setTestAuth({ id: 'account-a' }, 1);
    mockBeginRemoteRead.mockReturnValue(1);
    let cachedSettings: CarSettings | null = accountASettings;
    mockGetCached.mockImplementation((uid, sessionVersion) =>
      uid === 'account-a' && sessionVersion === 1 ? cachedSettings : null,
    );
    let confirmedSnapshot: { exists: boolean; settings: CarSettings } | null = null;
    mockGetConfirmed.mockReset().mockImplementation(() => confirmedSnapshot);
    mockLocalLoad.mockImplementation(async (uid) =>
      uid === 'account-a' ? accountASettings : { ...EMPTY_CAR_SETTINGS },
    );
    mockLocalSave.mockReset().mockResolvedValue(undefined);
    mockRecordDraft.mockReset();
    mockResolveAcknowledgedDrafts.mockReset().mockResolvedValue(undefined);
    mockInvalidate.mockReset().mockResolvedValue(undefined);
    const drafts = new Map<keyof CarSettings, { value: string; revision: number }>();
    let draftRevision = 0;
    mockAcceptConfirmed.mockReset().mockImplementation((_uid, _session, settings, options) => {
      for (const [field, value] of Object.entries(options?.acknowledgedDraftRevisions ?? {})) {
        if (
          (field === 'gasolineAutonomy' || field === 'alcoholAutonomy') &&
          drafts.get(field)?.revision === value
        ) {
          drafts.delete(field);
        }
      }
      confirmedSnapshot = {
        exists: settings !== undefined,
        settings: settings ?? { ...EMPTY_CAR_SETTINGS },
      };
      cachedSettings = {
        ...confirmedSnapshot.settings,
        ...Object.fromEntries([...drafts].map(([field, draft]) => [field, draft.value])),
      } as CarSettings;
      return cachedSettings;
    });
    mockAcceptPatch.mockReset().mockImplementation((_uid, _session, changes, options) => {
      const base = confirmedSnapshot?.settings ?? accountASettings;
      const nextConfirmed = { ...base, ...changes };
      confirmedSnapshot = { exists: true, settings: nextConfirmed };
      for (const [field] of Object.entries(changes)) {
        if (
          (field === 'gasolineAutonomy' || field === 'alcoholAutonomy') &&
          drafts.get(field)?.revision === options?.acknowledgedDraftRevisions?.[field]
        ) {
          drafts.delete(field);
        }
      }
      cachedSettings = {
        ...nextConfirmed,
        ...Object.fromEntries([...drafts].map(([field, draft]) => [field, draft.value])),
      };
      return cachedSettings;
    });
    mockResolveAcknowledgedDrafts.mockImplementation(
      async (_uid, _session, acknowledgedDraftRevisions) => {
        for (const [field, acknowledgedRevision] of Object.entries(acknowledgedDraftRevisions)) {
          if (
            (field === 'gasolineAutonomy' || field === 'alcoholAutonomy') &&
            drafts.get(field)?.revision === acknowledgedRevision
          ) {
            drafts.delete(field);
          }
        }
        if (confirmedSnapshot) {
          cachedSettings = {
            ...confirmedSnapshot.settings,
            ...Object.fromEntries([...drafts].map(([field, draft]) => [field, draft.value])),
          } as CarSettings;
        }
      },
    );
    mockRecordDraft.mockImplementation((_uid, _session, changes) => {
      const revisions: Partial<Record<keyof CarSettings, number>> = {};
      for (const [field, value] of Object.entries(changes)) {
        if (
          (field === 'gasolineAutonomy' || field === 'alcoholAutonomy') &&
          typeof value === 'string'
        ) {
          const nextDraftRevision = ++draftRevision;
          drafts.set(field, { value, revision: nextDraftRevision });
          revisions[field] = nextDraftRevision;
        }
      }
      if (cachedSettings) cachedSettings = { ...cachedSettings, ...changes } as CarSettings;
      return { revisions, persisted: Promise.resolve() };
    });
    mockRemoteLoad
      .mockReset()
      .mockImplementation(async (uid) =>
        uid === 'account-a'
          ? { exists: true, settings: accountASettings, source: 'server' }
          : { exists: false, settings: { ...EMPTY_CAR_SETTINGS }, source: 'server' },
      );
    mockRemoteSave.mockReset().mockResolvedValue(undefined);
    mockWatch.mockReset().mockReturnValue(jest.fn());
  });

  afterEach(async () => {
    await act(async () => renderer?.unmount());
  });

  it('caches a confirmed snapshot without writing anything to Firestore', async () => {
    await renderSettings();

    expect(current?.settings).toEqual(accountASettings);
    expect(mockAcceptConfirmed).toHaveBeenCalledTimes(1);
    expect(mockAcceptConfirmed).toHaveBeenCalledWith('account-a', 1, accountASettings, {
      canRun: expect.any(Function),
      remoteReadRevision: 1,
    });
    expect(mockRemoteSave).not.toHaveBeenCalled();
    expect(mockWatch).not.toHaveBeenCalled();
  });

  it('uses the latest already accepted confirmation when an older read resolves later', async () => {
    const newerSettings = {
      alcoholAutonomy: 'newer confirmed alcohol',
      gasolineAutonomy: 'newer confirmed gasoline',
    };
    mockGetCached.mockReturnValue(newerSettings);
    mockGetConfirmed.mockReturnValue({ exists: true, settings: newerSettings });
    mockAcceptConfirmed.mockReturnValueOnce(null);
    mockRemoteLoad.mockResolvedValueOnce({
      exists: true,
      settings: accountASettings,
      source: 'server',
    });

    await renderSettings();

    expect(current?.settings).toEqual(newerSettings);
    expect(mockGetConfirmed).toHaveBeenCalledWith('account-a', 1);
  });

  it('keeps a pending snapshot out of the cache and preserves explicit edits through confirmation', async () => {
    mockRemoteLoad.mockResolvedValueOnce({
      exists: false,
      settings: { ...EMPTY_CAR_SETTINGS },
      source: 'pending',
    });
    const pendingWrite = deferred<WriteResult>();
    mockRemoteSave.mockReturnValueOnce(pendingWrite.promise);
    const unsubscribe = jest.fn();
    mockWatch.mockReturnValueOnce(unsubscribe);
    await renderSettings();
    expect(current?.settings).toEqual(accountASettings);
    expect(current?.isHydrated).toBe(true);
    expect(mockLocalSave).not.toHaveBeenCalled();

    await act(async () => current?.updateField('gasolineAutonomy', 'local draft'));
    expect(current?.settings.gasolineAutonomy).toBe('local draft');
    expect(mockRemoteSave).not.toHaveBeenCalled();
    expect(mockRecordDraft).toHaveBeenCalledWith(
      'account-a',
      1,
      {
        gasolineAutonomy: 'local draft',
      },
      { canRun: expect.any(Function) },
    );
    expect(mockInvalidate).not.toHaveBeenCalled();

    const confirmedSettings = {
      alcoholAutonomy: 'confirmed alcohol',
      gasolineAutonomy: 'confirmed gasoline',
    };
    const [, confirm] = mockWatch.mock.calls[0];
    await act(async () => confirm({ exists: true, settings: confirmedSettings, source: 'server' }));
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(current?.settings).toEqual({ ...confirmedSettings, gasolineAutonomy: 'local draft' });
    expect(mockRemoteSave).toHaveBeenCalledTimes(1);
    expect(mockRemoteSave).toHaveBeenCalledWith(
      'account-a',
      { gasolineAutonomy: 'local draft' },
      false,
      { canRun: expect.any(Function), canPersist: expect.any(Function) },
    );
    expect(mockAcceptConfirmed.mock.calls[0][2]).toEqual(confirmedSettings);

    await act(async () =>
      pendingWrite.resolve({
        kind: 'patch',
        changes: { gasolineAutonomy: 'local draft' },
      }),
    );
    expect(mockAcceptPatch).toHaveBeenCalledWith(
      'account-a',
      1,
      { gasolineAutonomy: 'local draft' },
      {
        canRun: expect.any(Function),
        remoteReadRevision: 1,
        acknowledgedDraftRevisions: { gasolineAutonomy: 1 },
      },
    );
    expect(mockRemoteLoad).toHaveBeenCalledTimes(1);
    expect(mockRemoteSave).toHaveBeenCalledTimes(1);
  });

  it('keeps confirmed-absence persistence valid after unmount but not after logout', async () => {
    mockRemoteLoad.mockResolvedValueOnce({
      exists: true,
      settings: accountASettings,
      source: 'pending',
    });
    mockWatch.mockReturnValueOnce(jest.fn());
    await renderSettings();

    const [, confirm] = mockWatch.mock.calls[0];
    await act(async () =>
      confirm({ exists: false, settings: { ...EMPTY_CAR_SETTINGS }, source: 'server' }),
    );
    const options = mockAcceptConfirmed.mock.calls[0][3];
    expect(options?.canRun?.()).toBe(true);
    expect(current?.settings).toEqual(EMPTY_CAR_SETTINGS);

    await act(async () => renderer?.unmount());
    expect(options?.canRun?.()).toBe(true);
    setTestAuth(null, 2);
    expect(options?.canRun?.()).toBe(false);
  });

  it('revalidates an acknowledged patch when a newer full snapshot was accepted first', async () => {
    const latestSettings = {
      alcoholAutonomy: 'newer external alcohol',
      gasolineAutonomy: 'newer external gasoline',
    };
    mockGetCached.mockReturnValue(latestSettings);
    mockRemoteLoad
      .mockResolvedValueOnce({
        exists: true,
        settings: accountASettings,
        source: 'server',
      })
      .mockResolvedValueOnce({
        exists: true,
        settings: latestSettings,
        source: 'server',
      });
    mockAcceptPatch.mockReturnValueOnce(null);
    mockRemoteSave.mockResolvedValueOnce({
      kind: 'patch',
      changes: { gasolineAutonomy: 'edited gasoline' },
    });

    await renderSettings();
    await act(async () => current?.updateField('gasolineAutonomy', 'edited gasoline'));
    await act(async () => settle());

    expect(mockRemoteLoad).toHaveBeenCalledTimes(2);
    expect(current?.settings).toEqual(latestSettings);
    expect(mockAcceptPatch).toHaveBeenCalledTimes(1);
    expect(mockAcceptConfirmed).toHaveBeenCalledTimes(2);
  });

  it.each(['pending', 'error'] as const)(
    'clears an acknowledged draft after stale revalidation returns %s',
    async (revalidation) => {
      const latestSettings = {
        alcoholAutonomy: 'confirmed external alcohol',
        gasolineAutonomy: 'confirmed external gasoline',
      };
      mockRemoteLoad
        .mockResolvedValueOnce({
          exists: true,
          settings: accountASettings,
          source: 'server',
        })
        .mockImplementationOnce(async () => {
          if (revalidation === 'error') throw new Error('synthetic offline read');
          return { exists: true, settings: accountASettings, source: 'pending' };
        });
      mockRemoteSave.mockResolvedValueOnce({
        kind: 'patch',
        changes: { gasolineAutonomy: 'acknowledged draft' },
      });

      await renderSettings();
      mockAcceptConfirmed('account-a', 1, latestSettings, { remoteReadRevision: 2 });
      mockAcceptPatch.mockReturnValueOnce(null);

      await act(async () => current?.updateField('gasolineAutonomy', 'acknowledged draft'));
      await act(async () => settle());

      expect(mockResolveAcknowledgedDrafts).toHaveBeenCalledWith(
        'account-a',
        1,
        { gasolineAutonomy: 1 },
        { canRun: expect.any(Function) },
      );
      expect(current?.settings).toEqual(latestSettings);
      expect(mockRemoteSave).toHaveBeenCalledTimes(1);
    },
  );

  it('unsubscribes when a confirmation callback runs synchronously during subscription', async () => {
    const confirmedSettings = {
      alcoholAutonomy: 'confirmed alcohol',
      gasolineAutonomy: 'confirmed gasoline',
    };
    mockRemoteLoad.mockResolvedValueOnce({
      exists: true,
      settings: accountASettings,
      source: 'pending',
    });
    const unsubscribe = jest.fn();
    mockWatch.mockImplementationOnce((_uid, onConfirmed) => {
      onConfirmed({ exists: true, settings: confirmedSettings, source: 'server' });
      return unsubscribe;
    });

    await renderSettings();

    expect(current?.settings).toEqual(confirmedSettings);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('handles a synchronous subscription error and unsubscribes once available', async () => {
    mockRemoteLoad.mockResolvedValueOnce({
      exists: true,
      settings: accountASettings,
      source: 'pending',
    });
    const unsubscribe = jest.fn();
    mockWatch.mockImplementationOnce((_uid, _onConfirmed, onError) => {
      onError(new Error('synthetic listener failure'));
      return unsubscribe;
    });

    await renderSettings();

    expect(current?.settings).toEqual(accountASettings);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('keeps the newest acknowledged offline edit in cache after the editor unmounts', async () => {
    await renderSettings();
    const firstWrite = deferred<WriteResult>();
    const secondWrite = deferred<WriteResult>();
    mockRemoteSave
      .mockReset()
      .mockReturnValueOnce(firstWrite.promise)
      .mockReturnValueOnce(secondWrite.promise);

    await act(async () => current?.updateField('gasolineAutonomy', '8 Km/l'));
    await act(async () => current?.updateField('gasolineAutonomy', '8,5 Km/l'));

    expect(mockRemoteSave).toHaveBeenCalledTimes(2);
    expect(mockRemoteSave.mock.calls.map((call) => call[1])).toEqual([
      { gasolineAutonomy: '8 Km/l' },
      { gasolineAutonomy: '8,5 Km/l' },
    ]);
    expect(mockRecordDraft).toHaveBeenCalledTimes(2);

    await act(async () => renderer?.unmount());
    await act(async () => {
      firstWrite.resolve({ kind: 'patch', changes: { gasolineAutonomy: '8 Km/l' } });
      secondWrite.resolve({ kind: 'patch', changes: { gasolineAutonomy: '8,5 Km/l' } });
      await settle();
    });
    expect(mockAcceptPatch).toHaveBeenCalledTimes(2);
    expect(mockGetCached('account-a', 1)?.gasolineAutonomy).toBe('8,5 Km/l');
    expect(mockResolveAcknowledgedDrafts).not.toHaveBeenCalled();
  });

  it('keeps cached settings and local edits if the pending confirmation fails', async () => {
    mockRemoteLoad.mockResolvedValueOnce({
      exists: true,
      settings: { alcoholAutonomy: 'pending alcohol', gasolineAutonomy: 'pending gasoline' },
      source: 'pending',
    });
    const unsubscribe = jest.fn();
    mockWatch.mockReturnValueOnce(unsubscribe);
    await renderSettings();
    await act(async () => current?.updateField('gasolineAutonomy', 'local draft'));
    const [, , reject] = mockWatch.mock.calls[0];
    await act(async () => reject(new Error('permission denied')));

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(current?.settings).toEqual({ ...accountASettings, gasolineAutonomy: 'local draft' });
    expect(mockRemoteLoad).toHaveBeenCalledTimes(1);
    expect(mockRecordDraft).toHaveBeenCalledWith(
      'account-a',
      1,
      {
        gasolineAutonomy: 'local draft',
      },
      { canRun: expect.any(Function) },
    );
    expect(mockRemoteSave).not.toHaveBeenCalled();
  });

  it('unsubscribes on logout and ignores a late pending confirmation', async () => {
    mockRemoteLoad.mockResolvedValueOnce({
      exists: true,
      settings: accountASettings,
      source: 'pending',
    });
    const unsubscribe = jest.fn();
    mockWatch.mockReturnValueOnce(unsubscribe);
    await renderSettings();
    await act(async () => current?.updateField('gasolineAutonomy', 'private draft'));
    const [, confirm] = mockWatch.mock.calls[0];
    mockLocalSave.mockClear();

    setTestAuth(null, 2);
    await renderSettings();
    await act(async () => confirm({ exists: true, settings: accountASettings, source: 'server' }));

    expect(current?.settings).toEqual(EMPTY_CAR_SETTINGS);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(mockAcceptConfirmed).not.toHaveBeenCalled();
    expect(mockRemoteSave).not.toHaveBeenCalled();
  });

  it('discards a write acknowledgement after logout', async () => {
    await renderSettings();
    const pendingWrite = deferred<WriteResult>();
    mockRemoteSave.mockReturnValueOnce(pendingWrite.promise);
    await act(async () => current?.updateField('gasolineAutonomy', 'old session edit'));
    expect(mockRemoteSave).toHaveBeenCalledTimes(1);
    const options = mockRemoteSave.mock.calls[0][3];
    mockAcceptConfirmed.mockClear();

    setTestAuth(null, 2);
    await renderSettings();
    expect(options?.canRun?.()).toBe(false);
    expect(options?.canPersist?.()).toBe(false);
    await act(async () =>
      pendingWrite.resolve({ kind: 'patch', changes: { gasolineAutonomy: 'old session edit' } }),
    );

    expect(current?.settings).toEqual(EMPTY_CAR_SETTINGS);
    expect(mockAcceptConfirmed).not.toHaveBeenCalled();
    expect(mockResolveAcknowledgedDrafts).not.toHaveBeenCalled();
  });

  it('dispatches independent edits while preserving a rejected field draft without retrying it', async () => {
    await renderSettings();
    const rejectedWrite = deferred<WriteResult>();
    mockRemoteSave
      .mockReturnValueOnce(rejectedWrite.promise)
      .mockResolvedValueOnce({ kind: 'patch', changes: { alcoholAutonomy: 'new alcohol' } });
    mockLocalSave.mockClear();

    await act(async () => current?.updateField('gasolineAutonomy', 'rejected gasoline'));
    await act(async () => current?.updateField('alcoholAutonomy', 'new alcohol'));
    expect(mockRemoteSave).toHaveBeenCalledTimes(2);
    expect(mockRemoteSave.mock.calls.map((call) => call[1])).toEqual([
      { gasolineAutonomy: 'rejected gasoline' },
      { alcoholAutonomy: 'new alcohol' },
    ]);
    expect(mockRecordDraft).toHaveBeenCalledTimes(2);

    await act(async () => rejectedWrite.reject(new Error('permission denied')));
    expect(mockRemoteSave).toHaveBeenCalledTimes(2);
    expect(mockRecordDraft).toHaveBeenCalledTimes(2);
    expect(current?.settings).toEqual({
      alcoholAutonomy: 'new alcohol',
      gasolineAutonomy: 'rejected gasoline',
    });
  });

  it('does not expose account A cache or state after switching to account B', async () => {
    let current: ReturnType<typeof useCarSettings> | undefined;
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness, { onRender: (value) => (current = value) }));
      await settle();
    });
    expect(current?.settings).toEqual(accountASettings);

    setTestAuth({ id: 'account-b' }, 2);
    await act(async () => {
      renderer?.update(createElement(Harness, { onRender: (value) => (current = value) }));
      await settle();
    });

    expect(current?.settings).toEqual(EMPTY_CAR_SETTINGS);
    expect(mockGetCached).toHaveBeenCalledWith('account-b', 2);
    expect(mockLocalLoad).toHaveBeenCalledWith('account-b', 2, {
      canRun: expect.any(Function),
    });
    expect(mockRemoteSave).not.toHaveBeenCalled();
    await act(async () => renderer?.unmount());
  });

  it('ignores a late local read from account A after account B becomes active', async () => {
    const pendingAccountALoad = deferred<CarSettings>();
    mockLocalLoad.mockImplementation((uid) =>
      uid === 'account-a' ? pendingAccountALoad.promise : Promise.resolve(EMPTY_CAR_SETTINGS),
    );

    let current: ReturnType<typeof useCarSettings> | undefined;
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness, { onRender: (value) => (current = value) }));
      await settle();
    });
    setTestAuth({ id: 'account-b' }, 2);
    await act(async () => {
      renderer?.update(createElement(Harness, { onRender: (value) => (current = value) }));
      await settle();
    });

    await act(async () => {
      pendingAccountALoad.resolve(accountASettings);
      await settle();
    });

    expect(current?.settings).toEqual(EMPTY_CAR_SETTINGS);
    expect(mockRemoteSave).not.toHaveBeenCalled();
    await act(async () => renderer?.unmount());
  });

  it('ignores a late server response from before logout and login for the same UID', async () => {
    let authState: { user: { id: string }; sessionVersion: number } = {
      user: { id: 'account-a' },
      sessionVersion: 10,
    };
    setActiveAuthSession(authState.user.id, authState.sessionVersion);
    mockUseAuth.mockImplementation(() => authState as never);
    const firstRemote = deferred<FirestoreCarSettingsLoadResult>();
    const currentSessionSettings = {
      alcoholAutonomy: 'current-session alcohol',
      gasolineAutonomy: 'current-session gasoline',
    };
    mockRemoteLoad.mockReset().mockReturnValueOnce(firstRemote.promise).mockResolvedValueOnce({
      exists: true,
      settings: currentSessionSettings,
      source: 'server',
    });

    let current: ReturnType<typeof useCarSettings> | undefined;
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness, { onRender: (value) => (current = value) }));
      await settle();
    });
    authState = { user: { id: 'account-a' }, sessionVersion: 11 };
    setActiveAuthSession(authState.user.id, authState.sessionVersion);
    await act(async () => {
      renderer?.update(createElement(Harness, { onRender: (value) => (current = value) }));
      await settle();
    });
    expect(current?.settings).toEqual(currentSessionSettings);

    await act(async () => {
      firstRemote.resolve({
        exists: true,
        settings: { ...accountASettings, gasolineAutonomy: 'stale-session value' },
        source: 'server',
      });
      await settle();
    });

    expect(current?.settings).toEqual(currentSessionSettings);
    expect(mockRemoteSave).not.toHaveBeenCalled();
    await act(async () => renderer?.unmount());
  });

  it('writes only explicitly edited fields after a server-confirmed missing document', async () => {
    setTestAuth({ id: 'account-b' }, 2);
    let current: ReturnType<typeof useCarSettings> | undefined;
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness, { onRender: (value) => (current = value) }));
      await settle();
    });

    await act(async () => {
      current?.updateField('gasolineAutonomy', '8,5 Km/l');
      await settle();
    });

    expect(mockRemoteSave).toHaveBeenCalledWith(
      'account-b',
      { gasolineAutonomy: '8,5 Km/l' },
      true,
      { canRun: expect.any(Function), canPersist: expect.any(Function) },
    );
    await act(async () => renderer?.unmount());
  });

  it('replaces stale local cache after the server confirms the settings document is absent', async () => {
    const staleSettings = {
      alcoholAutonomy: 'old alcohol setting',
      gasolineAutonomy: 'old gasoline setting',
    };
    setTestAuth({ id: 'account-b' }, 2);
    mockGetCached.mockReturnValue(staleSettings);
    mockLocalLoad.mockResolvedValue(staleSettings);
    mockRemoteLoad.mockResolvedValue({
      exists: false,
      settings: { ...EMPTY_CAR_SETTINGS },
      source: 'server',
    });

    let current: ReturnType<typeof useCarSettings> | undefined;
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness, { onRender: (value) => (current = value) }));
      await settle();
    });

    expect(current?.settings).toEqual(EMPTY_CAR_SETTINGS);
    expect(mockAcceptConfirmed).toHaveBeenCalledWith('account-b', 2, undefined, {
      canRun: expect.any(Function),
      remoteReadRevision: 1,
    });
    expect(mockInvalidate).not.toHaveBeenCalled();
    expect(mockLocalSave).not.toHaveBeenCalled();
    expect(mockRemoteSave).not.toHaveBeenCalled();
    await act(async () => renderer?.unmount());
  });

  it('keeps local state and skips remote writes after an offline read failure', async () => {
    setTestAuth({ id: 'account-b' }, 2);
    mockLocalLoad.mockResolvedValue({
      alcoholAutonomy: 'B offline alcohol',
      gasolineAutonomy: 'B offline gasoline',
    });
    mockRemoteLoad.mockRejectedValue(new Error('offline'));

    let current: ReturnType<typeof useCarSettings> | undefined;
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness, { onRender: (value) => (current = value) }));
      await settle();
    });
    await act(async () => {
      current?.updateField('gasolineAutonomy', '9 Km/l');
      await settle();
    });

    expect(current?.settings.gasolineAutonomy).toBe('9 Km/l');
    expect(current?.settings.alcoholAutonomy).toBe('B offline alcohol');
    expect(mockRecordDraft).toHaveBeenCalledWith(
      'account-b',
      2,
      {
        gasolineAutonomy: '9 Km/l',
      },
      { canRun: expect.any(Function) },
    );
    expect(mockRemoteLoad).toHaveBeenCalledTimes(1);
    expect(mockInvalidate).not.toHaveBeenCalled();
    expect(mockRemoteSave).not.toHaveBeenCalled();
    await act(async () => renderer?.unmount());
  });
});
