import type { ComponentType } from 'react';
import { Platform } from 'react-native';

import type { NativeRouteMapProps } from './NativeRouteMap.types';

export type { NativeRouteMapProps } from './NativeRouteMap.types';

type RouteMapModule = { NativeRouteMap: ComponentType<NativeRouteMapProps> };

export function NativeRouteMap(props: NativeRouteMapProps) {
  // Keep platform implementations out of each other's bundles.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const module = require(
    Platform.OS === 'web' ? './NativeRouteMap.web' : './NativeRouteMap.native',
  ) as RouteMapModule;
  const MapComponent = module.NativeRouteMap;
  return <MapComponent {...props} />;
}
