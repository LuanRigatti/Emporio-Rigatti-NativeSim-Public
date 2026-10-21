import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  RouteTrackingLiveActivityOwnership,
  RouteTrackingLiveActivityOwnershipStore as Store,
} from './RouteTrackingLiveActivityContracts';

export const ROUTE_TRACKING_LIVE_ACTIVITY_OWNERSHIP_KEY =
  '@pareact/live-activity/route-tracking-owner-v1';

function parseOwnership(value: string | null): RouteTrackingLiveActivityOwnership | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const ownership = parsed as Partial<RouteTrackingLiveActivityOwnership>;
    if (
      typeof ownership.activityId !== 'string' ||
      !ownership.activityId.trim() ||
      typeof ownership.lastPublishedDistanceMeters !== 'number' ||
      !Number.isFinite(ownership.lastPublishedDistanceMeters) ||
      ownership.lastPublishedDistanceMeters < 0 ||
      typeof ownership.routeId !== 'string' ||
      !ownership.routeId.trim() ||
      typeof ownership.startTimestamp !== 'number' ||
      !Number.isFinite(ownership.startTimestamp) ||
      typeof ownership.uid !== 'string' ||
      !ownership.uid.trim()
    ) {
      return null;
    }

    return ownership as RouteTrackingLiveActivityOwnership;
  } catch {
    return null;
  }
}

export class AsyncStorageRouteTrackingLiveActivityOwnershipStore implements Store {
  public async read(): Promise<RouteTrackingLiveActivityOwnership | null> {
    return parseOwnership(await AsyncStorage.getItem(ROUTE_TRACKING_LIVE_ACTIVITY_OWNERSHIP_KEY));
  }

  public async write(ownership: RouteTrackingLiveActivityOwnership): Promise<void> {
    await AsyncStorage.setItem(
      ROUTE_TRACKING_LIVE_ACTIVITY_OWNERSHIP_KEY,
      JSON.stringify(ownership),
    );
  }

  public async clear(): Promise<void> {
    await AsyncStorage.removeItem(ROUTE_TRACKING_LIVE_ACTIVITY_OWNERSHIP_KEY);
  }
}

export const routeTrackingLiveActivityOwnershipStore =
  new AsyncStorageRouteTrackingLiveActivityOwnershipStore();
