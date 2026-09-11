import type { RouteTrackingSample } from '@/types/routeTracking';

export type TrackedRouteCoordinate = { latitude: number; longitude: number };

export type TrackedRouteProjectionInput = {
  routeId: string;
  samples: readonly RouteTrackingSample[];
};

export type TrackedRouteProjection = {
  allCoordinates: TrackedRouteCoordinate[];
  routes: { coordinates: TrackedRouteCoordinate[]; routeId: string }[];
};

export const SINGLE_POINT_ROUTE_PREVIEW_ZOOM = 11;

export function createTrackedRouteProjection(
  routes: readonly TrackedRouteProjectionInput[],
): TrackedRouteProjection {
  const projectedRoutes = routes.flatMap((route) => {
    const coordinates = route.samples
      .filter((sample) => Number.isFinite(sample.latitude) && Number.isFinite(sample.longitude))
      .map(({ latitude, longitude }) => ({ latitude, longitude }));
    return coordinates.length > 0 ? [{ coordinates, routeId: route.routeId }] : [];
  });

  return {
    allCoordinates: projectedRoutes.flatMap((route) => route.coordinates),
    routes: projectedRoutes,
  };
}

export function getTrackedRouteCameraPosition(coordinates: readonly TrackedRouteCoordinate[]) {
  if (coordinates.length === 1) {
    return {
      coordinates: coordinates[0],
      zoom: SINGLE_POINT_ROUTE_PREVIEW_ZOOM,
    };
  }

  const latitudes = coordinates.map((coordinate) => coordinate.latitude);
  const longitudes = coordinates.map((coordinate) => coordinate.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const centerLatitude = (minLatitude + maxLatitude) / 2;
  const centerLongitude = (minLongitude + maxLongitude) / 2;
  const latitudeSpan = Math.max(0.002, maxLatitude - minLatitude) * 1.5;
  const longitudeSpan = Math.max(0.002, maxLongitude - minLongitude) * 1.5;
  const adjustedLongitudeSpan =
    longitudeSpan * Math.max(0.2, Math.cos((centerLatitude * Math.PI) / 180));
  const span = Math.max(latitudeSpan, adjustedLongitudeSpan);
  const zoom = Math.max(3, Math.min(18, Math.log2(360 / span)));

  return {
    coordinates: { latitude: centerLatitude, longitude: centerLongitude },
    zoom,
  };
}

export function getVisibleTrackedRouteCoordinates(
  coordinates: readonly TrackedRouteCoordinate[],
  progress: number,
): TrackedRouteCoordinate[] {
  if (coordinates.length <= 1 || progress >= 1) return [...coordinates];
  if (progress <= 0) return coordinates.length > 0 ? [coordinates[0]] : [];

  const position = progress * (coordinates.length - 1);
  const endIndex = Math.floor(position);
  return coordinates.slice(0, endIndex + 1);
}
