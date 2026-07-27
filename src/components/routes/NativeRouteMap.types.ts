import type { RouteCoordinate, RouteStop } from '@/types/route';

export type NativeRouteMapProps = {
  stops: readonly RouteStop[];
  polylines: readonly RouteCoordinate[][];
  initialCoordinate?: RouteCoordinate;
  selectable?: boolean;
  onSelectCoordinate?: (coordinate: RouteCoordinate) => void;
};
