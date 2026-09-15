import AsyncStorage from '@react-native-async-storage/async-storage';

import { calculateFinancialFuelCostsByDate } from '@/services/expenses/FinancialFuelCostService';
import {
  getRouteTrackingHistoryStorageKey,
  getRouteTrackingLegacyClaimStorageKey,
  routeTrackingRepository,
  ROUTE_TRACKING_HISTORY_STORAGE_KEY,
  ROUTE_TRACKING_STORAGE_KEY,
} from '@/services/routes/RouteTrackingRepository';
import { summarizeRouteDistance } from '@/services/routes/routeTrackingDistance';
import type { RouteTrackingSession } from '@/types/routeTracking';

const mockStorage = new Map<string, string>();
const legacyHistoryKey = ROUTE_TRACKING_HISTORY_STORAGE_KEY;

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    clear: jest.fn(() => {
      mockStorage.clear();
      return Promise.resolve();
    }),
    getItem: jest.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
    removeItem: jest.fn((key: string) => {
      mockStorage.delete(key);
      return Promise.resolve();
    }),
    setItem: jest.fn((key: string, value: string) => {
      mockStorage.set(key, value);
      return Promise.resolve();
    }),
  },
}));

const UID_A = 'uid-a';
const UID_B = 'uid-b';

function legacySession(
  id: string,
  overrides: Partial<RouteTrackingSession> = {},
): RouteTrackingSession {
  return {
    date: '2026-09-06',
    distanceMeters: 10_000,
    durationSeconds: 60,
    endTimestamp: 2_000,
    id,
    pointsCount: 2,
    samples: [
      { accuracy: 10, latitude: -25.4296, longitude: -49.2719, timestamp: 1_000 },
      { accuracy: 10, latitude: -25.4305, longitude: -49.2719, timestamp: 2_000 },
    ],
    startTimestamp: 1_000,
    status: 'finalized',
    ...overrides,
  };
}

function ownedSession(id: string, ownerUid: string, overrides: Partial<RouteTrackingSession> = {}) {
  return { ...legacySession(id, overrides), ownerUid };
}

function defer<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

function installDefaultStorageMocks() {
  jest
    .mocked(AsyncStorage.getItem)
    .mockImplementation((key: string) => Promise.resolve(mockStorage.get(key) ?? null));
  jest.mocked(AsyncStorage.setItem).mockImplementation((key: string, value: string) => {
    mockStorage.set(key, value);
    return Promise.resolve();
  });
  jest.mocked(AsyncStorage.removeItem).mockImplementation((key: string) => {
    mockStorage.delete(key);
    return Promise.resolve();
  });
}

async function readJson<T>(key: string): Promise<T | null> {
  const value = await AsyncStorage.getItem(key);
  return value ? (JSON.parse(value) as T) : null;
}

