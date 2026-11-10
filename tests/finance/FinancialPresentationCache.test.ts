import {
  createFinancialPresentationScopeKey,
  FinancialPresentationCache,
  type FinancialPresentationValues,
} from '@/services/finance/FinancialPresentationCache';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  removeItem: jest.fn(),
  setItem: jest.fn(),
}));

type TestEnvironment = {
  environment: 'development' | 'production';
  firebaseProjectId: string;
};

const environment = {
  environment: 'development' as const,
  firebaseProjectId: 'demo-financial-presentation',
};

const monthSelection = { kind: 'month' as const, month: '2026-11' };
const monthFilters = { periodo: 'mes' as const, mesSelecionado: '2026-11' };
const scopeKey = createFinancialPresentationScopeKey(monthSelection, monthFilters);

const values: FinancialPresentationValues = {
  faturamento: 1907.7,
  lucroLiquido: -44.25,
  faturamentoComparison: {
    atual: 1907.7,
    anterior: 1750,
    diferenca: 157.7,
    percentual: 9.01,
    subiu: true,
  },
  lucroLiquidoComparison: {
    atual: -44.25,
    anterior: 20,
    diferenca: -64.25,
    percentual: -321.25,
    subiu: false,
  },
  summary: {
    quantidadeBaldes: 12,
    lucroBruto: 840,
    valoresPagos: 1500,
    valoresPendentes: 407.7,
    custoTotalBaldes: 450,
    custoCombustivel: 36,
    custoOutros: 12,
    custoLuz: 18,
    custoMedioCombustivelPorEntrega: 3,
    margemBruta: 44.1,
    margemLiquida: -2.3,
    precoMedioBalde: 158.98,
    lucroLiquidoPorBalde: -3.69,
    custoMedioBalde: 37.5,
  },
};

function createStorage() {
  const valuesByKey = new Map<string, string>();
  const storage = {
    getItem: jest.fn(async (key: string) => valuesByKey.get(key) ?? null),
    removeItem: jest.fn(async (key: string) => {
      valuesByKey.delete(key);
    }),
    setItem: jest.fn(async (key: string, value: string) => {
      valuesByKey.set(key, value);
    }),
  };
  return { storage, valuesByKey };
}

