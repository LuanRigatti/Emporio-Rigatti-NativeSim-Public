import { getDoc, getDocFromServer, runTransaction, updateDoc } from 'firebase/firestore';

import { EMPTY_CAR_SETTINGS } from '@/services/car/CarSettings';
import { FirestoreCarSettingsDataSource } from '@/services/car/FirestoreCarSettingsDataSource';

const mockTransactionGet = jest.fn();
const mockTransactionSet = jest.fn();
const mockTransactionUpdate = jest.fn();
const mockListen = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
  },
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_database, ...segments: string[]) => ({ segments })),
  getDoc: jest.fn(),
  getDocFromServer: jest.fn(),
  onSnapshot: (...args: unknown[]) => mockListen(...args),
  runTransaction: jest.fn(async (_database, operation) =>
    operation({
      get: mockTransactionGet,
      set: mockTransactionSet,
      update: mockTransactionUpdate,
    }),
  ),
  serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
}));

jest.mock('@/services/firebase/firestore', () => ({
  getFirebaseFirestore: jest.fn(() => ({ type: 'synthetic-test-db' })),
}));

const mockedRunTransaction = jest.mocked(runTransaction);
const mockedGetDoc = jest.mocked(getDoc);
const mockedGetDocFromServer = jest.mocked(getDocFromServer);
const mockedUpdateDoc = jest.mocked(updateDoc);
const remoteSettings = { gasolineAutonomy: '10 Km/l', alcoholAutonomy: '7 Km/l' };

