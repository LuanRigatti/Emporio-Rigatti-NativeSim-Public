import { AppleMaps, GoogleMaps } from 'expo-maps';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import {
  cancelAnimation,
  Easing,
  runOnJS,
  runOnUI,
  useAnimatedReaction,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '@/theme';
import { NativeTrackedRouteMapFallback } from './NativeTrackedRouteMapFallback';
import { NativeTrackedRoutesMapFallback } from './NativeTrackedRoutesMapFallback';
import {
  createTrackedRouteProjection,
  getTrackedRouteCameraPosition,
  getVisibleTrackedRouteCoordinates,
} from './NativeTrackedRouteMapProjection';
import type {
  NativeTrackedRoute,
  NativeTrackedRouteMapProps,
  NativeTrackedRoutesMapProps,
} from './NativeTrackedRouteMap.types';

function startRouteAnimation(progress: { value: number }, duration: number) {
  'worklet';

  progress.value = withSequence(
    withTiming(0, { duration: 0 }),
    withTiming(1, { duration, easing: Easing.inOut(Easing.cubic) }),
  );
}

function routeDatasetKey(
  routes: readonly NativeTrackedRoute[],
  preparedRoutes: ReturnType<typeof createTrackedRouteProjection>['routes'],
): string {
  return routes
    .map((route) => {
      const preparedRoute = preparedRoutes.find((item) => item.routeId === route.routeId);
      const lastSample = route.samples[route.samples.length - 1];
      return `${route.routeId}:${preparedRoute?.coordinates.length ?? 0}:${lastSample?.timestamp ?? 0}`;
    })
    .join('|');
}

function TrackedRoutesMap({
  animate = true,
  interactive = true,
  routes,
  style,
}: NativeTrackedRoutesMapProps) {
  const { theme } = useAppTheme();
  const projection = useMemo(() => createTrackedRouteProjection(routes), [routes]);
  const preparedRoutes = projection.routes;
  const allCoordinates = projection.allCoordinates;
  const datasetKey = useMemo(
    () => routeDatasetKey(routes, preparedRoutes),
    [preparedRoutes, routes],
  );
  const animationProgress = useSharedValue(0);
  const [animationState, setAnimationState] = useState(() => ({
    datasetKey,
    progress: 0,
  }));
  const updateProgress = useCallback(
    (progress: number, nextDatasetKey: string) =>
      setAnimationState({ datasetKey: nextDatasetKey, progress }),
    [],
  );

  useAnimatedReaction(
    () => animationProgress.value,
    (current, previous) => {
      if (current !== previous) runOnJS(updateProgress)(current, datasetKey);
    },
    [datasetKey, updateProgress],
  );

  useEffect(() => {
    if (!animate) return undefined;

    const points = allCoordinates.length;
    const duration = Math.min(1200, 800 + Math.min(400, points));
    runOnUI(startRouteAnimation)(animationProgress, duration);

    return () => cancelAnimation(animationProgress);
  }, [animate, allCoordinates.length, animationProgress, datasetKey]);

  const visibleProgress = !animate
    ? 1
    : animationState.datasetKey === datasetKey
      ? animationState.progress
      : 0;
  const visibleRoutes = preparedRoutes.map((route) => ({
    ...route,
    coordinates: getVisibleTrackedRouteCoordinates(route.coordinates, visibleProgress),
  }));
  const cameraPosition =
    allCoordinates.length > 0 ? getTrackedRouteCameraPosition(allCoordinates) : undefined;
  const markers = preparedRoutes.flatMap(({ coordinates, routeId }) => [
    {
      coordinates: coordinates[0],
      id: `${routeId}-start`,
      systemImage: 'play.fill',
      title: 'Início da rota',
      tintColor: theme.colors.success,
    },
    ...(coordinates.length > 1
      ? [
          {
            coordinates: coordinates[coordinates.length - 1],
            id: `${routeId}-end`,
            systemImage: 'flag.fill',
            title: 'Fim da rota',
            tintColor: theme.colors.danger,
          },
        ]
      : []),
  ]);

  if (!cameraPosition) {
    if (routes.length === 1) {
      return (
        <NativeTrackedRouteMapFallback
          routeId={routes[0].routeId}
          samples={routes[0].samples}
          style={style}
        />
      );
    }
    return <NativeTrackedRoutesMapFallback routes={routes} style={style} />;
  }

  const polylines = visibleRoutes.flatMap(({ coordinates, routeId }) =>
    coordinates.length > 1
      ? [
          {
            color: theme.colors.textPrimary,
            coordinates,
            id: `${routeId}-path`,
            width: 5,
          },
        ]
      : [],
  );

  if (Platform.OS === 'ios') {
    return (
      <AppleMaps.View
        annotations={markers}
        cameraPosition={cameraPosition}
        polylines={polylines}
        style={style}
        uiSettings={{
          compassEnabled: interactive,
          scaleBarEnabled: interactive,
          togglePitchEnabled: interactive,
        }}
      />
    );
  }

  if (Platform.OS === 'android') {
    return (
      <GoogleMaps.View
        cameraPosition={cameraPosition}
        markers={markers.map((marker) => ({
          coordinates: marker.coordinates,
          id: marker.id,
          title: marker.title,
        }))}
        polylines={polylines}
        style={style}
        uiSettings={{
          compassEnabled: interactive,
          myLocationButtonEnabled: false,
          scaleBarEnabled: interactive,
        }}
      />
    );
  }

  return <NativeTrackedRoutesMapFallback routes={routes} style={style} />;
}

export function NativeTrackedRouteMap(props: NativeTrackedRouteMapProps) {
  return (
    <TrackedRoutesMap {...props} routes={[{ routeId: props.routeId, samples: props.samples }]} />
  );
}

export function NativeTrackedRoutesMap(props: NativeTrackedRoutesMapProps) {
  return <TrackedRoutesMap {...props} />;
}
