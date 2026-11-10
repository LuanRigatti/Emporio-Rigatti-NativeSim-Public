import { deleteDoc, doc, runTransaction, setDoc, updateDoc } from 'firebase/firestore';

import {
  FirestoreDailyMonthlyDataSource,
  type FirestoreMutationOptions,
} from '@/services/costs/FirestoreDailyMonthlyDataSource';

const mockTransactionGet = jest.fn();
const mockTransactionSet = jest.fn();
const mockTransactionUpdate = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((database, ...path: string[]) => ({ database, path })),
  deleteDoc: jest.fn(),
  deleteField: jest.fn(() => 'DELETE_FIELD'),
  doc: jest.fn((collectionReference, id: string) => ({ collectionReference, id })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
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
  where: jest.fn(),
}));

jest.mock('@/services/firebase/firestore', () => ({
  getFirebaseFirestore: jest.fn(() => ({ type: 'firestore' })),
}));

jest.mock('@/services/finance/FinancialPeriodSnapshotCache', () => ({
  financialPeriodSnapshotCache: { invalidate: jest.fn() },
}));

const mockSetDoc = jest.mocked(setDoc);
const mockDeleteDoc = jest.mocked(deleteDoc);
const mockRunTransaction = jest.mocked(runTransaction);
const mockUpdateDoc = jest.mocked(updateDoc);
const mockDoc = jest.mocked(doc);

const values = {
  estar: '',
  fuel: '',
  fuelPrice: '6',
  fuelType: 'gasolina',
  kilometers: '10',
  light: '',
  other: '',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, reject, resolve };
}

