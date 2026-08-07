import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
});
