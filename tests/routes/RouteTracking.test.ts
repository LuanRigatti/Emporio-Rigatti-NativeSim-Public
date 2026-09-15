import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { calculateFinancialFuelCostsByDate } from '@/services/expenses/FinancialFuelCostService';
import {
  appendValidLocationSamples,
  calculateDistanceMeters,
} from '@/services/routes/routeTrackingMath';
import {
  summarizeRouteDistance,
  summarizeRouteKilometersByDate,
} from '@/services/routes/routeTrackingDistance';
import { LocationTrackingService } from '@/services/routes/LocationTrackingService';
import { handleRouteLocationTask } from '@/services/routes/LocationTrackingTask';
import {
  getRouteTrackingHistoryStorageKey,
  getRouteTrackingStorageKey,
  ROUTE_TRACKING_BACKGROUND_OWNER_STORAGE_KEY,
  ROUTE_TRACKING_HISTORY_STORAGE_KEY,
  ROUTE_TRACKING_STORAGE_KEY,
  RouteTrackingRepository,
  routeTrackingRepository,
} from '@/services/routes/RouteTrackingRepository';
import type { RouteTrackingRecord, RouteTrackingSession } from '@/types/routeTracking';

const mockStorage = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    clear: jest.fn(() => {
      mockStorage.clear();
      return Promise.resolve();
    }),
    getItem: jest.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      mockStorage.set(key, value);
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      mockStorage.delete(key);
      return Promise.resolve();
    }),
  },
}));

jest.mock('expo-location', () => ({
  Accuracy: { High: 'high' },
  ActivityType: { AutomotiveNavigation: 'automotiveNavigation' },
  hasStartedLocationUpdatesAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
}));

jest.mock('expo-task-manager', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  isTaskDefined: jest.fn().mockReturnValue(true),
}));

const hasStartedLocationUpdatesAsync = jest.mocked(Location.hasStartedLocationUpdatesAsync);
const startLocationUpdatesAsync = jest.mocked(Location.startLocationUpdatesAsync);
const stopLocationUpdatesAsync = jest.mocked(Location.stopLocationUpdatesAsync);

const baseRecord: RouteTrackingRecord = {
  active: true,
  accumulatedDistanceMeters: 0,
  routeId: 'route-1',
  samples: [],
  startTimestamp: 1_000,
};

const TEST_UID = 'route-test-user';

const uidHistoryFixture: RouteTrackingSession = {
  date: '2026-08-06',
  distanceMeters: 12_400,
  durationSeconds: 120,
  endTimestamp: 2_000,
  id: 'route-a',
  ownerUid: 'uid-a',
  pointsCount: 2,
  samples: [],
  startTimestamp: 1_000,
  status: 'finalized',
};

function location(
  latitude: number,
  longitude: number,
  timestamp: number,
  accuracy = 10,
): Location.LocationObject {
  return {
    coords: {
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      latitude,
      longitude,
      speed: null,
    },
    timestamp,
  };
}

describe('route tracking distance', () => {
  it('calculates a geographic distance', () => {
    expect(
      calculateDistanceMeters(
        { latitude: -25.4296, longitude: -49.2719 },
        { latitude: -25.4305, longitude: -49.2719 },
      ),
    ).toBeGreaterThan(90);
  });

  it('accepts sequential valid samples and rejects invalid jumps', () => {
    const result = appendValidLocationSamples(baseRecord, [
      location(-25.4296, -49.2719, 1_000),
      location(-25.4296, -49.2719, 2_000),
      location(-25.4305, -49.2719, 3_000),
      location(-25.5, -49.2, 3_100),
      location(-25.4314, -49.2719, 4_000, 150),
    ]);

    expect(result.samples).toHaveLength(2);
    expect(result.accumulatedDistanceMeters).toBeGreaterThan(90);
  });
});

