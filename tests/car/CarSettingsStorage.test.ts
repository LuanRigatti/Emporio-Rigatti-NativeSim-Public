import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  CAR_SETTINGS_STORAGE_KEY,
  CarSettingsStorage,
  carSettingsStorageKey,
  EMPTY_CAR_SETTINGS,
} from '@/services/car/CarSettingsStorage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  removeItem: jest.fn(),
  setItem: jest.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

async function settle(): Promise<void> {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

describe('CarSettingsStorage memory cache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    jest.mocked(AsyncStorage.removeItem).mockResolvedValue(undefined);
    jest.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
  });

  it('loads a UID-scoped value into the matching session cache as a defensive copy', async () => {
    const storage = new CarSettingsStorage();
    const settings = { alcoholAutonomy: '8 Km/l', gasolineAutonomy: '11 Km/l' };
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(settings));

    expect(storage.getCached('uid-a', 1)).toBeNull();
    await expect(storage.load('uid-a', 1)).resolves.toEqual(settings);
    expect(AsyncStorage.getItem).toHaveBeenCalledWith(carSettingsStorageKey('uid-a'));

    const cached = storage.getCached('uid-a', 1);
    expect(cached).toEqual(settings);
    cached!.gasolineAutonomy = 'invalid';
    expect(storage.getCached('uid-a', 1)?.gasolineAutonomy).toBe(settings.gasolineAutonomy);
  });

  it('isolates memory by UID and session version while preserving scoped fallbacks', async () => {
    const storage = new CarSettingsStorage();
    const settings = { alcoholAutonomy: '9 Km/l', gasolineAutonomy: '12 Km/l' };

    storage.setCached('uid-a', 4, settings);

    expect(storage.getCached('uid-a', 4)).toEqual(settings);
    expect(storage.getCached('uid-a', 5)).toBeNull();
    expect(storage.getCached('uid-b', 4)).toBeNull();
    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('unavailable'));
    await expect(storage.load('uid-b', 4)).resolves.toEqual(EMPTY_CAR_SETTINGS);
    expect(storage.getCached('uid-b', 4)).toEqual(EMPTY_CAR_SETTINGS);
    expect(storage.getCached('uid-a', 4)).toEqual(settings);
  });

  it('ignores the ambiguous unscoped legacy key without changing it', async () => {
    const storage = new CarSettingsStorage();
    const legacy = JSON.stringify({
      alcoholAutonomy: 'legacy alcohol',
      gasolineAutonomy: 'legacy gasoline',
    });
    jest
      .mocked(AsyncStorage.getItem)
      .mockImplementation(async (key) => (key === CAR_SETTINGS_STORAGE_KEY ? legacy : null));

    await expect(storage.load('uid-b', 2)).resolves.toEqual(EMPTY_CAR_SETTINGS);

    expect(AsyncStorage.getItem).toHaveBeenCalledWith(carSettingsStorageKey('uid-b'));
    expect(AsyncStorage.getItem).not.toHaveBeenCalledWith(CAR_SETTINGS_STORAGE_KEY);
    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(
      CAR_SETTINGS_STORAGE_KEY,
      expect.anything(),
    );
  });

  it('does not let a late stale storage read overwrite a newer server-confirmed cache value', async () => {
    const storage = new CarSettingsStorage();
    const staleRead = deferred<string | null>();
    const confirmedSettings = { ...EMPTY_CAR_SETTINGS };
    jest.mocked(AsyncStorage.getItem).mockReturnValueOnce(staleRead.promise);

    const loading = storage.load('uid-a', 3);
    storage.setCached('uid-a', 3, confirmedSettings);
    staleRead.resolve(
      JSON.stringify({ alcoholAutonomy: 'stale alcohol', gasolineAutonomy: 'stale gasoline' }),
    );

    await expect(loading).resolves.toEqual(confirmedSettings);
    expect(storage.getCached('uid-a', 3)).toEqual(confirmedSettings);
  });

  it('does not let a remote read started before a confirmed write replace its cache', async () => {
    const storage = new CarSettingsStorage();
    const earlierRead = storage.beginRemoteRead();
    const updated = { alcoholAutonomy: 'new alcohol', gasolineAutonomy: 'new gasoline' };

    await storage.save('uid-a', 3, updated, { remoteReadRevision: storage.beginRemoteRead() });
    await storage.invalidate('uid-a', 3, { remoteReadRevision: earlierRead });

    expect(storage.getCached('uid-a', 3)).toEqual(updated);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });

  it('keeps an accepted explicit field draft when another instance confirms remote data', async () => {
    const storage = new CarSettingsStorage();
    const draft = { gasolineAutonomy: 'explicit draft' };
    await storage.saveDraft('uid-a', 3, draft);
    const remote = {
      alcoholAutonomy: 'latest remote alcohol',
      gasolineAutonomy: 'old remote gasoline',
    };

    const effective = storage.acceptConfirmed('uid-a', 3, remote, {
      remoteReadRevision: storage.beginRemoteRead(),
    });
    await storage.saveDraft('uid-a', 3, draft);

    expect(effective).toEqual({ ...remote, ...draft });
    expect(storage.getCached('uid-a', 3)).toEqual({ ...remote, ...draft });
    expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(
      carSettingsStorageKey('uid-a'),
      JSON.stringify({ ...remote, ...draft }),
    );
  });

  it('clears only the matching draft after its confirmed write and retains newer edits', async () => {
    const storage = new CarSettingsStorage();
    const sent = storage.recordDraft('uid-a', 3, { gasolineAutonomy: 'sent value' });
    await sent.persisted;
    await storage.saveDraft('uid-a', 3, { gasolineAutonomy: 'newer value' });
    const transactionResult = {
      alcoholAutonomy: 'confirmed alcohol',
      gasolineAutonomy: 'sent value',
    };

    const effective = storage.acceptConfirmed('uid-a', 3, transactionResult, {
      remoteReadRevision: storage.beginRemoteRead(),
      acknowledgedDraftRevisions: sent.revisions,
    });
    await storage.saveDraft('uid-a', 3, { gasolineAutonomy: 'newer value' });

    expect(effective).toEqual({ ...transactionResult, gasolineAutonomy: 'newer value' });
    expect(storage.getCached('uid-a', 3)).toEqual(effective);
  });

  it('removes an acknowledged draft when a later confirmed value supersedes it', async () => {
    const storage = new CarSettingsStorage();
    const acknowledged = storage.recordDraft('uid-a', 3, { gasolineAutonomy: 'sent value' });
    await acknowledged.persisted;
    const laterRemote = {
      alcoholAutonomy: 'confirmed alcohol',
      gasolineAutonomy: 'newer remote value',
    };

    const effective = storage.acceptConfirmed('uid-a', 3, laterRemote, {
      remoteReadRevision: storage.beginRemoteRead(),
      acknowledgedDraftRevisions: acknowledged.revisions,
    });
    await storage.saveDraft('uid-a', 3, {});

    expect(effective).toEqual(laterRemote);
    expect(storage.getCached('uid-a', 3)).toEqual(laterRemote);
  });

  it('resolves an acknowledged draft against the latest accepted base after an unavailable reread', async () => {
    const storage = new CarSettingsStorage();
    const initial = { alcoholAutonomy: 'old alcohol', gasolineAutonomy: 'old gasoline' };
    const latest = { alcoholAutonomy: 'new alcohol', gasolineAutonomy: 'new gasoline' };
    storage.acceptConfirmed('uid-a', 3, initial, {
      remoteReadRevision: storage.beginRemoteRead(),
    });
    const acknowledged = storage.recordDraft('uid-a', 3, {
      gasolineAutonomy: 'sent value',
    });
    await acknowledged.persisted;
    storage.acceptConfirmed('uid-a', 3, latest, {
      remoteReadRevision: storage.beginRemoteRead(),
    });

    await storage.resolveAcknowledgedDrafts('uid-a', 3, acknowledged.revisions);

    expect(storage.getCached('uid-a', 3)).toEqual(latest);
    expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(
      carSettingsStorageKey('uid-a'),
      JSON.stringify(latest),
    );
  });

  it('does not resolve a newer draft with an older write acknowledgement', async () => {
    const storage = new CarSettingsStorage();
    const confirmed = { alcoholAutonomy: 'confirmed alcohol', gasolineAutonomy: 'confirmed gas' };
    storage.acceptConfirmed('uid-a', 3, confirmed, {
      remoteReadRevision: storage.beginRemoteRead(),
    });
    const first = storage.recordDraft('uid-a', 3, { gasolineAutonomy: 'first edit' });
    await first.persisted;
    const second = storage.recordDraft('uid-a', 3, { gasolineAutonomy: 'newer edit' });
    await second.persisted;

    await storage.resolveAcknowledgedDrafts('uid-a', 3, first.revisions);
    expect(storage.getCached('uid-a', 3)?.gasolineAutonomy).toBe('newer edit');
    await storage.resolveAcknowledgedDrafts('uid-a', 3, second.revisions);

    expect(storage.getCached('uid-a', 3)).toEqual(confirmed);
  });

  it('removes persistent defaults when an acknowledged draft settles against confirmed absence', async () => {
    const storage = new CarSettingsStorage();
    const absentRevision = storage.beginRemoteRead();
    storage.acceptConfirmed('uid-a', 3, undefined, { remoteReadRevision: absentRevision });
    await settle();
    jest.mocked(AsyncStorage.removeItem).mockClear();
    const draft = storage.recordDraft('uid-a', 3, { gasolineAutonomy: 'created then removed' });
    await draft.persisted;

    await storage.resolveAcknowledgedDrafts('uid-a', 3, draft.revisions);

    expect(storage.getConfirmed('uid-a', 3)).toEqual({
      exists: false,
      settings: { ...EMPTY_CAR_SETTINGS },
    });
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(carSettingsStorageKey('uid-a'));
    const removeOrder = jest.mocked(AsyncStorage.removeItem).mock.invocationCallOrder;
    const setOrder = jest.mocked(AsyncStorage.setItem).mock.invocationCallOrder;
    expect(removeOrder[removeOrder.length - 1]).toBeGreaterThan(setOrder[setOrder.length - 1]);
  });

  it('finishes queued absence invalidation after unmount while the session stays active', async () => {
    const storage = new CarSettingsStorage();
    const previousWriteStarted = deferred<void>();
    const previousWriteGate = deferred<void>();
    const removalStarted = deferred<void>();
    let sessionActive = true;
    jest.mocked(AsyncStorage.setItem).mockImplementationOnce(async () => {
      previousWriteStarted.resolve();
      await previousWriteGate.promise;
    });
    jest.mocked(AsyncStorage.removeItem).mockImplementationOnce(async () => {
      removalStarted.resolve();
    });

    const previousWrite = storage.save('uid-a', 3, {
      alcoholAutonomy: 'old alcohol',
      gasolineAutonomy: 'old gasoline',
    });
    await previousWriteStarted.promise;
    const revision = storage.beginRemoteRead();
    storage.acceptConfirmed('uid-a', 3, undefined, {
      canRun: () => sessionActive,
      remoteReadRevision: revision,
    });

    previousWriteGate.resolve();
    await removalStarted.promise;
    await previousWrite;
    sessionActive = false;

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(carSettingsStorageKey('uid-a'));
    expect(storage.getConfirmed('uid-a', 3)?.exists).toBe(false);
  });

  it('rejects stale confirmations before changing either published cache or storage', async () => {
    const storage = new CarSettingsStorage();
    const staleRevision = storage.beginRemoteRead();
    const newest = { alcoholAutonomy: 'new alcohol', gasolineAutonomy: 'new gasoline' };
    const newestRevision = storage.beginRemoteRead();
    expect(
      storage.acceptConfirmed('uid-a', 3, newest, { remoteReadRevision: newestRevision }),
    ).toEqual(newest);

    const stale = storage.acceptConfirmed('uid-a', 3, EMPTY_CAR_SETTINGS, {
      remoteReadRevision: staleRevision,
    });
    await storage.saveDraft('uid-a', 3, {});

    expect(stale).toBeNull();
    expect(storage.getCached('uid-a', 3)).toEqual(newest);
    expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(
      carSettingsStorageKey('uid-a'),
      JSON.stringify(newest),
    );
  });

  it('preserves a queued explicit draft across unmount and makes a new session wait for it', async () => {
    const storage = new CarSettingsStorage();
    const delayedWrite = deferred<void>();
    jest.mocked(AsyncStorage.setItem).mockReturnValueOnce(delayedWrite.promise);
    jest
      .mocked(AsyncStorage.getItem)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        JSON.stringify({ ...EMPTY_CAR_SETTINGS, gasolineAutonomy: 'saved draft' }),
      );

    const saving = storage.saveDraft('uid-a', 3, { gasolineAutonomy: 'saved draft' });
    await settle();
    expect(AsyncStorage.getItem).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    const loading = storage.load('uid-a', 4);
    expect(AsyncStorage.getItem).toHaveBeenCalledTimes(1);

    delayedWrite.resolve();
    await saving;
    await expect(loading).resolves.toEqual({
      ...EMPTY_CAR_SETTINGS,
      gasolineAutonomy: 'saved draft',
    });
    expect(AsyncStorage.getItem).toHaveBeenCalledWith(carSettingsStorageKey('uid-a'));
    expect(AsyncStorage.getItem).toHaveBeenCalledTimes(2);
  });

  it('merges an edit made while local hydration is pending without losing the untouched field', async () => {
    const storage = new CarSettingsStorage();
    const delayedRead = deferred<string | null>();
    const existingSettings = {
      alcoholAutonomy: 'existing alcohol',
      gasolineAutonomy: 'existing gasoline',
    };
    jest.mocked(AsyncStorage.getItem).mockReturnValueOnce(delayedRead.promise);

    const hydration = storage.load('uid-a', 3);
    await settle();
    expect(AsyncStorage.getItem).toHaveBeenCalledTimes(1);
    const savingDraft = storage.saveDraft('uid-a', 3, { gasolineAutonomy: 'edited gasoline' });
    await settle();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();

    delayedRead.resolve(JSON.stringify(existingSettings));
    await expect(hydration).resolves.toEqual({
      alcoholAutonomy: 'existing alcohol',
      gasolineAutonomy: 'edited gasoline',
    });
    await savingDraft;

    const expected = {
      alcoholAutonomy: 'existing alcohol',
      gasolineAutonomy: 'edited gasoline',
    };
    expect(storage.getCached('uid-a', 3)).toEqual(expected);
    expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(
      carSettingsStorageKey('uid-a'),
      JSON.stringify(expected),
    );
  });

  it('does not invalidate an explicit draft when the server confirms the document is absent', async () => {
    const storage = new CarSettingsStorage();
    const draft = { gasolineAutonomy: 'explicit draft' };
    await storage.saveDraft('uid-a', 3, draft);

    const effective = storage.acceptConfirmed('uid-a', 3, undefined, {
      remoteReadRevision: storage.beginRemoteRead(),
    });
    await storage.saveDraft('uid-a', 3, draft);

    expect(effective).toEqual({ ...EMPTY_CAR_SETTINGS, ...draft });
    expect(storage.getCached('uid-a', 3)).toEqual(effective);
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });

  it('does not treat a local draft as a newer remote confirmation', async () => {
    const storage = new CarSettingsStorage();
    const remoteRead = storage.beginRemoteRead();
    const draft = { ...EMPTY_CAR_SETTINGS, gasolineAutonomy: 'draft gasoline' };
    const confirmedWithDraft = { ...draft, alcoholAutonomy: 'confirmed alcohol' };

    await storage.save('uid-a', 3, draft);
    await storage.save('uid-a', 3, confirmedWithDraft, { remoteReadRevision: remoteRead });

    expect(storage.getCached('uid-a', 3)).toEqual(confirmedWithDraft);
    expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(
      carSettingsStorageKey('uid-a'),
      JSON.stringify(confirmedWithDraft),
    );
  });

  it('serializes a confirmed absence behind a prior write without restoring stale cache', async () => {
    const storage = new CarSettingsStorage();
    const pendingWrite = deferred<void>();
    const stale = { alcoholAutonomy: 'old alcohol', gasolineAutonomy: 'old gasoline' };
    jest.mocked(AsyncStorage.setItem).mockReturnValueOnce(pendingWrite.promise);

    const writing = storage.save('uid-a', 3, stale);
    await Promise.resolve();
    const invalidating = storage.invalidate('uid-a', 3, {
      remoteReadRevision: storage.beginRemoteRead(),
    });
    await expect(storage.load('uid-a', 3)).resolves.toEqual(EMPTY_CAR_SETTINGS);
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();

    pendingWrite.resolve();
    await Promise.all([writing, invalidating]);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(carSettingsStorageKey('uid-a'));
    expect(storage.getCached('uid-a', 3)).toEqual(EMPTY_CAR_SETTINGS);
  });

  it('skips a queued invalidation that loses its session before the storage write', async () => {
    const storage = new CarSettingsStorage();
    const pendingWrite = deferred<void>();
    jest.mocked(AsyncStorage.setItem).mockReturnValueOnce(pendingWrite.promise);
    let sessionActive = true;
    const writing = storage.save('uid-a', 3, EMPTY_CAR_SETTINGS);
    const invalidating = storage.invalidate('uid-a', 3, { canRun: () => sessionActive });
    sessionActive = false;
    pendingWrite.resolve();
    await Promise.all([writing, invalidating]);

    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    expect(storage.getCached('uid-a', 4)).toBeNull();
  });
});
