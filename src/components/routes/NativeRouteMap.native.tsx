import { useCallback } from 'react';

import { hasNativeModule } from '@/platform/nativeModules';
import { getRuntimeEnvironment } from '@/platform/runtimeEnvironment';
import { useLazyNativeImplementation } from '@/platform/useLazyNativeImplementation';

import { NativeRouteMapFallback } from './NativeRouteMapFallback';
import type { NativeRouteMapProps } from './NativeRouteMap.types';

function canUseExpoMaps() {
  return getRuntimeEnvironment() === 'development-build' && hasNativeModule('ExpoMaps');
}

export function NativeRouteMap(props: NativeRouteMapProps) {
  const expoMapsAvailable = canUseExpoMaps();
  const loadImplementation = useCallback(
    () => import('./NativeRouteMapDevelopment').then((module) => module.NativeRouteMap),
    [],
  );
  const NativeImplementation = useLazyNativeImplementation(expoMapsAvailable, loadImplementation);

  return NativeImplementation ? (
    <NativeImplementation {...props} />
  ) : (
    <NativeRouteMapFallback {...props} />
  );
}