describe('route tracking stop lifecycle', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    routeTrackingRepository.setSessionUser(TEST_UID, 1);
    jest.clearAllMocks();
  });

  async function createActiveRoute() {
    await routeTrackingRepository.createActiveRoute('route-1');
    return new LocationTrackingService();
  }

  it('verifies native updates stopped before finalizing', async () => {
    const service = await createActiveRoute();
    hasStartedLocationUpdatesAsync.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const result = await service.stopRouteTracking('route-1');

    expect(stopLocationUpdatesAsync).toHaveBeenCalledWith('pareact-route-location-updates');
    expect(hasStartedLocationUpdatesAsync).toHaveBeenCalledTimes(2);
    expect(result?.active).toBe(false);
    expect(await routeTrackingRepository.getActiveRoute()).toBeNull();
  });

  it('keeps the route active when native stop fails', async () => {
    const service = await createActiveRoute();
    hasStartedLocationUpdatesAsync.mockResolvedValue(true);
    stopLocationUpdatesAsync.mockRejectedValue(new Error('native stop failed'));

    await expect(service.stopRouteTracking('route-1')).rejects.toMatchObject({
      code: 'stop-failed',
    });

    const route = await routeTrackingRepository.getActiveRoute();
    expect(route?.active).toBe(true);
    expect(route?.stopRequestedAt).toEqual(expect.any(Number));
  });

  it('allows a safe retry after a failed stop', async () => {
    const service = await createActiveRoute();
    hasStartedLocationUpdatesAsync.mockResolvedValue(true);
    stopLocationUpdatesAsync.mockRejectedValueOnce(new Error('native stop failed'));
    await expect(service.stopRouteTracking('route-1')).rejects.toMatchObject({
      code: 'stop-failed',
    });

    stopLocationUpdatesAsync.mockResolvedValue(undefined);
    hasStartedLocationUpdatesAsync.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const result = await service.stopRouteTracking('route-1');

    expect(result?.active).toBe(false);
    expect(await routeTrackingRepository.getActiveRoute()).toBeNull();
  });

  it('returns the finalized route for a duplicate stop call', async () => {
    const service = await createActiveRoute();
    hasStartedLocationUpdatesAsync.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const first = await service.stopRouteTracking('route-1');
    const second = await service.stopRouteTracking('route-1');

    expect(second).toEqual(first);
    expect(stopLocationUpdatesAsync).toHaveBeenCalledTimes(1);
  });

  it('retries an incomplete stop after app restart without starting a new route', async () => {
    const service = await createActiveRoute();
    hasStartedLocationUpdatesAsync.mockResolvedValue(true);
    stopLocationUpdatesAsync.mockRejectedValueOnce(new Error('native stop failed'));
    await expect(service.stopRouteTracking('route-1')).rejects.toMatchObject({
      code: 'stop-failed',
    });

    stopLocationUpdatesAsync.mockResolvedValue(undefined);
    hasStartedLocationUpdatesAsync.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const restored = await new LocationTrackingService().restoreActiveRouteAfterAppRestart();

    expect(restored?.active).toBe(false);
    expect(startLocationUpdatesAsync).not.toHaveBeenCalled();
    expect(await routeTrackingRepository.getActiveRoute()).toBeNull();
  });
});

