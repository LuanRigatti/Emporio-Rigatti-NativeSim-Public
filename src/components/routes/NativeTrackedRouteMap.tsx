import { Platform } from 'react-native';
import type { ComponentType } from 'react';

import type {
  NativeTrackedRouteMapProps,
  NativeTrackedRoutesMapProps,
} from './NativeTrackedRouteMap.types';

export type { NativeTrackedRouteMapProps } from './NativeTrackedRouteMap.types';

type RouteMapModule = {
  NativeTrackedRouteMap: ComponentType<NativeTrackedRouteMapProps>;
  NativeTrackedRoutesMap: ComponentType<NativeTrackedRoutesMapProps>;
};

export function NativeTrackedRouteMap(props: NativeTrackedRouteMapProps) {
  // Keep platform implementations out of each other's bundles.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const module = require(
    Platform.OS === 'web' ? './NativeTrackedRouteMap.web' : './NativeTrackedRouteMap.native',
  ) as RouteMapModule;
  const MapComponent = module.NativeTrackedRouteMap;
  return <MapComponent {...props} />;
}

export function NativeTrackedRoutesMap(props: NativeTrackedRoutesMapProps) {
  // Keep platform implementations out of each other's bundles.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const module = require(
    Platform.OS === 'web' ? './NativeTrackedRouteMap.web' : './NativeTrackedRouteMap.native',
  ) as RouteMapModule;
  const MapComponent = module.NativeTrackedRoutesMap;
  return <MapComponent {...props} />;
}
