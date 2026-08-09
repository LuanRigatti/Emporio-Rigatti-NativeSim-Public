import { createElement, useCallback } from 'react';
import { View } from 'react-native';

import { hasNativeModule } from '@/platform/nativeModules';
import { getRuntimeEnvironment } from '@/platform/runtimeEnvironment';
import { useLazyNativeImplementation } from '@/platform/useLazyNativeImplementation';
import { useAppTheme } from '@/theme';

import { NativeTrackedRouteMapFallback } from './NativeTrackedRouteMapFallback';
import type { NativeTrackedRouteMapProps } from './NativeTrackedRouteMap.types';

function canUseExpoMaps() {
  return getRuntimeEnvironment() === 'development-build' && hasNativeModule('ExpoMaps');
}

function NativeTrackedRouteMapLoading({ style }: Pick<NativeTrackedRouteMapProps, 'style'>) {
  const { theme } = useAppTheme();

  return <View style={[{ backgroundColor: theme.colors.surface }, style]} />;
}

export function NativeTrackedRouteMap(props: NativeTrackedRouteMapProps) {
  const expoMapsAvailable = canUseExpoMaps();
  const loadImplementation = useCallback(
    () =>
      import('./NativeTrackedRouteMapDevelopment').then((module) => module.NativeTrackedRouteMap),
    [],
  );
  const NativeImplementation = useLazyNativeImplementation(expoMapsAvailable, loadImplementation);

  if (NativeImplementation) return createElement(NativeImplementation, props);
  if (expoMapsAvailable) return <NativeTrackedRouteMapLoading style={props.style} />;
  return <NativeTrackedRouteMapFallback {...props} />;
}