describe('legacy route history claim', () => {
  beforeEach(async () => {
    installDefaultStorageMocks();
    mockStorage.clear();
    jest.clearAllMocks();
    routeTrackingRepository.setSessionUser(null, 0);
    routeTrackingRepository.setSessionUser(UID_A, 1);
  });

  it('reports no claimable history when the legacy key is absent', async () => {
    await expect(routeTrackingRepository.getLegacyRouteHistoryStatus()).resolves.toEqual({
      available: false,
      claimed: false,
      fingerprint: null,
      sessionCount: 0,
    });
    await expect(routeTrackingRepository.claimLegacyRouteHistory()).rejects.toThrow(
      'Não há histórico legado válido',
    );
  });

  it('ignores invalid legacy history safely', async () => {
    await AsyncStorage.setItem(legacyHistoryKey, JSON.stringify({ invalid: true }));

    await expect(routeTrackingRepository.getLegacyRouteHistoryStatus()).resolves.toMatchObject({
      available: false,
      sessionCount: 0,
    });
    await expect(routeTrackingRepository.claimLegacyRouteHistory()).rejects.toThrow(
      'Não há histórico legado válido',
    );
  });

  it('detects valid legacy history without changing storage or memory history', async () => {
    const history = [legacySession('legacy-a')];
    const serialized = JSON.stringify(history);
    await AsyncStorage.setItem(legacyHistoryKey, serialized);
    jest.mocked(AsyncStorage.setItem).mockClear();

    const status = await routeTrackingRepository.getLegacyRouteHistoryStatus();

    expect(status.available).toBe(true);
    expect(status.claimed).toBe(false);
    expect(status.sessionCount).toBe(1);
    expect(status.fingerprint).toEqual(expect.any(String));
    expect(routeTrackingRepository.getMemoryRouteHistory()).toBeNull();
    expect(jest.mocked(AsyncStorage.setItem)).not.toHaveBeenCalled();
    await expect(AsyncStorage.getItem(legacyHistoryKey)).resolves.toBe(serialized);
  });

  it('does not adopt a legacy active route during detection or claim', async () => {
    const activeRoute = {
      ...{
        active: true,
        accumulatedDistanceMeters: 10_000,
        routeId: 'legacy-active',
        samples: [],
        startTimestamp: 1_000,
      },
    };
    await AsyncStorage.setItem(ROUTE_TRACKING_STORAGE_KEY, JSON.stringify(activeRoute));
    await AsyncStorage.setItem(legacyHistoryKey, JSON.stringify([legacySession('legacy-a')]));

    const result = await routeTrackingRepository.claimLegacyRouteHistory();

    expect(result.status).toBe('claimed');
    expect(await readJson(getRouteTrackingStorageKeyForTest(UID_A))).toBeNull();
    expect(await AsyncStorage.getItem(ROUTE_TRACKING_STORAGE_KEY)).toBe(
      JSON.stringify(activeRoute),
    );
  });

  it('claims into an empty UID-scoped v2 history after read-back validation', async () => {
    const history = [legacySession('legacy-a')];
    const serialized = JSON.stringify(history);
    await AsyncStorage.setItem(legacyHistoryKey, serialized);

    await expect(routeTrackingRepository.claimLegacyRouteHistory()).resolves.toMatchObject({
      status: 'claimed',
      importedSessionCount: 1,
    });

    const claimed = await readJson<RouteTrackingSession[]>(
      getRouteTrackingHistoryStorageKey(UID_A),
    );
    expect(claimed).toEqual([expect.objectContaining({ ...history[0], ownerUid: UID_A })]);
    expect(routeTrackingRepository.getMemoryRouteHistory()).toEqual(claimed);
    expect(await AsyncStorage.getItem(legacyHistoryKey)).toBe(serialized);
  });

  it('merges legacy history with the current UID v2 history without losing either set', async () => {
    const existing = ownedSession('current-a', UID_A, { distanceMeters: 12_000 });
    const legacy = legacySession('legacy-a', { distanceMeters: 8_000 });
    await AsyncStorage.setItem(
      getRouteTrackingHistoryStorageKey(UID_A),
      JSON.stringify([existing]),
    );
    await AsyncStorage.setItem(legacyHistoryKey, JSON.stringify([legacy]));

    await routeTrackingRepository.claimLegacyRouteHistory();

    await expect(
      readJson<RouteTrackingSession[]>(getRouteTrackingHistoryStorageKey(UID_A)),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: existing.id, ownerUid: UID_A }),
        expect.objectContaining({ id: legacy.id, ownerUid: UID_A }),
      ]),
    );
  });

  it('reuses the canonical completeness policy for a duplicate route id', async () => {
    const current = ownedSession('same-route', UID_A, { pointsCount: 1, samples: [] });
    const legacy = legacySession('same-route', { pointsCount: 2 });
    await AsyncStorage.setItem(getRouteTrackingHistoryStorageKey(UID_A), JSON.stringify([current]));
    await AsyncStorage.setItem(legacyHistoryKey, JSON.stringify([legacy]));

    await routeTrackingRepository.claimLegacyRouteHistory();

    const result = await readJson<RouteTrackingSession[]>(getRouteTrackingHistoryStorageKey(UID_A));
    expect(result).toHaveLength(1);
    expect(result?.[0]?.pointsCount).toBe(2);
  });

  it('keeps different route ids independent even when date and distance match', async () => {
    await AsyncStorage.setItem(
      legacyHistoryKey,
      JSON.stringify([legacySession('legacy-a'), legacySession('legacy-b')]),
    );

    await routeTrackingRepository.claimLegacyRouteHistory();

    const result = await readJson<RouteTrackingSession[]>(getRouteTrackingHistoryStorageKey(UID_A));
    expect(result).toHaveLength(2);
    expect(summarizeRouteDistance(result ?? [])).toEqual({
      routeCount: 2,
      totalKilometers: 20,
    });
  });

  it('does not expose legacy kilometers to Finanças before claim and exposes them after claim', async () => {
    const legacy = legacySession('legacy-a');
    await AsyncStorage.setItem(legacyHistoryKey, JSON.stringify([legacy]));
    const settings = {
      getDailyDates: () => [],
      getDailyValues: () => ({ fuel: '', fuelPrice: '6', fuelType: 'gasolina', kilometers: '' }),
      getLatestFuelPrice: () => '6',
      getLatestFuelType: () => 'gasolina',
    };
    const carSettings = { alcoholAutonomy: '5,6 Km/l', gasolineAutonomy: '7,4 Km/l' };
    const calculate = (history: readonly RouteTrackingSession[]) =>
      calculateFinancialFuelCostsByDate({}, history, settings, carSettings)['2026-09-06'];

    expect(calculate(await routeTrackingRepository.getRouteHistory())).toBeUndefined();
    await routeTrackingRepository.claimLegacyRouteHistory();
    const claimed = await routeTrackingRepository.getRouteHistory();
    expect(calculate(claimed)).toBeCloseTo((10 / 7.4) * 6, 8);
    expect(summarizeRouteDistance(claimed).routeCount).toBe(1);
  });

  it('is idempotent for the same UID and legacy fingerprint', async () => {
    await AsyncStorage.setItem(legacyHistoryKey, JSON.stringify([legacySession('legacy-a')]));
    await routeTrackingRepository.claimLegacyRouteHistory();
    jest.mocked(AsyncStorage.setItem).mockClear();

    await expect(routeTrackingRepository.claimLegacyRouteHistory()).resolves.toMatchObject({
      status: 'already-claimed',
    });
    expect(jest.mocked(AsyncStorage.setItem)).not.toHaveBeenCalledWith(
      getRouteTrackingHistoryStorageKey(UID_A),
      expect.any(String),
    );
    expect(jest.mocked(AsyncStorage.setItem)).not.toHaveBeenCalledWith(
      getRouteTrackingLegacyClaimStorageKey(UID_A),
      expect.any(String),
    );
  });

  it('scopes the claim marker to its UID', async () => {
    await AsyncStorage.setItem(legacyHistoryKey, JSON.stringify([legacySession('legacy-a')]));
    await routeTrackingRepository.claimLegacyRouteHistory();

    routeTrackingRepository.setSessionUser(UID_B, 2);
    const statusB = await routeTrackingRepository.getLegacyRouteHistoryStatus();

    expect(statusB.available).toBe(true);
    expect(statusB.claimed).toBe(false);
    await routeTrackingRepository.claimLegacyRouteHistory();
    expect(await AsyncStorage.getItem(getRouteTrackingHistoryStorageKey(UID_A))).toContain(UID_A);
    expect(await AsyncStorage.getItem(getRouteTrackingHistoryStorageKey(UID_B))).toContain(UID_B);
    expect(await AsyncStorage.getItem(getRouteTrackingLegacyClaimStorageKey(UID_A))).toContain(
      UID_A,
    );
    expect(await AsyncStorage.getItem(getRouteTrackingLegacyClaimStorageKey(UID_B))).toContain(
      UID_B,
    );
  });

  it('coalesces concurrent claims from the same session into one operation', async () => {
    const legacyRead = defer<string | null>();
    jest
      .mocked(AsyncStorage.getItem)
      .mockImplementation((key: string) =>
        key === legacyHistoryKey
          ? legacyRead.promise
          : Promise.resolve(mockStorage.get(key) ?? null),
      );
    const first = routeTrackingRepository.claimLegacyRouteHistory();
    const second = routeTrackingRepository.claimLegacyRouteHistory();

    expect(second).toBe(first);
    legacyRead.resolve(JSON.stringify([legacySession('legacy-a')]));
    await expect(first).resolves.toMatchObject({ status: 'claimed' });
    expect(
      jest
        .mocked(AsyncStorage.setItem)
        .mock.calls.filter(([key]) => key === getRouteTrackingHistoryStorageKey(UID_A)),
    ).toHaveLength(1);
  });

  it('does not let a different session join an in-flight claim', async () => {
    const legacyRead = defer<string | null>();
    jest
      .mocked(AsyncStorage.getItem)
      .mockImplementation((key: string) =>
        key === legacyHistoryKey
          ? legacyRead.promise
          : Promise.resolve(mockStorage.get(key) ?? null),
      );
    const first = routeTrackingRepository.claimLegacyRouteHistory();
    await Promise.resolve();
    routeTrackingRepository.setSessionUser(UID_B, 2);

    await expect(routeTrackingRepository.claimLegacyRouteHistory()).rejects.toThrow(
      'importação de histórico em andamento',
    );
    legacyRead.resolve(JSON.stringify([legacySession('legacy-a')]));
    await expect(first).rejects.toThrow('sessão da rota expirou');
  });

  it('aborts safely when logout happens during the legacy read', async () => {
    const legacyRead = defer<string | null>();
    jest
      .mocked(AsyncStorage.getItem)
      .mockImplementation((key: string) =>
        key === legacyHistoryKey
          ? legacyRead.promise
          : Promise.resolve(mockStorage.get(key) ?? null),
      );
    const claim = routeTrackingRepository.claimLegacyRouteHistory();
    await Promise.resolve();
    routeTrackingRepository.setSessionUser(null, 2);
    legacyRead.resolve(JSON.stringify([legacySession('legacy-a')]));

    await expect(claim).rejects.toThrow('sessão da rota expirou');
    expect(await AsyncStorage.getItem(getRouteTrackingHistoryStorageKey(UID_A))).toBeNull();
    expect(await AsyncStorage.getItem(getRouteTrackingLegacyClaimStorageKey(UID_A))).toBeNull();
  });

  it('aborts safely when UID A changes to UID B during claim', async () => {
    const legacyRead = defer<string | null>();
    jest
      .mocked(AsyncStorage.getItem)
      .mockImplementation((key: string) =>
        key === legacyHistoryKey
          ? legacyRead.promise
          : Promise.resolve(mockStorage.get(key) ?? null),
      );
    const claim = routeTrackingRepository.claimLegacyRouteHistory();
    await Promise.resolve();
    routeTrackingRepository.setSessionUser(UID_B, 2);
    legacyRead.resolve(JSON.stringify([legacySession('legacy-a')]));

    await expect(claim).rejects.toThrow('sessão da rota expirou');
    expect(await AsyncStorage.getItem(getRouteTrackingHistoryStorageKey(UID_B))).toBeNull();
    expect(await AsyncStorage.getItem(getRouteTrackingLegacyClaimStorageKey(UID_B))).toBeNull();
  });

  it('does not reuse an old read after logout and relogin with the same UID', async () => {
    const oldRead = defer<string | null>();
    let legacyReadCount = 0;
    jest.mocked(AsyncStorage.getItem).mockImplementation((key: string) => {
      if (key === legacyHistoryKey && legacyReadCount++ === 0) return oldRead.promise;
      return Promise.resolve(mockStorage.get(key) ?? null);
    });
    const oldClaim = routeTrackingRepository.claimLegacyRouteHistory();
    await Promise.resolve();
    routeTrackingRepository.setSessionUser(null, 2);
    routeTrackingRepository.setSessionUser(UID_A, 3);
    await AsyncStorage.setItem(legacyHistoryKey, JSON.stringify([legacySession('legacy-a')]));
    oldRead.resolve(JSON.stringify([legacySession('old-route')]));

    await expect(oldClaim).rejects.toThrow('sessão da rota expirou');
    await expect(routeTrackingRepository.claimLegacyRouteHistory()).resolves.toMatchObject({
      status: 'claimed',
    });
    expect(await AsyncStorage.getItem(getRouteTrackingHistoryStorageKey(UID_A))).toContain(
      'legacy-a',
    );
    expect(await AsyncStorage.getItem(getRouteTrackingHistoryStorageKey(UID_A))).not.toContain(
      'old-route',
    );
  });

  it('rolls back the previous v2 history when the v2 write fails', async () => {
    const previous = [ownedSession('current-a', UID_A)];
    await AsyncStorage.setItem(getRouteTrackingHistoryStorageKey(UID_A), JSON.stringify(previous));
    await AsyncStorage.setItem(legacyHistoryKey, JSON.stringify([legacySession('legacy-a')]));
    const originalSetItem = jest.mocked(AsyncStorage.setItem);
    originalSetItem.mockImplementation((key: string, value: string) => {
      mockStorage.set(key, value);
      if (key === getRouteTrackingHistoryStorageKey(UID_A)) {
        return Promise.reject(new Error('v2 write failed'));
      }
      return Promise.resolve();
    });

    await expect(routeTrackingRepository.claimLegacyRouteHistory()).rejects.toThrow(
      'v2 write failed',
    );
    expect(await AsyncStorage.getItem(getRouteTrackingHistoryStorageKey(UID_A))).toBe(
      JSON.stringify(previous),
    );
    expect(await AsyncStorage.getItem(getRouteTrackingLegacyClaimStorageKey(UID_A))).toBeNull();
  });

  it('rolls back the previous v2 history when read-back validation fails', async () => {
    const previous = [ownedSession('current-a', UID_A)];
    const historyKey = getRouteTrackingHistoryStorageKey(UID_A);
    await AsyncStorage.setItem(historyKey, JSON.stringify(previous));
    await AsyncStorage.setItem(legacyHistoryKey, JSON.stringify([legacySession('legacy-a')]));
    let mainWriteCompleted = false;
    jest.mocked(AsyncStorage.setItem).mockImplementation((key: string, value: string) => {
      mockStorage.set(key, value);
      if (key === historyKey) mainWriteCompleted = true;
      return Promise.resolve();
    });
    jest.mocked(AsyncStorage.getItem).mockImplementation((key: string) => {
      if (key === historyKey && mainWriteCompleted) return Promise.resolve(JSON.stringify([]));
      return Promise.resolve(mockStorage.get(key) ?? null);
    });

    await expect(routeTrackingRepository.claimLegacyRouteHistory()).rejects.toThrow(
      'validar o histórico importado',
    );
    expect(mockStorage.get(historyKey)).toBe(JSON.stringify(previous));
    expect(await AsyncStorage.getItem(getRouteTrackingLegacyClaimStorageKey(UID_A))).toBeNull();
  });

  it('rolls back v2 and preserves the old marker when marker persistence fails', async () => {
    const previous = [ownedSession('current-a', UID_A)];
    const historyKey = getRouteTrackingHistoryStorageKey(UID_A);
    const markerKey = getRouteTrackingLegacyClaimStorageKey(UID_A);
    const oldMarker = JSON.stringify({
      claimedAt: 1,
      fingerprint: 'different',
      schemaVersion: 1,
      uid: UID_A,
    });
    await AsyncStorage.setItem(historyKey, JSON.stringify(previous));
    await AsyncStorage.setItem(markerKey, oldMarker);
    await AsyncStorage.setItem(legacyHistoryKey, JSON.stringify([legacySession('legacy-a')]));
    jest.mocked(AsyncStorage.setItem).mockImplementation((key: string, value: string) => {
      if (key === markerKey) {
        mockStorage.set(key, value);
        return Promise.reject(new Error('marker write failed'));
      }
      mockStorage.set(key, value);
      return Promise.resolve();
    });

    await expect(routeTrackingRepository.claimLegacyRouteHistory()).rejects.toThrow(
      'marker write failed',
    );
    expect(await AsyncStorage.getItem(historyKey)).toBe(JSON.stringify(previous));
    expect(await AsyncStorage.getItem(markerKey)).toBe(oldMarker);
  });

  it('preserves all local-only session fields when assigning the owner UID', async () => {
    const localOnly = legacySession('legacy-complete', {
      date: '2026-08-31',
      distanceMeters: 23_450,
      durationSeconds: 987,
      pointsCount: 2,
    });
    await AsyncStorage.setItem(legacyHistoryKey, JSON.stringify([localOnly]));

    await routeTrackingRepository.claimLegacyRouteHistory();

    const result = await readJson<RouteTrackingSession[]>(getRouteTrackingHistoryStorageKey(UID_A));
    expect(result?.[0]).toEqual({ ...localOnly, ownerUid: UID_A });
  });

  it('never rewrites or deletes either v1 key during a successful claim', async () => {
    const activeRoute = JSON.stringify({
      active: true,
      accumulatedDistanceMeters: 0,
      routeId: 'legacy-active',
      samples: [],
      startTimestamp: 1_000,
    });
    const history = JSON.stringify([legacySession('legacy-a')]);
    await AsyncStorage.setItem(ROUTE_TRACKING_STORAGE_KEY, activeRoute);
    await AsyncStorage.setItem(legacyHistoryKey, history);
    jest.mocked(AsyncStorage.setItem).mockClear();
    jest.mocked(AsyncStorage.removeItem).mockClear();

    await routeTrackingRepository.claimLegacyRouteHistory();

    expect(jest.mocked(AsyncStorage.setItem).mock.calls.map(([key]) => key)).not.toContain(
      ROUTE_TRACKING_STORAGE_KEY,
    );
    expect(jest.mocked(AsyncStorage.setItem).mock.calls.map(([key]) => key)).not.toContain(
      legacyHistoryKey,
    );
    expect(jest.mocked(AsyncStorage.removeItem).mock.calls.map(([key]) => key)).not.toContain(
      ROUTE_TRACKING_STORAGE_KEY,
    );
    expect(jest.mocked(AsyncStorage.removeItem).mock.calls.map(([key]) => key)).not.toContain(
      legacyHistoryKey,
    );
    expect(await AsyncStorage.getItem(ROUTE_TRACKING_STORAGE_KEY)).toBe(activeRoute);
    expect(await AsyncStorage.getItem(legacyHistoryKey)).toBe(history);
  });

  it('keeps the canonical fingerprint independent from legacy array order', async () => {
    const first = [legacySession('legacy-a'), legacySession('legacy-b')];
    await AsyncStorage.setItem(legacyHistoryKey, JSON.stringify(first));
    const firstStatus = await routeTrackingRepository.getLegacyRouteHistoryStatus();

    await AsyncStorage.setItem(legacyHistoryKey, JSON.stringify([...first].reverse()));
    const secondStatus = await routeTrackingRepository.getLegacyRouteHistoryStatus();

    expect(secondStatus.fingerprint).toBe(firstStatus.fingerprint);
  });

  it('publishes claimed history only to the current UID session memory', async () => {
    await AsyncStorage.setItem(legacyHistoryKey, JSON.stringify([legacySession('legacy-a')]));
    await routeTrackingRepository.claimLegacyRouteHistory();
    expect(routeTrackingRepository.getMemoryRouteHistory()?.[0]?.ownerUid).toBe(UID_A);

    routeTrackingRepository.setSessionUser(UID_B, 2);
    expect(routeTrackingRepository.getMemoryRouteHistory()).toBeNull();
  });
});

function getRouteTrackingStorageKeyForTest(uid: string): string {
  return `@pareact/route-tracking-v2:${encodeURIComponent(uid)}`;
}
