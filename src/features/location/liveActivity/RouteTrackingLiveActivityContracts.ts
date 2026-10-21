import type { RouteTrackingRecord } from '@/types/routeTracking';

export type RouteTrackingLiveActivityContent = {
  distanceMeters: number;
  endTimestamp?: number;
  routeId: string;
  startTimestamp: number;
};

export type RouteTrackingLiveActivityOwnership = {
  activityId: string;
  lastPublishedDistanceMeters: number;
  routeId: string;
  startTimestamp: number;
  uid: string;
};

export interface RouteTrackingLiveActivityInstance {
  getId(): string;
  update(content: RouteTrackingLiveActivityContent): Promise<void>;
  end(
    dismissalPolicy?: 'default' | 'immediate',
    content?: RouteTrackingLiveActivityContent,
    contentDate?: Date,
  ): Promise<void>;
}

export interface RouteTrackingLiveActivityDriver {
  getInstances(): RouteTrackingLiveActivityInstance[];
  start(content: RouteTrackingLiveActivityContent, url: string): RouteTrackingLiveActivityInstance;
}

export interface RouteTrackingLiveActivityOwnershipStore {
  read(): Promise<RouteTrackingLiveActivityOwnership | null>;
  write(ownership: RouteTrackingLiveActivityOwnership): Promise<void>;
  clear(): Promise<void>;
}

export type RouteTrackingLiveActivityRoute = Pick<
  RouteTrackingRecord,
  | 'active'
  | 'accumulatedDistanceMeters'
  | 'endTimestamp'
  | 'ownerUid'
  | 'routeId'
  | 'startTimestamp'
>;
