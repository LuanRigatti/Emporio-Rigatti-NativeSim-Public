import type { ComponentType } from 'react';
import { Platform } from 'react-native';

import type { RouteCoordinate, RouteStop } from '@/types/route';

export type NativeRouteMapProps = {
  stops: readonly RouteStop[];
  polylines: readonly RouteCoordinate[][];
  initialCoordinate?: RouteCoordinate;
  selectable?: boolean;
  onSelectCoordinate?: (coordinate: RouteCoordinate) => void;
};

type RouteMapModule = { NativeRouteMap: ComponentType<NativeRouteMapProps> };

export function NativeRouteMap(props: NativeRouteMapProps) {
  // expo-maps is native-only; keep it out of the Web bundle.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const module: RouteMapModule = require(
    Platform.OS === 'web' ? './NativeRouteMap.web' : './NativeRouteMap.native',
  ) as RouteMapModule;
  const MapComponent = module.NativeRouteMap;
  return <MapComponent {...props} />;
}