describe('route tracking UID-scoped storage and session safety', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    routeTrackingRepository.setSessionUser(null, 0);
    jest.clearAllMocks();
    hasStartedLocationUpdatesAsync.mockResolvedValue(false);
    stopLocationUpdatesAsync.mockResolvedValue(undefined);
  });

  it('writes a new route and its finalized history only to the authenticated UID', async () => {
    routeTrackingRepository.setSessionUser('uid-a', 1);

    const started = await routeTrackingRepository.createActiveRoute('route-a');
    await routeTrackingRepository.requestStop(started.routeId, 2_000);
    await routeTrackingRepository.finishRoute(started.routeId, 3_000);

    expect(started.ownerUid).toBe('uid-a');
    expect(await AsyncStorage.getItem(getRouteTrackingStorageKey('uid-a'))).toContain('uid-a');
    expect(await AsyncStorage.getItem(getRouteTrackingHistoryStorageKey('uid-a'))).toContain(
      'route-a',
    );
    expect(await AsyncStorage.getItem(getRouteTrackingStorageKey('uid-b'))).toBeNull();
    expect(await AsyncStorage.getItem(getRouteTrackingHistoryStorageKey('uid-b'))).toBeNull();
  });

  it('does not expose UID A route history to UID B', async () => {
    const uidA = new RouteTrackingRepository();
    uidA.setSessionUser('uid-a', 1);
    await uidA.createActiveRoute('route-a');
    await uidA.requestStop('route-a', 2_000);
    await uidA.finishRoute('route-a', 3_000);

    const uidB = new RouteTrackingRepository();
    uidB.setSessionUser('uid-b', 1);

    await expect(uidB.getRouteHistory()).resolves.toEqual([]);
    await expect(uidB.getRoute()).resolves.toBeNull();
  });

  it('keeps in-memory history separated for different UIDs and forces reload after relogin', async () => {
    const repo = new RouteTrackingRepository();
    const history = {
      ...uidHistoryFixture,
      ownerUid: 'uid-a',
    };
    await AsyncStorage.setItem(
      getRouteTrackingHistoryStorageKey('uid-a'),
      JSON.stringify([history]),
    );
    repo.setSessionUser('uid-a', 1);
    await expect(repo.getRouteHistory()).resolves.toEqual([history]);

    repo.setSessionUser('uid-b', 1);
    expect(repo.getMemoryRouteHistory()).toBeNull();
    await expect(repo.getRouteHistory()).resolves.toEqual([]);

    repo.setSessionUser('uid-a', 2);
    expect(repo.getMemoryRouteHistory()).toBeNull();
    await expect(repo.getRouteHistory()).resolves.toEqual([history]);
  });

  it('does not reuse a pending history read after relogin with the same UID', async () => {
    const repo = new RouteTrackingRepository();
    const serialized = JSON.stringify([{ ...uidHistoryFixture, ownerUid: 'uid-a' }]);
    let rejectOldRead: (error: Error) => void = () => undefined;
    const oldRead = new Promise<string | null>((_, reject) => {
      rejectOldRead = reject;
    });
    jest
      .mocked(AsyncStorage.getItem)
      .mockImplementationOnce(() => oldRead)
      .mockImplementationOnce(() => Promise.resolve(serialized));

    repo.setSessionUser('uid-a', 1);
    const oldSessionRead = repo.getRouteHistory();
    repo.setSessionUser('uid-a', 2);
    const newSessionRead = repo.getRouteHistory();
    rejectOldRead(new Error('old session read failed'));

    await expect(oldSessionRead).rejects.toThrow('old session read failed');
    await expect(newSessionRead).resolves.toHaveLength(1);
  });

  it('uses the persisted owner for background samples after the foreground session changes', async () => {
    const repo = new RouteTrackingRepository();
    repo.setSessionUser('uid-a', 1);
    const started = await repo.createActiveRoute('route-a');
    repo.setSessionUser('uid-b', 1);

    const result = await repo.appendLocationSamplesForBackground([
      location(-25.4296, -49.2719, started.startTimestamp + 1_000),
    ]);

    expect(result?.ownerUid).toBe('uid-a');
    await expect(repo.getRoute()).resolves.toBeNull();
    repo.setSessionUser('uid-a', 2);
    await expect(repo.getRoute()).resolves.toMatchObject({
      ownerUid: 'uid-a',
      routeId: 'route-a',
      samples: [{ timestamp: started.startTimestamp + 1_000 }],
    });
  });

  it('keeps a late background callback on the persisted owner and never redirects it', async () => {
    routeTrackingRepository.setSessionUser('uid-a', 1);
    const started = await routeTrackingRepository.createActiveRoute('route-a');
    routeTrackingRepository.setSessionUser('uid-b', 1);

    await expect(
      handleRouteLocationTask({
        data: { locations: [location(-25.4296, -49.2719, started.startTimestamp + 1_000)] },
      }),
    ).resolves.toBeUndefined();

    routeTrackingRepository.setSessionUser('uid-a', 2);
    await expect(routeTrackingRepository.getRoute()).resolves.toMatchObject({
      ownerUid: 'uid-a',
      samples: [{ timestamp: started.startTimestamp + 1_000 }],
    });
    routeTrackingRepository.setSessionUser('uid-b', 2);
    await expect(routeTrackingRepository.getRoute()).resolves.toBeNull();
  });

  it('drops a callback from a finalized UID A route after UID B starts a new route', async () => {
    const repo = routeTrackingRepository;
    let currentTimestamp = 1_000;
    const dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => currentTimestamp);

    try {
      repo.setSessionUser('uid-a', 1);
      const routeA = await repo.createActiveRoute('route-a');
      const staleLocation = location(-25.4296, -49.2719, routeA.startTimestamp + 1_000);
      await repo.requestStop(routeA.routeId, 2_500);
      await repo.finishRoute(routeA.routeId, 3_000);

      currentTimestamp = 4_000;
      repo.setSessionUser('uid-b', 1);
      const routeB = await repo.createActiveRoute('route-b');
      jest.mocked(AsyncStorage.setItem).mockClear();

      await expect(
        handleRouteLocationTask({ data: { locations: [staleLocation] } }),
      ).resolves.toBeUndefined();

      await expect(repo.getRoute()).resolves.toMatchObject({
        ownerUid: 'uid-b',
        routeId: routeB.routeId,
        samples: [],
      });
      expect(jest.mocked(AsyncStorage.setItem)).not.toHaveBeenCalledWith(
        getRouteTrackingStorageKey('uid-b'),
        expect.any(String),
      );
      await expect(repo.getRouteHistory()).resolves.toEqual([]);
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it('drops a callback from a finalized route before a new route for the same UID starts', async () => {
    const repo = routeTrackingRepository;
    let currentTimestamp = 1_000;
    const dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => currentTimestamp);

    try {
      repo.setSessionUser('uid-a', 1);
      const routeOne = await repo.createActiveRoute('route-one');
      const staleLocation = location(-25.4296, -49.2719, routeOne.startTimestamp + 1_000);
      await repo.requestStop(routeOne.routeId, 2_500);
      await repo.finishRoute(routeOne.routeId, 3_000);

      currentTimestamp = 4_000;
      repo.setSessionUser('uid-a', 2);
      const routeTwo = await repo.createActiveRoute('route-two');
      jest.mocked(AsyncStorage.setItem).mockClear();

      await expect(
        handleRouteLocationTask({ data: { locations: [staleLocation] } }),
      ).resolves.toBeUndefined();

      await expect(repo.getRoute()).resolves.toMatchObject({
        ownerUid: 'uid-a',
        routeId: routeTwo.routeId,
        samples: [],
      });
      expect(jest.mocked(AsyncStorage.setItem)).not.toHaveBeenCalledWith(
        getRouteTrackingStorageKey('uid-a'),
        expect.any(String),
      );
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it('keeps current-route background locations and discards older points in a mixed batch', async () => {
    const repo = routeTrackingRepository;
    repo.setSessionUser('uid-a', 1);
    const route = await repo.createActiveRoute('route-a');

    await expect(
      handleRouteLocationTask({
        data: {
          locations: [
            location(-25.4296, -49.2719, route.startTimestamp - 1),
            location(-25.4296, -49.2719, route.startTimestamp),
            location(-25.4305, -49.2719, route.startTimestamp + 2_000),
          ],
        },
      }),
    ).resolves.toBeUndefined();

    await expect(repo.getRoute()).resolves.toMatchObject({
      routeId: route.routeId,
      samples: [{ timestamp: route.startTimestamp }, { timestamp: route.startTimestamp + 2_000 }],
    });
  });

  it('finishes an active route for UID A before logout and keeps it away from UID B', async () => {
    const repo = routeTrackingRepository;
    repo.setSessionUser('uid-a', 1);
    await repo.createActiveRoute('route-a');
    const service = new LocationTrackingService();

    hasStartedLocationUpdatesAsync.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(service.stopActiveRouteForLogout('uid-a', 1)).resolves.toMatchObject({
      active: false,
      ownerUid: 'uid-a',
    });

    repo.setSessionUser('uid-b', 1);
    await expect(repo.getRouteHistory()).resolves.toEqual([]);
  });

  it('keeps UID A route data when native stop fails during logout', async () => {
    const repo = routeTrackingRepository;
    repo.setSessionUser('uid-a', 1);
    await repo.createActiveRoute('route-a');
    const service = new LocationTrackingService();
    hasStartedLocationUpdatesAsync.mockResolvedValue(true);
    stopLocationUpdatesAsync.mockRejectedValue(new Error('native stop failed'));

    await expect(service.stopActiveRouteForLogout('uid-a', 1)).rejects.toMatchObject({
      code: 'stop-failed',
    });

    repo.setSessionUser('uid-b', 1);
    await expect(repo.getRouteHistory()).resolves.toEqual([]);
    repo.setSessionUser('uid-a', 2);
    await expect(repo.getRoute()).resolves.toMatchObject({
      active: true,
      ownerUid: 'uid-a',
      routeId: 'route-a',
      stopRequestedAt: expect.any(Number),
    });
  });

  it('ignores ownerless legacy storage and never writes new routes to v1 keys', async () => {
    const legacySession = { ...uidHistoryFixture };
    delete legacySession.ownerUid;
    await AsyncStorage.setItem(ROUTE_TRACKING_HISTORY_STORAGE_KEY, JSON.stringify([legacySession]));
    await AsyncStorage.setItem(
      ROUTE_TRACKING_STORAGE_KEY,
      JSON.stringify({ ...baseRecord, active: true }),
    );
    jest.mocked(AsyncStorage.setItem).mockClear();

    routeTrackingRepository.setSessionUser('uid-a', 1);
    await expect(routeTrackingRepository.getRouteHistory()).resolves.toEqual([]);
    await expect(routeTrackingRepository.getRoute()).resolves.toBeNull();
    await routeTrackingRepository.createActiveRoute('route-new');

    expect(jest.mocked(AsyncStorage.setItem).mock.calls).toEqual(
      expect.arrayContaining([
        [getRouteTrackingStorageKey('uid-a'), expect.any(String)],
        [ROUTE_TRACKING_BACKGROUND_OWNER_STORAGE_KEY, expect.any(String)],
      ]),
    );
    expect(jest.mocked(AsyncStorage.setItem).mock.calls).not.toEqual(
      expect.arrayContaining([
        [ROUTE_TRACKING_STORAGE_KEY, expect.any(String)],
        [ROUTE_TRACKING_HISTORY_STORAGE_KEY, expect.any(String)],
      ]),
    );
    await expect(AsyncStorage.getItem(ROUTE_TRACKING_HISTORY_STORAGE_KEY)).resolves.toContain(
      'route-a',
    );
  });

  it('does not return authenticated route data without a bound UID', async () => {
    routeTrackingRepository.setSessionUser(null, 2);
    await expect(routeTrackingRepository.getRouteHistory()).resolves.toEqual([]);
    await expect(routeTrackingRepository.getRoute()).resolves.toBeNull();
  });

  it('keeps the logout path unchanged when UID A has no active route', async () => {
    const persistedHistory = [{ ...uidHistoryFixture, ownerUid: TEST_UID }];
    await AsyncStorage.setItem(
      getRouteTrackingHistoryStorageKey(TEST_UID),
      JSON.stringify(persistedHistory),
    );
    jest.mocked(AsyncStorage.setItem).mockClear();

    routeTrackingRepository.setSessionUser(TEST_UID, 1);
    const service = new LocationTrackingService();
    await expect(service.stopActiveRouteForLogout(TEST_UID, 1)).resolves.toBeNull();

    expect(jest.mocked(AsyncStorage.setItem)).not.toHaveBeenCalled();
    await expect(AsyncStorage.getItem(getRouteTrackingHistoryStorageKey(TEST_UID))).resolves.toBe(
      JSON.stringify(persistedHistory),
    );

    routeTrackingRepository.setSessionUser('uid-b', 2);
    await expect(routeTrackingRepository.getRouteHistory()).resolves.toEqual([]);
  });

  it('keeps GPS kilometers and fuel cost isolated when Finanças changes UIDs', async () => {
    const historyA = {
      ...uidHistoryFixture,
      date: '2026-09-06',
      distanceMeters: 10_000,
      id: 'route-a',
      ownerUid: 'uid-a',
    };
    const historyB = {
      ...uidHistoryFixture,
      date: '2026-09-06',
      distanceMeters: 5_000,
      id: 'route-b',
      ownerUid: 'uid-b',
    };
    const legacyHistory = { ...historyA, distanceMeters: 100_000 };
    await AsyncStorage.setItem(
      getRouteTrackingHistoryStorageKey('uid-a'),
      JSON.stringify([historyA]),
    );
    await AsyncStorage.setItem(
      getRouteTrackingHistoryStorageKey('uid-b'),
      JSON.stringify([historyB]),
    );
    await AsyncStorage.setItem(ROUTE_TRACKING_HISTORY_STORAGE_KEY, JSON.stringify([legacyHistory]));

    const settings = {
      getDailyDates: () => [],
      getDailyValues: () => ({
        fuel: '',
        fuelPrice: '',
        fuelType: 'gasolina',
        kilometers: '',
      }),
      getLatestFuelPrice: () => '6',
      getLatestFuelType: () => 'gasolina',
    };
    const carSettings = { alcoholAutonomy: '5,6 Km/l', gasolineAutonomy: '7,4 Km/l' };
    const readFinancialRouteState = async (uid: string, sessionVersion: number) => {
      routeTrackingRepository.setSessionUser(uid, sessionVersion);
      const history = await routeTrackingRepository.getRouteHistory();
      const kilometersByDate = summarizeRouteKilometersByDate(history);
      const fuelCostByDate = calculateFinancialFuelCostsByDate({}, history, settings, carSettings);
      return {
        fuelCost: fuelCostByDate['2026-09-06'],
        history,
        routeCount: summarizeRouteDistance(history).routeCount,
        kilometers: kilometersByDate['2026-09-06'],
      };
    };

    const stateA = await readFinancialRouteState('uid-a', 1);
    const stateB = await readFinancialRouteState('uid-b', 2);
    const stateAAgain = await readFinancialRouteState('uid-a', 3);

    expect(stateA.history).toEqual([historyA]);
    expect(stateA.kilometers).toBe(10);
    expect(stateA.routeCount).toBe(1);
    expect(stateA.fuelCost).toBeCloseTo((10 / 7.4) * 6, 8);
    expect(stateB.history).toEqual([historyB]);
    expect(stateB.kilometers).toBe(5);
    expect(stateB.routeCount).toBe(1);
    expect(stateB.fuelCost).toBeCloseTo((5 / 7.4) * 6, 8);
    expect(stateAAgain).toEqual(stateA);
    expect(stateB.history).not.toContainEqual(historyA);
    expect(stateB.history).not.toContainEqual(legacyHistory);
  });

  it('does not let UID A delete a route stored under UID B', async () => {
    const repo = new RouteTrackingRepository();
    const session = { ...uidHistoryFixture, ownerUid: 'uid-b' };
    await AsyncStorage.setItem(
      getRouteTrackingHistoryStorageKey('uid-b'),
      JSON.stringify([session]),
    );
    repo.setSessionUser('uid-a', 1);

    await expect(repo.removeRouteSession(session.id)).resolves.toBe(false);
    expect(await AsyncStorage.getItem(getRouteTrackingHistoryStorageKey('uid-b'))).toContain(
      session.id,
    );
  });
});

describe('route distance by day', () => {
  const sessions: RouteTrackingSession[] = [
    {
      date: '2026-08-06',
      distanceMeters: 12_400,
      durationSeconds: 120,
      endTimestamp: 2_000,
      id: 'route-1',
      ownerUid: TEST_UID,
      pointsCount: 2,
      samples: [],
      startTimestamp: 1_000,
      status: 'finalized',
    },
    {
      date: '2026-08-06',
      distanceMeters: 8_600,
      durationSeconds: 120,
      endTimestamp: 4_000,
      id: 'route-2',
      ownerUid: TEST_UID,
      pointsCount: 2,
      samples: [],
      startTimestamp: 3_000,
      status: 'finalized',
    },
    {
      date: '2026-08-07',
      distanceMeters: 99_000,
      durationSeconds: 120,
      endTimestamp: 6_000,
      id: 'route-3',
      ownerUid: TEST_UID,
      pointsCount: 2,
      samples: [],
      startTimestamp: 5_000,
      status: 'finalized',
    },
  ];

  beforeEach(async () => {
    await AsyncStorage.clear();
    routeTrackingRepository.setSessionUser(TEST_UID, 1);
  });

  it('returns zero when the day has no finalized routes', async () => {
    expect(await routeTrackingRepository.getTotalDistanceForDate('2026-08-05')).toBe(0);
  });

  it('returns the distance of one route', async () => {
    await AsyncStorage.setItem(
      getRouteTrackingHistoryStorageKey(TEST_UID),
      JSON.stringify([sessions[0]]),
    );

    expect(await routeTrackingRepository.getTotalDistanceForDate('2026-08-06')).toBe(12.4);
  });

  it('returns one finalized session by id without changing its samples', async () => {
    const session = {
      ...sessions[0],
      samples: [{ accuracy: 5, latitude: -25.4296, longitude: -49.2719, timestamp: 1_000 }],
    };
    await AsyncStorage.setItem(
      getRouteTrackingHistoryStorageKey(TEST_UID),
      JSON.stringify([session]),
    );

    await expect(routeTrackingRepository.getRouteSessionById(session.id)).resolves.toEqual(session);
  });

  it('deduplicates identical route ids before calculating distance and route count', async () => {
    const duplicated = [sessions[0], { ...sessions[0] }];
    await AsyncStorage.setItem(
      getRouteTrackingHistoryStorageKey(TEST_UID),
      JSON.stringify(duplicated),
    );

    await expect(routeTrackingRepository.getRouteDistanceForDate('2026-08-06')).resolves.toEqual({
      routeCount: 1,
      totalKilometers: 12.4,
    });
    expect(routeTrackingRepository.getMemoryRouteHistory()).toEqual([sessions[0]]);
  });

  it('keeps the more complete record when the same route id has conflicting data', async () => {
    const completeSample = {
      accuracy: 10,
      latitude: -25.4296,
      longitude: -49.2719,
      timestamp: 1_500,
    };
    const incomplete = { ...sessions[0], pointsCount: 0, samples: [] };
    const complete = { ...sessions[0], pointsCount: 1, samples: [completeSample] };
    await AsyncStorage.setItem(
      getRouteTrackingHistoryStorageKey(TEST_UID),
      JSON.stringify([incomplete, complete]),
    );

    await expect(routeTrackingRepository.getRouteSessionById(sessions[0].id)).resolves.toEqual(
      complete,
    );
  });

  it('uses the most recent timestamps when duplicate records have equivalent completeness', async () => {
    const older = { ...sessions[0], endTimestamp: 2_000, startTimestamp: 1_000 };
    const newer = { ...sessions[0], endTimestamp: 4_000, startTimestamp: 3_000 };
    await AsyncStorage.setItem(
      getRouteTrackingHistoryStorageKey(TEST_UID),
      JSON.stringify([older, newer]),
    );

    await expect(routeTrackingRepository.getRouteSessionById(sessions[0].id)).resolves.toEqual(
      newer,
    );
  });

  it('keeps routes with different ids independent even when date and distance match', async () => {
    const secondRoute = { ...sessions[0], id: 'route-4' };
    await AsyncStorage.setItem(
      getRouteTrackingHistoryStorageKey(TEST_UID),
      JSON.stringify([sessions[0], secondRoute]),
    );

    await expect(routeTrackingRepository.getRouteDistanceForDate('2026-08-06')).resolves.toEqual({
      routeCount: 2,
      totalKilometers: 24.8,
    });
  });

  it('preserves a history without duplicate ids exactly as before', async () => {
    await AsyncStorage.setItem(
      getRouteTrackingHistoryStorageKey(TEST_UID),
      JSON.stringify(sessions),
    );

    await expect(routeTrackingRepository.getRouteHistory()).resolves.toEqual(sessions);
  });

  it('does not inflate the financial fuel cost when the same route is stored twice', async () => {
    const duplicated = [
      { ...sessions[0], distanceMeters: 10_000 },
      { ...sessions[0], distanceMeters: 10_000 },
    ];
    await AsyncStorage.setItem(
      getRouteTrackingHistoryStorageKey(TEST_UID),
      JSON.stringify(duplicated),
    );

    const routeHistory = await routeTrackingRepository.getRouteHistory();
    const result = calculateFinancialFuelCostsByDate(
      {},
      routeHistory,
      {
        getDailyDates: () => [],
        getDailyValues: () => ({
          fuel: '',
          fuelPrice: '',
          fuelType: 'gasolina',
          kilometers: '',
        }),
        getLatestFuelPrice: () => '6',
        getLatestFuelType: () => 'gasolina',
      },
      { alcoholAutonomy: '5,6 Km/l', gasolineAutonomy: '7,4 Km/l' },
    );

    expect(result['2026-08-06']).toBeCloseTo((10 / 7.4) * 6, 8);
  });

  it('chooses the same duplicate record regardless of storage order', async () => {
    const incomplete = { ...sessions[0], pointsCount: 0, samples: [] };
    const complete = {
      ...sessions[0],
      pointsCount: 1,
      samples: [{ accuracy: 10, latitude: -25.4296, longitude: -49.2719, timestamp: 1_500 }],
    };

    await AsyncStorage.setItem(
      getRouteTrackingHistoryStorageKey(TEST_UID),
      JSON.stringify([incomplete, complete]),
    );
    const firstOrderResult = await routeTrackingRepository.getRouteSessionById(sessions[0].id);

    await AsyncStorage.setItem(
      getRouteTrackingHistoryStorageKey(TEST_UID),
      JSON.stringify([complete, incomplete]),
    );
    const secondOrderResult = await routeTrackingRepository.getRouteSessionById(sessions[0].id);

    expect(firstOrderResult).toEqual(complete);
    expect(secondOrderResult).toEqual(complete);
  });

  it('does not rewrite storage when reading duplicate history and keeps invalid entries safely ignored', async () => {
    const serialized = JSON.stringify([
      sessions[0],
      sessions[0],
      { id: 'invalid', status: 'finalized' },
    ]);
    await AsyncStorage.setItem(getRouteTrackingHistoryStorageKey(TEST_UID), serialized);
    jest.mocked(AsyncStorage.setItem).mockClear();

    await expect(routeTrackingRepository.getRouteHistory()).resolves.toEqual([sessions[0]]);
    expect(jest.mocked(AsyncStorage.setItem)).not.toHaveBeenCalled();
    await expect(AsyncStorage.getItem(getRouteTrackingHistoryStorageKey(TEST_UID))).resolves.toBe(
      serialized,
    );
  });

  it('sums multiple routes from the same day', async () => {
    await AsyncStorage.setItem(
      getRouteTrackingHistoryStorageKey(TEST_UID),
      JSON.stringify(sessions),
    );

    expect(await routeTrackingRepository.getTotalDistanceForDate('2026-08-06')).toBe(21);
  });

  it('does not mix routes from other days', async () => {
    await AsyncStorage.setItem(
      getRouteTrackingHistoryStorageKey(TEST_UID),
      JSON.stringify(sessions),
    );

    expect(await routeTrackingRepository.getTotalDistanceForDate('2026-08-07')).toBe(99);
  });

  it('does not include active or non-finalized records', async () => {
    await AsyncStorage.setItem(
      getRouteTrackingHistoryStorageKey(TEST_UID),
      JSON.stringify([sessions[0], { ...sessions[1], status: 'active' }]),
    );

    expect(await routeTrackingRepository.getTotalDistanceForDate('2026-08-06')).toBe(12.4);
  });

  it('removes only the selected finalized route and its GPS samples', async () => {
    const first = { ...sessions[0], samples: [location(-25.4296, -49.2719, 1_000)] };
    await AsyncStorage.setItem(
      getRouteTrackingHistoryStorageKey(TEST_UID),
      JSON.stringify([first, sessions[1]]),
    );

    await expect(routeTrackingRepository.removeRouteSession(first.id)).resolves.toBe(true);

    expect(await routeTrackingRepository.getRouteHistory()).toEqual([sessions[1]]);
    expect(await routeTrackingRepository.getTotalDistanceForDate('2026-08-06')).toBe(8.6);
    await expect(routeTrackingRepository.removeRouteSession(first.id)).resolves.toBe(false);
  });

  it('returns the latest finalized route even with 0 km or few samples', async () => {
    const zeroKmSession: RouteTrackingSession = {
      date: '2026-08-16',
      distanceMeters: 0,
      durationSeconds: 5,
      endTimestamp: 205_000,
      id: 'session-zero',
      ownerUid: TEST_UID,
      pointsCount: 1,
      samples: [
        {
          accuracy: 10,
          latitude: -25.4296,
          longitude: -49.2719,
          timestamp: 200_000,
        },
      ],
      startTimestamp: 200_000,
      status: 'finalized',
    };

    await AsyncStorage.setItem(
      getRouteTrackingHistoryStorageKey(TEST_UID),
      JSON.stringify([...sessions, zeroKmSession]),
    );

    const latest = await routeTrackingRepository.getLatestCompletedRoute();
    expect(latest).toEqual(zeroKmSession);
    expect(routeTrackingRepository.getMemoryLatestCompletedRoute()).toEqual(zeroKmSession);
  });

  it('returns null when there are no finalized routes', async () => {
    await AsyncStorage.setItem(getRouteTrackingHistoryStorageKey(TEST_UID), JSON.stringify([]));

    const latest = await routeTrackingRepository.getLatestCompletedRoute();
    expect(latest).toBeNull();
    expect(routeTrackingRepository.getMemoryLatestCompletedRoute()).toBeNull();
  });
});
