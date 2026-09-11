export interface RouteTrackingSample {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface RouteTrackingRecord {
  routeId: string;
  startTimestamp: number;
  active: boolean;
  stopRequestedAt?: number;
  samples: RouteTrackingSample[];
  accumulatedDistanceMeters: number;
  endTimestamp?: number;
}

export interface RouteTrackingSession {
  id: string;
  date: string;
  startTimestamp: number;
  endTimestamp: number;
  durationSeconds: number;
  distanceMeters: number;
  pointsCount: number;
  samples: RouteTrackingSample[];
  status: 'finalized';
}

export interface RouteTrackingResult {
  routeId: string;
  kilometers: number;
  durationSeconds: number;
  startTimestamp: number;
  endTimestamp?: number;
}
