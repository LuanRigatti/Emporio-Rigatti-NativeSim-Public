import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { calculateFinancialFuelCostsByDate } from '@/services/expenses/FinancialFuelCostService';
import {
  appendValidLocationSamples,
  calculateDistanceMeters,
} from '@/services/routes/routeTrackingMath';
import { LocationTrackingService } from '@/services/routes/LocationTrackingService';
import {
  ROUTE_TRACKING_HISTORY_STORAGE_KEY,
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

describe('route distance by day', () => {
  const sessions: RouteTrackingSession[] = [
    {
      date: '2026-08-06',
      distanceMeters: 12_400,
      durationSeconds: 120,
      endTimestamp: 2_000,
      id: 'route-1',
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
      pointsCount: 2,
      samples: [],
      startTimestamp: 5_000,
      status: 'finalized',
    },
  ];

  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('returns zero when the day has no finalized routes', async () => {
    expect(await routeTrackingRepository.getTotalDistanceForDate('2026-08-05')).toBe(0);
  });

  it('returns the distance of one route', async () => {
    await AsyncStorage.setItem(ROUTE_TRACKING_HISTORY_STORAGE_KEY, JSON.stringify([sessions[0]]));

    expect(await routeTrackingRepository.getTotalDistanceForDate('2026-08-06')).toBe(12.4);
  });

  it('returns one finalized session by id without changing its samples', async () => {
    const session = {
      ...sessions[0],
      samples: [{ accuracy: 5, latitude: -25.4296, longitude: -49.2719, timestamp: 1_000 }],
    };
    await AsyncStorage.setItem(ROUTE_TRACKING_HISTORY_STORAGE_KEY, JSON.stringify([session]));

    await expect(routeTrackingRepository.getRouteSessionById(session.id)).resolves.toEqual(session);
  });

  it('deduplicates identical route ids before calculating distance and route count', async () => {
    const duplicated = [sessions[0], { ...sessions[0] }];
    await AsyncStorage.setItem(ROUTE_TRACKING_HISTORY_STORAGE_KEY, JSON.stringify(duplicated));

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
      ROUTE_TRACKING_HISTORY_STORAGE_KEY,
      JSON.stringify([incomplete, complete]),
    );

    await expect(routeTrackingRepository.getRouteSessionById(sessions[0].id)).resolves.toEqual(
      complete,
    );
  });

  it('uses the most recent timestamps when duplicate records have equivalent completeness', async () => {
    const older = { ...sessions[0], endTimestamp: 2_000, startTimestamp: 1_000 };
    const newer = { ...sessions[0], endTimestamp: 4_000, startTimestamp: 3_000 };
    await AsyncStorage.setItem(ROUTE_TRACKING_HISTORY_STORAGE_KEY, JSON.stringify([older, newer]));

    await expect(routeTrackingRepository.getRouteSessionById(sessions[0].id)).resolves.toEqual(
      newer,
    );
  });

  it('keeps routes with different ids independent even when date and distance match', async () => {
    const secondRoute = { ...sessions[0], id: 'route-4' };
    await AsyncStorage.setItem(
      ROUTE_TRACKING_HISTORY_STORAGE_KEY,
      JSON.stringify([sessions[0], secondRoute]),
    );

    await expect(routeTrackingRepository.getRouteDistanceForDate('2026-08-06')).resolves.toEqual({
      routeCount: 2,
      totalKilometers: 24.8,
    });
  });

  it('preserves a history without duplicate ids exactly as before', async () => {
    await AsyncStorage.setItem(ROUTE_TRACKING_HISTORY_STORAGE_KEY, JSON.stringify(sessions));

    await expect(routeTrackingRepository.getRouteHistory()).resolves.toEqual(sessions);
  });

  it('does not inflate the financial fuel cost when the same route is stored twice', async () => {
    const duplicated = [
      { ...sessions[0], distanceMeters: 10_000 },
      { ...sessions[0], distanceMeters: 10_000 },
    ];
    await AsyncStorage.setItem(ROUTE_TRACKING_HISTORY_STORAGE_KEY, JSON.stringify(duplicated));

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
      ROUTE_TRACKING_HISTORY_STORAGE_KEY,
      JSON.stringify([incomplete, complete]),
    );
    const firstOrderResult = await routeTrackingRepository.getRouteSessionById(sessions[0].id);

    await AsyncStorage.setItem(
      ROUTE_TRACKING_HISTORY_STORAGE_KEY,
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
    await AsyncStorage.setItem(ROUTE_TRACKING_HISTORY_STORAGE_KEY, serialized);
    jest.mocked(AsyncStorage.setItem).mockClear();

    await expect(routeTrackingRepository.getRouteHistory()).resolves.toEqual([sessions[0]]);
    expect(jest.mocked(AsyncStorage.setItem)).not.toHaveBeenCalled();
    await expect(AsyncStorage.getItem(ROUTE_TRACKING_HISTORY_STORAGE_KEY)).resolves.toBe(
      serialized,
    );
  });

  it('sums multiple routes from the same day', async () => {
    await AsyncStorage.setItem(ROUTE_TRACKING_HISTORY_STORAGE_KEY, JSON.stringify(sessions));

    expect(await routeTrackingRepository.getTotalDistanceForDate('2026-08-06')).toBe(21);
  });

  it('does not mix routes from other days', async () => {
    await AsyncStorage.setItem(ROUTE_TRACKING_HISTORY_STORAGE_KEY, JSON.stringify(sessions));

    expect(await routeTrackingRepository.getTotalDistanceForDate('2026-08-07')).toBe(99);
  });

  it('does not include active or non-finalized records', async () => {
    await AsyncStorage.setItem(
      ROUTE_TRACKING_HISTORY_STORAGE_KEY,
      JSON.stringify([sessions[0], { ...sessions[1], status: 'active' }]),
    );

    expect(await routeTrackingRepository.getTotalDistanceForDate('2026-08-06')).toBe(12.4);
  });

  it('removes only the selected finalized route and its GPS samples', async () => {
    const first = { ...sessions[0], samples: [location(-25.4296, -49.2719, 1_000)] };
    await AsyncStorage.setItem(
      ROUTE_TRACKING_HISTORY_STORAGE_KEY,
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
      ROUTE_TRACKING_HISTORY_STORAGE_KEY,
      JSON.stringify([...sessions, zeroKmSession]),
    );

    const latest = await routeTrackingRepository.getLatestCompletedRoute();
    expect(latest).toEqual(zeroKmSession);
    expect(routeTrackingRepository.getMemoryLatestCompletedRoute()).toEqual(zeroKmSession);
  });

  it('returns null when there are no finalized routes', async () => {
    await AsyncStorage.setItem(ROUTE_TRACKING_HISTORY_STORAGE_KEY, JSON.stringify([]));

    const latest = await routeTrackingRepository.getLatestCompletedRoute();
    expect(latest).toBeNull();
    expect(routeTrackingRepository.getMemoryLatestCompletedRoute()).toBeNull();
  });
});