async function settle(): Promise<void> {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

describe('Firestore cost mutation ordering', () => {
  beforeEach(() => {
    mockSetDoc.mockReset().mockResolvedValue(undefined);
    mockDeleteDoc.mockReset().mockResolvedValue(undefined);
    mockRunTransaction.mockReset().mockImplementation(
      async (_database, operation) =>
        operation({
          get: mockTransactionGet,
          set: mockTransactionSet,
          update: mockTransactionUpdate,
        } as never) as never,
    );
    mockTransactionGet.mockReset().mockResolvedValue({ exists: () => false });
    mockTransactionSet.mockReset();
    mockTransactionUpdate.mockReset();
    mockUpdateDoc.mockReset().mockResolvedValue(undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('serializes two writes for the same daily record', async () => {
    const source = new FirestoreDailyMonthlyDataSource();
    const firstWrite = deferred<void>();
    const secondWrite = deferred<void>();
    mockRunTransaction.mockReturnValueOnce(firstWrite.promise).mockReturnValueOnce(secondWrite.promise);

    const first = source.saveDaily('uid-a', '2026-09-02', values);
    await settle();
    const second = source.saveDaily('uid-a', '2026-09-02', { ...values, kilometers: '20' });
    await settle();

    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    firstWrite.resolve();
    await settle();
    expect(mockRunTransaction).toHaveBeenCalledTimes(2);

    secondWrite.resolve();
    await expect(first).resolves.toMatchObject({ data: '2026-09-02' });
    await expect(second).resolves.toMatchObject({ km: 20 });
  });

  it('uses the same queue for create, update and delete of one record', async () => {
    const source = new FirestoreDailyMonthlyDataSource();
    const firstWrite = deferred<void>();
    const secondWrite = deferred<void>();
    const deletion = deferred<void>();
    mockRunTransaction.mockReturnValueOnce(firstWrite.promise).mockReturnValueOnce(secondWrite.promise);
    mockDeleteDoc.mockReturnValueOnce(deletion.promise);

    const create = source.saveDaily('uid-a', '2026-09-02', values);
    await settle();
    const update = source.saveDaily('uid-a', '2026-09-02', { ...values, kilometers: '20' });
    const remove = source.deleteDaily('uid-a', '2026-09-02');
    await settle();

    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    expect(mockDeleteDoc).not.toHaveBeenCalled();
    firstWrite.resolve();
    await settle();
    expect(mockRunTransaction).toHaveBeenCalledTimes(2);
    expect(mockDeleteDoc).not.toHaveBeenCalled();
    secondWrite.resolve();
    await settle();
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    deletion.resolve();

    await expect(create).resolves.toBeDefined();
    await expect(update).resolves.toBeDefined();
    await expect(remove).resolves.toBeUndefined();
  });

  it('allows writes for independent records to proceed in parallel', async () => {
    const source = new FirestoreDailyMonthlyDataSource();
    const firstWrite = deferred<void>();
    const secondWrite = deferred<void>();
    mockRunTransaction.mockReturnValueOnce(firstWrite.promise).mockReturnValueOnce(secondWrite.promise);

    const first = source.saveDaily('uid-a', '2026-09-02', values);
    const second = source.saveDaily('uid-a', '2026-09-04', values);
    await settle();

    expect(mockRunTransaction).toHaveBeenCalledTimes(2);
    firstWrite.resolve();
    secondWrite.resolve();
    await expect(first).resolves.toBeDefined();
    await expect(second).resolves.toBeDefined();
  });

  it('recovers the queue after a rejected remote write', async () => {
    const source = new FirestoreDailyMonthlyDataSource();
    mockRunTransaction.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);

    await expect(source.saveDaily('uid-a', '2026-09-02', values)).rejects.toThrow('offline');
    await expect(
      source.saveDaily('uid-a', '2026-09-02', { ...values, kilometers: '20' }),
    ).resolves.toBeDefined();
    expect(mockRunTransaction).toHaveBeenCalledTimes(2);
  });

  it('does not start a remote write when local persistence failed', async () => {
    const source = new FirestoreDailyMonthlyDataSource();

    await expect(
      source.saveDaily('uid-a', '2026-09-02', values, { beforeWrite: Promise.resolve(false) }),
    ).resolves.toBeUndefined();
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it('does not start a stale session mutation', async () => {
    const source = new FirestoreDailyMonthlyDataSource();
    const options: FirestoreMutationOptions = { canRun: () => false };

    await expect(source.saveDaily('uid-a', '2026-09-02', values, options)).resolves.toBeUndefined();
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it('keeps an already-dispatched write bound to the original session after it becomes stale', async () => {
    const source = new FirestoreDailyMonthlyDataSource();
    const remoteWrite = deferred<void>();
    mockRunTransaction.mockReturnValueOnce(remoteWrite.promise);
    let sessionActive = true;

    const pending = source.saveDaily('uid-a', '2026-09-02', values, {
      canRun: () => sessionActive,
    });
    await settle();

    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    const reference = mockDoc.mock.results.at(-1)?.value as unknown as {
      collectionReference: { path: string[] };
      id: string;
    };
    expect(reference.collectionReference.path).toEqual(['users', 'uid-a', 'dailyData']);
    expect(reference.id).toBe('2026-09-02');

    sessionActive = false;
    remoteWrite.resolve();

    await expect(pending).resolves.toMatchObject({ data: '2026-09-02' });
    const internal = source as unknown as {
      daily: Map<string, Map<string, unknown>>;
    };
    expect(internal.daily.get('uid-a')?.has('2026-09-02')).toBe(false);
  });

  it('starts a delete only after the preceding update for the same record resolves', async () => {
    const source = new FirestoreDailyMonthlyDataSource();
    const updateWrite = deferred<void>();
    const deletion = deferred<void>();
    mockRunTransaction.mockReturnValueOnce(updateWrite.promise);
    mockDeleteDoc.mockReturnValueOnce(deletion.promise);

    const update = source.saveDaily('uid-a', '2026-09-02', values);
    await settle();
    const remove = source.deleteDaily('uid-a', '2026-09-02');
    await settle();

    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    expect(mockDeleteDoc).not.toHaveBeenCalled();

    updateWrite.resolve();
    await settle();
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);

    deletion.resolve();
    await expect(update).resolves.toBeDefined();
    await expect(remove).resolves.toBeUndefined();

    const internal = source as unknown as {
      daily: Map<string, Map<string, unknown>>;
    };
    expect(internal.daily.get('uid-a')?.has('2026-09-02')).toBe(false);
  });

  it('drops a queued delete when its session becomes stale before dispatch', async () => {
    const source = new FirestoreDailyMonthlyDataSource();
    const updateWrite = deferred<void>();
    mockRunTransaction.mockReturnValueOnce(updateWrite.promise);
    let sessionActive = true;

    const update = source.saveDaily('uid-a', '2026-09-02', values, {
      canRun: () => sessionActive,
    });
    await settle();
    const remove = source.deleteDaily('uid-a', '2026-09-02', {
      canRun: () => sessionActive,
    });

    sessionActive = false;
    updateWrite.resolve();
    await settle();

    await expect(update).resolves.toBeDefined();
    await expect(remove).resolves.toBeUndefined();
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });

  it('does not remove local state when an already-dispatched delete resolves after its session ends', async () => {
    const source = new FirestoreDailyMonthlyDataSource();
    await source.saveDaily('uid-a', '2026-09-02', values);

    const deletion = deferred<void>();
    mockDeleteDoc.mockReturnValueOnce(deletion.promise);
    let sessionActive = true;
    const pending = source.deleteDaily('uid-a', '2026-09-02', {
      canRun: () => sessionActive,
    });
    await settle();

    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    const reference = mockDeleteDoc.mock.calls[0]?.[0] as unknown as {
      collectionReference: { path: string[] };
      id: string;
    };
    expect(reference.collectionReference.path).toEqual(['users', 'uid-a', 'dailyData']);
    expect(reference.id).toBe('2026-09-02');

    sessionActive = false;
    deletion.resolve();
    await expect(pending).resolves.toBeUndefined();

    const internal = source as unknown as {
      daily: Map<string, Map<string, unknown>>;
    };
    expect(internal.daily.get('uid-a')?.has('2026-09-02')).toBe(true);
  });

  it('writes only explicitly changed daily fields when a remote record already exists', async () => {
    const source = new FirestoreDailyMonthlyDataSource();
    await source.saveDaily('uid-a', '2026-09-02', { ...values, fuel: '50' });
    mockSetDoc.mockClear();

    await source.saveSettingsDiff(
      'uid-a',
      { periods: { day: { '2026-09-02': { ...values, fuel: '50' } }, month: {}, year: {} } },
      {
        periods: {
          day: { '2026-09-02': { ...values, kilometers: '20', fuel: '' } },
          month: {},
          year: {},
        },
      },
      {
        changes: [{ period: 'day', key: '2026-09-02', field: 'kilometers' }],
      },
    );

    const payload = mockUpdateDoc.mock.calls[0]?.[1] as unknown as Record<string, unknown>;
    expect(payload).toMatchObject({ data: '2026-09-02', km: 20 });
    expect(payload).not.toHaveProperty('gasolina');
    expect(payload).not.toHaveProperty('estar');
    expect(payload).not.toHaveProperty('precoGasolina');
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('creates a new record from only explicitly changed valid fields', async () => {
    const source = new FirestoreDailyMonthlyDataSource();

    await source.saveSettingsDiff(
      'uid-a',
      { periods: { day: {}, month: {}, year: {} } },
      { periods: { day: { '2026-09-02': values }, month: {}, year: {} } },
      { changes: [{ period: 'day', key: '2026-09-02', field: 'kilometers' }] },
    );

    const payload = mockTransactionSet.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).toMatchObject({ data: '2026-09-02', km: 10 });
    expect(payload).not.toHaveProperty('estar');
    expect(payload).not.toHaveProperty('precoGasolina');
    expect(payload).not.toHaveProperty('tipoCombustivel');
    expect(mockTransactionSet).toHaveBeenCalledTimes(1);
    expect(mockTransactionSet.mock.calls[0]).toHaveLength(2);
    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('does not replay stale cache when there is no explicit pending change', async () => {
    const source = new FirestoreDailyMonthlyDataSource();

    await source.saveSettingsDiff(
      'uid-a',
      { periods: { day: {}, month: {}, year: {} } },
      { periods: { day: { '2026-09-02': values }, month: {}, year: {} } },
      { changes: [] },
    );

    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });

  it('does not create a new record for an empty or invalid explicit value', async () => {
    const source = new FirestoreDailyMonthlyDataSource();

    await source.saveSettingsDiff(
      'uid-a',
      { periods: { day: {}, month: {}, year: {} } },
      {
        periods: {
          day: {
            '2026-09-02': { ...values, kilometers: '', fuelPrice: 'not-a-number' },
          },
          month: {},
          year: {},
        },
      },
      { changes: [{ period: 'day', key: '2026-09-02', field: 'kilometers' }] },
    );

    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('patches an explicit field when a concurrent creator wins before the transaction', async () => {
    const source = new FirestoreDailyMonthlyDataSource();
    mockTransactionGet.mockResolvedValueOnce({ exists: () => true });

    await source.saveSettingsDiff(
      'uid-a',
      { periods: { day: {}, month: {}, year: {} } },
      { periods: { day: { '2026-09-02': values }, month: {}, year: {} } },
      { changes: [{ period: 'day', key: '2026-09-02', field: 'kilometers' }] },
    );

    expect(mockTransactionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: '2026-09-02' }),
      expect.objectContaining({ data: '2026-09-02', km: 10 }),
    );
    expect(mockTransactionSet).not.toHaveBeenCalled();
  });

  it('deletes before recreating and writes a sparse replacement after the delete ACK', async () => {
    const source = new FirestoreDailyMonthlyDataSource();
    const deletion = deferred<void>();
    mockDeleteDoc.mockReturnValueOnce(deletion.promise);
    const previous = {
      periods: {
        day: { '2026-09-02': { ...values, fuel: 'old fuel', other: 'old other' } },
        month: {},
        year: {},
      },
    };
    const next = {
      periods: {
        day: { '2026-09-02': { ...values, kilometers: '22', fuel: '', other: '' } },
        month: {},
        year: {},
      },
    };

    const pending = source.saveSettingsDiff('uid-a', previous, next, {
      changes: [
        { period: 'day', key: '2026-09-02', deleted: true, revision: 1 },
        { period: 'day', key: '2026-09-02', field: 'kilometers', revision: 2 },
      ],
    });
    await settle();

    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    expect(mockRunTransaction).not.toHaveBeenCalled();
    deletion.resolve();
    await pending;

    const payload = mockTransactionSet.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).toMatchObject({ data: '2026-09-02', km: 22 });
    expect(payload).not.toHaveProperty('gasolina');
    expect(payload).not.toHaveProperty('outros');
    expect(mockTransactionSet.mock.calls[0]).toHaveLength(2);
    expect(mockTransactionUpdate).not.toHaveBeenCalled();
  });

  it('does not recreate after the explicit deletion fails', async () => {
    const source = new FirestoreDailyMonthlyDataSource();
    mockDeleteDoc.mockRejectedValueOnce(new Error('delete failed'));

    await expect(
      source.saveSettingsDiff(
        'uid-a',
        { periods: { day: { '2026-09-02': values }, month: {}, year: {} } },
        {
          periods: {
            day: { '2026-09-02': { ...values, kilometers: '22' } },
            month: {},
            year: {},
          },
        },
        {
          changes: [
            { period: 'day', key: '2026-09-02', deleted: true, revision: 1 },
            { period: 'day', key: '2026-09-02', field: 'kilometers', revision: 2 },
          ],
        },
      ),
    ).rejects.toThrow('delete failed');

    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    expect(mockRunTransaction).not.toHaveBeenCalled();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('honors an explicit deletion when the captured snapshot lacks the record', async () => {
    const source = new FirestoreDailyMonthlyDataSource();

    await source.saveSettingsDiff(
      'uid-a',
      { periods: { day: {}, month: {}, year: {} } },
      { periods: { day: {}, month: {}, year: {} } },
      { changes: [{ period: 'day', key: '2026-09-02', deleted: true, revision: 1 }] },
    );

    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it('rechecks the session after a transaction read and skips a stale write', async () => {
    const source = new FirestoreDailyMonthlyDataSource();
    const transactionRead = deferred<{ exists: () => boolean }>();
    mockTransactionGet.mockReturnValueOnce(transactionRead.promise);
    let sessionActive = true;
    const pending = source.saveSettingsDiff(
      'uid-a',
      { periods: { day: {}, month: {}, year: {} } },
      { periods: { day: { '2026-09-02': values }, month: {}, year: {} } },
      {
        canRun: () => sessionActive,
        changes: [{ period: 'day', key: '2026-09-02', field: 'kilometers' }],
      },
    );
    await settle();
    sessionActive = false;
    transactionRead.resolve({ exists: () => false });
    await pending;

    expect(mockTransactionSet).not.toHaveBeenCalled();
    expect(mockTransactionUpdate).not.toHaveBeenCalled();
  });

  it('does not recreate a record if an existing-record patch races with remote deletion', async () => {
    const source = new FirestoreDailyMonthlyDataSource();
    mockUpdateDoc.mockRejectedValueOnce(new Error('not-found'));

    await expect(
      source.saveSettingsDiff(
        'uid-a',
        {
          periods: {
            day: { '2026-09-02': values },
            month: {},
            year: {},
          },
        },
        {
          periods: {
            day: { '2026-09-02': { ...values, kilometers: '20' } },
            month: {},
            year: {},
          },
        },
        { changes: [{ period: 'day', key: '2026-09-02', field: 'kilometers' }] },
      ),
    ).rejects.toThrow('not-found');

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('does not delete unknown remote fields when a partial snapshot misses a record', async () => {
    const source = new FirestoreDailyMonthlyDataSource();
    const localValues = { ...values, kilometers: '20', fuel: '', estar: '', other: '' };
    const remoteDocument: Record<string, unknown> = {
      data: '2026-09-02',
      estar: 11,
      gasolina: 22,
      km: 10,
      outros: 33,
      precoGasolina: 6,
      tipoCombustivel: 'gasolina',
    };
    mockTransactionGet.mockResolvedValueOnce({ exists: () => true });
    mockTransactionUpdate.mockImplementation((_reference, payload) => {
      for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
        if (key === 'updatedAt') continue;
        if (value === 'DELETE_FIELD') delete remoteDocument[key];
        else remoteDocument[key] = value;
      }
    });

    await source.saveSettingsDiff(
      'uid-a',
      { periods: { day: {}, month: {}, year: {} } },
      { periods: { day: { '2026-09-02': localValues }, month: {}, year: {} } },
      { changes: [{ period: 'day', key: '2026-09-02', field: 'kilometers' }] },
    );

    const [document, payload] = mockTransactionUpdate.mock.calls[0] ?? [];
    expect(document).toBeDefined();
    expect(payload).toMatchObject({ data: '2026-09-02', km: 20 });
    expect(payload).not.toHaveProperty('estar');
    expect(payload).not.toHaveProperty('gasolina');
    expect(payload).not.toHaveProperty('outros');
    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(remoteDocument).toMatchObject({
      estar: 11,
      gasolina: 22,
      km: 20,
      outros: 33,
      precoGasolina: 6,
      tipoCombustivel: 'gasolina',
    });
  });

  it('drops a queued mutation from an older session before it starts', async () => {
    const source = new FirestoreDailyMonthlyDataSource();
    const firstWrite = deferred<void>();
    mockRunTransaction.mockReturnValueOnce(firstWrite.promise).mockResolvedValueOnce(undefined);
    let oldSessionActive = true;

    const first = source.saveDaily('uid-a', '2026-09-02', values, {
      canRun: () => oldSessionActive,
    });
    await settle();
    const queued = source.saveDaily(
      'uid-a',
      '2026-09-02',
      { ...values, kilometers: '20' },
      { canRun: () => oldSessionActive },
    );

    oldSessionActive = false;
    firstWrite.resolve();
    await settle();

    await expect(first).resolves.toBeDefined();
    await expect(queued).resolves.toBeUndefined();
    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
  });

  it('keeps an explicit delete and recreation atomic with concurrent same-record edits', async () => {
    const source = new FirestoreDailyMonthlyDataSource();
    const deletion = deferred<void>();
    const replacement = deferred<void>();
    mockDeleteDoc.mockReturnValueOnce(deletion.promise);
    mockRunTransaction.mockReturnValueOnce(replacement.promise);

    const previous = {
      periods: { day: { '2026-09-02': values }, month: {}, year: {} },
    };
    const next = {
      periods: {
        day: { '2026-09-02': { ...values, kilometers: '22' } },
        month: {},
        year: {},
      },
    };
    const replace = source.saveSettingsDiff('uid-a', previous, next, {
      changes: [
        { period: 'day', key: '2026-09-02', deleted: true, revision: 1 },
        { period: 'day', key: '2026-09-02', field: 'kilometers', revision: 2 },
      ],
    });
    await settle();
    const concurrentEdit = source.saveDaily('uid-a', '2026-09-02', {
      ...values,
      kilometers: '30',
    });

    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    expect(mockRunTransaction).not.toHaveBeenCalled();
    deletion.resolve();
    await settle();
    expect(mockRunTransaction).toHaveBeenCalledTimes(1);

    replacement.resolve();
    await settle();
    expect(mockRunTransaction).toHaveBeenCalledTimes(2);
    await Promise.all([replace, concurrentEdit]);
  });

  it('does not fall back to a creating merge when an expected existing record is missing', async () => {
    const source = new FirestoreDailyMonthlyDataSource();
    const missing = Object.assign(new Error('missing'), { code: 'not-found' });
    mockUpdateDoc.mockRejectedValueOnce(missing);

    await expect(
      source.saveDaily('uid-a', '2026-09-02', values, { createIfMissing: false }),
    ).rejects.toThrow('foi excluído do servidor');

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it('creates a new monthly record only after the transaction confirms it is absent', async () => {
    const source = new FirestoreDailyMonthlyDataSource();
    mockTransactionGet.mockResolvedValueOnce({ exists: () => false });

    await source.saveMonthly('uid-a', '2026-09', { ...values, light: '125' });

    expect(mockTransactionGet).toHaveBeenCalledTimes(1);
    expect(mockTransactionSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ month: '2026-09', luz: 125 }),
    );
    expect(mockTransactionUpdate).not.toHaveBeenCalled();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('does not recreate an expected existing monthly record deleted remotely', async () => {
    const source = new FirestoreDailyMonthlyDataSource();
    const missing = Object.assign(new Error('missing'), { code: 'not-found' });
    mockUpdateDoc.mockRejectedValueOnce(missing);

    await expect(
      source.saveMonthly('uid-a', '2026-09', { ...values, light: '125' }, {
        createIfMissing: false,
      }),
    ).rejects.toThrow('foi excluído do servidor');

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });
});