function makeCache(
  storage: ReturnType<typeof createStorage>['storage'],
  getEnvironment: () => TestEnvironment | null = () => environment,
) {
  return new FinancialPresentationCache(storage, getEnvironment);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe('FinancialPresentationCache', () => {
  it('restores both displayed values and comparisons from a fresh cache instance', async () => {
    const { storage } = createStorage();
    const firstProcess = makeCache(storage);
    await firstProcess.write('uid-a', scopeKey, values);

    const restartedProcess = makeCache(storage);
    await expect(restartedProcess.read('uid-a', scopeKey)).resolves.toMatchObject({
      faturamento: values.faturamento,
      lucroLiquido: values.lucroLiquido,
      faturamentoComparison: values.faturamentoComparison,
      lucroLiquidoComparison: values.lucroLiquidoComparison,
      summary: values.summary,
    });
  });

  it('accepts zero revenue and a negative net profit as displayed values', async () => {
    const { storage } = createStorage();
    const cache = makeCache(storage);
    const zeroAndLoss: FinancialPresentationValues = {
      faturamento: 0,
      lucroLiquido: -1,
      faturamentoComparison: null,
      lucroLiquidoComparison: null,
      summary: { ...values.summary },
    };

    await cache.write('uid-a', scopeKey, zeroAndLoss);

    await expect(makeCache(storage).read('uid-a', scopeKey)).resolves.toMatchObject(zeroAndLoss);
  });

  it('misses for another UID, project, environment, filter set, or period', async () => {
    const { storage } = createStorage();
    await makeCache(storage).write('uid-a', scopeKey, values);

    await expect(makeCache(storage).read('uid-b', scopeKey)).resolves.toBeNull();
    await expect(
      makeCache(storage, () => ({ ...environment, firebaseProjectId: 'another-demo' })).read(
        'uid-a',
        scopeKey,
      ),
    ).resolves.toBeNull();
    await expect(
      makeCache(storage, () => ({ ...environment, environment: 'production' })).read(
        'uid-a',
        scopeKey,
      ),
    ).resolves.toBeNull();
    await expect(
      makeCache(storage).read('uid-a', `${scopeKey}:different-filter`),
    ).resolves.toBeNull();

    const filteredScope = createFinancialPresentationScopeKey(monthSelection, {
      ...monthFilters,
      clientId: 'client-1' as never,
    });
    const dailyScope = createFinancialPresentationScopeKey(
      { kind: 'day', date: '2026-11-06' },
      { periodo: 'dia', diaSelecionado: '2026-11-06' },
    );
    expect(filteredScope).not.toBe(scopeKey);
    expect(dailyScope).not.toBe(scopeKey);
  });

  it('does not restore an incompatible cache or malformed numbers', async () => {
    const { storage, valuesByKey } = createStorage();
    const cache = makeCache(storage);
    await cache.write('uid-a', scopeKey, values);
    const key = [...valuesByKey.keys()][0] as string;
    const entry = JSON.parse(valuesByKey.get(key) as string) as Record<string, unknown>;

    const legacyV1Entry: Record<string, unknown> = { ...entry, cacheVersion: 1 };
    delete legacyV1Entry.summary;
    valuesByKey.set(key, JSON.stringify(legacyV1Entry));
    await expect(makeCache(storage).read('uid-a', scopeKey)).resolves.toBeNull();
    await expect(makeCache(storage).readWithStatus('uid-a', scopeKey)).resolves.toEqual({
      status: 'miss',
      reason: 'cache_version_mismatch',
    });

    valuesByKey.set(key, JSON.stringify({ ...entry, rulesVersion: 0 }));
    await expect(makeCache(storage).read('uid-a', scopeKey)).resolves.toBeNull();

    const serialized = JSON.stringify(entry);
    const nonFiniteNumber = serialized.replace('"faturamento":1907.7', '"faturamento":1e999');
    expect(nonFiniteNumber).not.toBe(serialized);
    valuesByKey.set(key, nonFiniteNumber);
    await expect(makeCache(storage).read('uid-a', scopeKey)).resolves.toBeNull();

    const incompleteSummary = { ...entry, summary: { ...values.summary } };
    delete (incompleteSummary.summary as Record<string, unknown>).custoLuz;
    valuesByKey.set(key, JSON.stringify(incompleteSummary));
    await expect(makeCache(storage).readWithStatus('uid-a', scopeKey)).resolves.toEqual({
      status: 'miss',
      reason: 'invalid_values',
    });
  });

  it('treats a local storage read failure as a cache miss', async () => {
    const { storage } = createStorage();
    storage.getItem.mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(makeCache(storage).read('uid-a', scopeKey)).resolves.toBeNull();
    storage.getItem.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(makeCache(storage).readWithStatus('uid-a', scopeKey)).resolves.toEqual({
      status: 'miss',
      reason: 'storage_failure',
    });
  });

  it('reports an empty store explicitly and stores only the displayed aggregate allowlist', async () => {
    const { storage, valuesByKey } = createStorage();
    const cache = makeCache(storage);
    await expect(cache.readWithStatus('uid-a', scopeKey)).resolves.toEqual({
      status: 'miss',
      reason: 'no_record',
    });

    await cache.write('uid-a', scopeKey, values);
    const record = JSON.parse([...valuesByKey.values()][0] as string) as Record<string, unknown>;
    expect(record.summary).toEqual(values.summary);
    expect(record.summary).not.toHaveProperty('quantidadeEntregas');
    expect(record.summary).not.toHaveProperty('custoTotal');
    expect(Object.keys(record.summary as object)).toHaveLength(14);
  });

  it('returns a redacted failure result when persistent writing fails', async () => {
    const { storage } = createStorage();
    storage.setItem.mockRejectedValueOnce(new Error('local storage unavailable'));

    await expect(makeCache(storage).writeWithStatus('uid-a', scopeKey, values)).resolves.toEqual({
      status: 'failed',
      reason: 'storage_failure',
    });
  });

  it('writes only when displayed values change', async () => {
    const { storage } = createStorage();
    const cache = makeCache(storage);

    await cache.write('uid-a', scopeKey, values);
    await cache.write('uid-a', scopeKey, { ...values });
    await cache.write('uid-a', scopeKey, { ...values, faturamento: 1908 });

    expect(storage.setItem).toHaveBeenCalledTimes(2);
  });

  it('cancels writes queued before logout and prevents a write in another session', async () => {
    const { storage, valuesByKey } = createStorage();
    const cache = makeCache(storage);
    const queuedWrite = cache.write('uid-a', scopeKey, values);
    const clear = cache.clearForUser('uid-a');

    await Promise.all([queuedWrite, clear]);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).toHaveBeenCalledTimes(1);
    await expect(makeCache(storage).read('uid-a', scopeKey)).resolves.toBeNull();
    expect(valuesByKey.size).toBe(0);
  });

  it('discards a cache read that completes after logout invalidates its generation', async () => {
    const { storage, valuesByKey } = createStorage();
    const cache = makeCache(storage);
    await cache.write('uid-a', scopeKey, values);
    const serialized = [...valuesByKey.values()][0] as string;
    const lateRead = deferred<string | null>();
    storage.getItem.mockImplementation(() => lateRead.promise);

    const read = cache.read('uid-a', scopeKey);
    await Promise.resolve();
    const clear = cache.clearForUser('uid-a');
    lateRead.resolve(serialized);

    await expect(read).resolves.toBeNull();
    await clear;
  });

  it('serializes logout after an in-flight write and makes concurrent clears idempotent', async () => {
    const { storage } = createStorage();
    const cache = makeCache(storage);
    const setStarted = deferred<void>();
    const finishSet = deferred<void>();
    const persist = storage.setItem.getMockImplementation();
    if (!persist) throw new Error('Expected in-memory setItem implementation.');
    storage.setItem.mockImplementation(async (key, value) => {
      setStarted.resolve();
      await finishSet.promise;
      await persist(key, value);
    });

    const write = cache.write('uid-a', scopeKey, values);
    await setStarted.promise;
    const firstClear = cache.clearForUser('uid-a');
    const concurrentClear = cache.clearForUser('uid-a');
    expect(concurrentClear).toBe(firstClear);

    finishSet.resolve();
    await Promise.all([write, firstClear]);

    expect(storage.removeItem).toHaveBeenCalledTimes(1);
    await expect(makeCache(storage).read('uid-a', scopeKey)).resolves.toBeNull();
  });

  it('fails closed after storage deletion fails and leaves no restorable envelope when possible', async () => {
    const { storage } = createStorage();
    const cache = makeCache(storage);
    await cache.write('uid-a', scopeKey, values);
    storage.removeItem.mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(cache.clearForUser('uid-a')).rejects.toThrow('storage unavailable');
    expect(storage.setItem).toHaveBeenLastCalledWith(expect.any(String), '');
    await expect(makeCache(storage).read('uid-a', scopeKey)).resolves.toBeNull();
    await expect(cache.read('uid-a', scopeKey)).resolves.toBeNull();
  });

  it('does not write when its session guard has become stale', async () => {
    const { storage } = createStorage();
    await makeCache(storage).write('uid-a', scopeKey, values, () => false);

    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