function snapshot(
  settings: typeof remoteSettings | undefined,
  { hasPendingWrites = false, fromCache = false } = {},
) {
  return {
    exists: () => settings !== undefined,
    data: () => settings,
    metadata: { hasPendingWrites, fromCache },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe('FirestoreCarSettingsDataSource safe explicit writes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransactionGet.mockResolvedValue({ exists: () => false });
    mockTransactionSet.mockResolvedValue(undefined);
    mockTransactionUpdate.mockResolvedValue(undefined);
    mockedGetDocFromServer.mockReset();
    mockedUpdateDoc.mockResolvedValue(undefined);
  });

  it('classifies a server snapshot with pending writes as provisional', async () => {
    const source = new FirestoreCarSettingsDataSource();
    mockedGetDocFromServer
      .mockResolvedValueOnce(snapshot(remoteSettings) as never)
      .mockResolvedValueOnce(snapshot(remoteSettings, { hasPendingWrites: true }) as never)
      .mockResolvedValueOnce(snapshot(undefined, { hasPendingWrites: true }) as never);

    await expect(source.loadWithMetadata('uid-b')).resolves.toEqual({
      exists: true,
      settings: remoteSettings,
      source: 'server',
    });
    await expect(source.loadWithMetadata('uid-b')).resolves.toEqual({
      exists: true,
      settings: remoteSettings,
      source: 'pending',
    });
    await expect(source.loadWithMetadata('uid-b')).resolves.toMatchObject({
      exists: false,
      source: 'pending',
    });
  });

  it('uses the read-only caller fallback for pending and cached snapshots', async () => {
    const source = new FirestoreCarSettingsDataSource();
    mockedGetDoc
      .mockResolvedValueOnce(snapshot(remoteSettings, { hasPendingWrites: true }) as never)
      .mockResolvedValueOnce(snapshot(remoteSettings, { fromCache: true }) as never)
      .mockResolvedValueOnce(snapshot(remoteSettings) as never);

    await expect(source.load('uid-b')).resolves.toBeUndefined();
    await expect(source.load('uid-b')).resolves.toBeUndefined();
    await expect(source.load('uid-b')).resolves.toEqual(remoteSettings);
  });

  it('waits for a metadata-only confirmation and ignores cache-only events', () => {
    const source = new FirestoreCarSettingsDataSource();
    const onConfirmed = jest.fn();
    const onError = jest.fn();
    const unsubscribe = jest.fn();
    mockListen.mockReturnValueOnce(unsubscribe);

    expect(source.watchForConfirmation('uid-b', onConfirmed, onError)).toBe(unsubscribe);
    expect(mockListen).toHaveBeenCalledWith(
      expect.objectContaining({ segments: ['users', 'uid-b', 'settings', 'car'] }),
      { includeMetadataChanges: true },
      expect.any(Function),
      onError,
    );
    const [, , emit] = mockListen.mock.calls[0];
    emit(snapshot(remoteSettings, { fromCache: true }));
    emit(snapshot(remoteSettings, { hasPendingWrites: true }));
    expect(onConfirmed).not.toHaveBeenCalled();
    emit(snapshot(remoteSettings));
    expect(onConfirmed).toHaveBeenCalledWith({
      exists: true,
      settings: remoteSettings,
      source: 'server',
    });
  });

  it('distinguishes a server-confirmed missing document from a failed read', async () => {
    const source = new FirestoreCarSettingsDataSource();
    mockedGetDocFromServer
      .mockResolvedValueOnce(snapshot(undefined) as never)
      .mockRejectedValueOnce(new Error('offline'));

    await expect(source.loadWithMetadata('uid-b')).resolves.toEqual({
      exists: false,
      settings: EMPTY_CAR_SETTINGS,
      source: 'server',
    });
    await expect(source.loadWithMetadata('uid-b')).rejects.toThrow('offline');
  });

  it('creates settings only after explicit input and includes both defaults on a confirmed miss', async () => {
    const source = new FirestoreCarSettingsDataSource();

    await source.saveFields('uid-b', { gasolineAutonomy: '9 Km/l' }, true);

    expect(mockedRunTransaction).toHaveBeenCalledTimes(1);
    expect(mockTransactionSet).toHaveBeenCalledWith(
      expect.objectContaining({ segments: ['users', 'uid-b', 'settings', 'car'] }),
      {
        alcoholAutonomy: '5,6 Km/l',
        gasolineAutonomy: '9 Km/l',
        updatedAt: 'SERVER_TIMESTAMP',
      },
      { merge: true },
    );
    expect(mockTransactionUpdate).not.toHaveBeenCalled();
  });

  it('patches only explicit fields when another writer created the document first', async () => {
    const source = new FirestoreCarSettingsDataSource();
    mockTransactionGet.mockResolvedValue(snapshot(remoteSettings));

    await expect(source.saveFields('uid-b', { gasolineAutonomy: '9 Km/l' }, true)).resolves.toEqual(
      {
        kind: 'snapshot',
        settings: { alcoholAutonomy: '7 Km/l', gasolineAutonomy: '9 Km/l' },
      },
    );

    expect(mockTransactionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ segments: ['users', 'uid-b', 'settings', 'car'] }),
      { gasolineAutonomy: '9 Km/l', updatedAt: 'SERVER_TIMESTAMP' },
    );
    expect(mockTransactionSet).not.toHaveBeenCalled();
  });

  it('returns only the acknowledged patch after updating an existing document', async () => {
    const source = new FirestoreCarSettingsDataSource();
    await expect(
      source.saveFields('uid-b', { gasolineAutonomy: '9 Km/l' }, false),
    ).resolves.toEqual({
      kind: 'patch',
      changes: { gasolineAutonomy: '9 Km/l' },
    });
    expect(mockedUpdateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ segments: ['users', 'uid-b', 'settings', 'car'] }),
      { gasolineAutonomy: '9 Km/l', updatedAt: 'SERVER_TIMESTAMP' },
    );
    expect(mockedRunTransaction).not.toHaveBeenCalled();
  });

  it('never recreates a document when a patch races with remote deletion', async () => {
    const source = new FirestoreCarSettingsDataSource();
    mockedUpdateDoc.mockRejectedValueOnce(new Error('not-found'));

    await expect(source.saveFields('uid-b', { gasolineAutonomy: '9 Km/l' }, false)).rejects.toThrow(
      'not-found',
    );

    expect(mockedUpdateDoc).toHaveBeenCalledTimes(1);
    expect(mockedRunTransaction).not.toHaveBeenCalled();
    expect(mockTransactionSet).not.toHaveBeenCalled();
  });

  it('keeps updateDoc acknowledgement pending until Firestore resolves it', async () => {
    const source = new FirestoreCarSettingsDataSource();
    const pendingWrite = deferred<void>();
    mockedUpdateDoc.mockReturnValueOnce(pendingWrite.promise);

    let finished = false;
    const saving = source
      .saveFields('uid-b', { gasolineAutonomy: '9 Km/l' }, false)
      .then((result) => {
        finished = true;
        return result;
      });
    await Promise.resolve();
    expect(finished).toBe(false);

    pendingWrite.resolve();
    await expect(saving).resolves.toEqual({
      kind: 'patch',
      changes: { gasolineAutonomy: '9 Km/l' },
    });
  });

  it('waits for queued create transactions before submitting the newest patch', async () => {
    const source = new FirestoreCarSettingsDataSource();
    const firstTransaction = deferred<void>();
    const secondTransaction = deferred<void>();
    const firstStarted = deferred<void>();
    const secondStarted = deferred<void>();
    let editorMounted = true;
    let sessionActive = true;
    mockedRunTransaction
      .mockImplementationOnce(async () => {
        firstStarted.resolve();
        await firstTransaction.promise;
        return {
          kind: 'snapshot',
          settings: { ...EMPTY_CAR_SETTINGS, gasolineAutonomy: 'G1' },
        } as never;
      })
      .mockImplementationOnce(async () => {
        secondStarted.resolve();
        await secondTransaction.promise;
        return {
          kind: 'snapshot',
          settings: { ...EMPTY_CAR_SETTINGS, gasolineAutonomy: 'G2' },
        } as never;
      });

    const firstCreate = source.saveFields('uid-b', { gasolineAutonomy: 'G1' }, true);
    const secondCreate = source.saveFields('uid-b', { gasolineAutonomy: 'G2' }, true);
    const newestPatch = source.saveFields('uid-b', { gasolineAutonomy: 'G3' }, false, {
      canRun: () => editorMounted,
      canPersist: () => sessionActive,
    });
    await firstStarted.promise;
    firstTransaction.resolve();
    await secondStarted.promise;

    expect(mockedRunTransaction).toHaveBeenCalledTimes(2);
    expect(mockedUpdateDoc).not.toHaveBeenCalled();

    editorMounted = false;
    secondTransaction.resolve();
    await expect(Promise.all([firstCreate, secondCreate, newestPatch])).resolves.toEqual([
      expect.objectContaining({ kind: 'snapshot' }),
      expect.objectContaining({ kind: 'snapshot' }),
      { kind: 'patch', changes: { gasolineAutonomy: 'G3' } },
    ]);
    expect(mockedUpdateDoc).toHaveBeenCalledTimes(1);
  });

  it('cancels a barrier-waiting patch when its UID session changes', async () => {
    const source = new FirestoreCarSettingsDataSource();
    const transactionGate = deferred<void>();
    const transactionStarted = deferred<void>();
    let sessionActive = true;
    mockedRunTransaction.mockImplementationOnce(async () => {
      transactionStarted.resolve();
      await transactionGate.promise;
      return { kind: 'snapshot', settings: remoteSettings } as never;
    });

    const create = source.saveFields('uid-b', { gasolineAutonomy: 'G1' }, true, {
      canPersist: () => sessionActive,
    });
    const patch = source.saveFields('uid-b', { gasolineAutonomy: 'G2' }, false, {
      canRun: () => true,
      canPersist: () => sessionActive,
    });
    await transactionStarted.promise;
    sessionActive = false;
    transactionGate.resolve();
    await Promise.all([create, patch]);

    expect(mockedUpdateDoc).not.toHaveBeenCalled();
  });

  it('does not return an acknowledgement after the active session changes', async () => {
    const source = new FirestoreCarSettingsDataSource();
    const pendingWrite = deferred<void>();
    mockedUpdateDoc.mockReturnValueOnce(pendingWrite.promise);
    let sessionActive = true;

    const saving = source.saveFields('uid-b', { gasolineAutonomy: '9 Km/l' }, false, {
      canPersist: () => sessionActive,
    });
    await Promise.resolve();
    sessionActive = false;
    pendingWrite.resolve();

    await expect(saving).resolves.toBeUndefined();
  });

  it('revalidates the UID session after the transaction read and before writing', async () => {
    const source = new FirestoreCarSettingsDataSource();
    const transactionRead = deferred<{ exists: () => boolean }>();
    mockTransactionGet.mockReturnValueOnce(transactionRead.promise);
    let sessionActive = true;

    const pending = source.saveFields('uid-b', { gasolineAutonomy: '9 Km/l' }, true, {
      canRun: () => sessionActive,
      canPersist: () => sessionActive,
    });
    await Promise.resolve();
    await Promise.resolve();
    sessionActive = false;
    transactionRead.resolve({ exists: () => false });
    await pending;

    expect(mockTransactionSet).not.toHaveBeenCalled();
    expect(mockTransactionUpdate).not.toHaveBeenCalled();
  });

  it('submits a later update without waiting for an earlier offline ACK', async () => {
    const source = new FirestoreCarSettingsDataSource();
    const firstWrite = deferred<void>();
    mockedUpdateDoc.mockReturnValueOnce(firstWrite.promise).mockResolvedValueOnce(undefined);

    const first = source.saveFields('uid-b', { gasolineAutonomy: '9 Km/l' }, false);
    const second = source.saveFields('uid-b', { alcoholAutonomy: '6 Km/l' }, false);
    await Promise.resolve();
    await Promise.resolve();

    expect(mockedUpdateDoc).toHaveBeenCalledTimes(2);
    firstWrite.resolve();
    await Promise.all([first, second]);
    expect(mockedUpdateDoc).toHaveBeenCalledTimes(2);
  });

  it('continues queued writes after an earlier write fails', async () => {
    const source = new FirestoreCarSettingsDataSource();
    mockedUpdateDoc
      .mockRejectedValueOnce(new Error('temporary network failure'))
      .mockResolvedValueOnce(undefined);

    const failed = source.saveFields('uid-b', { gasolineAutonomy: '9 Km/l' }, false);
    const queued = source.saveFields('uid-b', { alcoholAutonomy: '6 Km/l' }, false);

    await expect(failed).rejects.toThrow('temporary network failure');
    await expect(queued).resolves.toEqual({
      kind: 'patch',
      changes: { alcoholAutonomy: '6 Km/l' },
    });
    expect(mockedUpdateDoc).toHaveBeenCalledTimes(2);
  });
});
