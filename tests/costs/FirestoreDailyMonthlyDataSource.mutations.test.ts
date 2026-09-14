import { deleteDoc, setDoc } from 'firebase/firestore';

import {
  FirestoreDailyMonthlyDataSource,
  type FirestoreMutationOptions,
} from '@/services/costs/FirestoreDailyMonthlyDataSource';

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((database, ...path: string[]) => ({ database, path })),
  deleteDoc: jest.fn(),
  deleteField: jest.fn(() => 'DELETE_FIELD'),
  doc: jest.fn((collectionReference, id: string) => ({ collectionReference, id })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
  setDoc: jest.fn(),
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
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('serializes two writes for the same daily record', async () => {
    const source = new FirestoreDailyMonthlyDataSource();
    const firstWrite = deferred<void>();
    const secondWrite = deferred<void>();
    mockSetDoc.mockReturnValueOnce(firstWrite.promise).mockReturnValueOnce(secondWrite.promise);

    const first = source.saveDaily('uid-a', '2026-09-02', values);
    await settle();
    const second = source.saveDaily('uid-a', '2026-09-02', { ...values, kilometers: '20' });
    await settle();

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    firstWrite.resolve();
    await settle();
    expect(mockSetDoc).toHaveBeenCalledTimes(2);

    secondWrite.resolve();
    await expect(first).resolves.toMatchObject({ data: '2026-09-02' });
    await expect(second).resolves.toMatchObject({ km: 20 });
  });

  it('uses the same queue for create, update and delete of one record', async () => {
    const source = new FirestoreDailyMonthlyDataSource();
    const firstWrite = deferred<void>();
    const secondWrite = deferred<void>();
    const deletion = deferred<void>();
    mockSetDoc.mockReturnValueOnce(firstWrite.promise).mockReturnValueOnce(secondWrite.promise);
    mockDeleteDoc.mockReturnValueOnce(deletion.promise);

    const create = source.saveDaily('uid-a', '2026-09-02', values);
    await settle();
    const update = source.saveDaily('uid-a', '2026-09-02', { ...values, kilometers: '20' });
    const remove = source.deleteDaily('uid-a', '2026-09-02');
    await settle();

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockDeleteDoc).not.toHaveBeenCalled();
    firstWrite.resolve();
    await settle();
    expect(mockSetDoc).toHaveBeenCalledTimes(2);
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
    mockSetDoc.mockReturnValueOnce(firstWrite.promise).mockReturnValueOnce(secondWrite.promise);

    const first = source.saveDaily('uid-a', '2026-09-02', values);
    const second = source.saveDaily('uid-a', '2026-09-04', values);
    await settle();

    expect(mockSetDoc).toHaveBeenCalledTimes(2);
    firstWrite.resolve();
    secondWrite.resolve();
    await expect(first).resolves.toBeDefined();
    await expect(second).resolves.toBeDefined();
  });

  it('recovers the queue after a rejected remote write', async () => {
    const source = new FirestoreDailyMonthlyDataSource();
    mockSetDoc.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);

    await expect(source.saveDaily('uid-a', '2026-09-02', values)).rejects.toThrow('offline');
    await expect(
      source.saveDaily('uid-a', '2026-09-02', { ...values, kilometers: '20' }),
    ).resolves.toBeDefined();
    expect(mockSetDoc).toHaveBeenCalledTimes(2);
  });

  it('does not start a remote write when local persistence failed', async () => {
    const source = new FirestoreDailyMonthlyDataSource();

    await expect(
      source.saveDaily('uid-a', '2026-09-02', values, { beforeWrite: Promise.resolve(false) }),
    ).resolves.toBeUndefined();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('does not start a stale session mutation', async () => {
    const source = new FirestoreDailyMonthlyDataSource();
    const options: FirestoreMutationOptions = { canRun: () => false };

    await expect(source.saveDaily('uid-a', '2026-09-02', values, options)).resolves.toBeUndefined();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('keeps an already-dispatched write bound to the original session after it becomes stale', async () => {
    const source = new FirestoreDailyMonthlyDataSource();
    const remoteWrite = deferred<void>();
    mockSetDoc.mockReturnValueOnce(remoteWrite.promise);
    let sessionActive = true;

    const pending = source.saveDaily('uid-a', '2026-09-02', values, {
      canRun: () => sessionActive,
    });
    await settle();

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const reference = mockSetDoc.mock.calls[0]?.[0] as unknown as {
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
    mockSetDoc.mockReturnValueOnce(updateWrite.promise);
    mockDeleteDoc.mockReturnValueOnce(deletion.promise);

    const update = source.saveDaily('uid-a', '2026-09-02', values);
    await settle();
    const remove = source.deleteDaily('uid-a', '2026-09-02');
    await settle();

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
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
    mockSetDoc.mockReturnValueOnce(updateWrite.promise);
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

    const payload = mockSetDoc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).toMatchObject({ data: '2026-09-02', km: 20 });
    expect(payload).not.toHaveProperty('gasolina');
    expect(payload).not.toHaveProperty('estar');
    expect(payload).not.toHaveProperty('precoGasolina');
  });

  it('writes a complete local-only record instead of reducing it to changed fields', async () => {
    const source = new FirestoreDailyMonthlyDataSource();

    await source.saveSettingsDiff(
      'uid-a',
      { periods: { day: {}, month: {}, year: {} } },
      { periods: { day: { '2026-09-02': values }, month: {}, year: {} } },
      { changes: [{ period: 'day', key: '2026-09-02', field: 'kilometers' }] },
    );

    const payload = mockSetDoc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).toMatchObject({ data: '2026-09-02', km: 10 });
    expect(payload).not.toHaveProperty('estar');
    expect(payload).toHaveProperty('precoGasolina', 6);
    expect(payload).toHaveProperty('tipoCombustivel', 'gasolina');
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
    mockSetDoc.mockImplementation(async (_reference, payload) => {
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

    const [document, payload, options] = mockSetDoc.mock.calls[0] ?? [];
    expect(document).toBeDefined();
    expect(payload).toMatchObject({ data: '2026-09-02', km: 20 });
    expect(payload).not.toHaveProperty('estar');
    expect(payload).not.toHaveProperty('gasolina');
    expect(payload).not.toHaveProperty('outros');
    expect(options).toEqual({ merge: true });
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
    mockSetDoc.mockReturnValueOnce(firstWrite.promise).mockResolvedValueOnce(undefined);
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
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
  });
});
