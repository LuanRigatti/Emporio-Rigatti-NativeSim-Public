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
import type { RouteTrackingSample } from '@/types/routeTracking';

import { NativeTrackedRouteMapFallback } from './NativeTrackedRouteMapFallback';
import type { NativeTrackedRouteMapProps } from './NativeTrackedRouteMap.types';

type Coordinate = { latitude: number; longitude: number };

function isValidSample(sample: RouteTrackingSample): boolean {
  return Number.isFinite(sample.latitude) && Number.isFinite(sample.longitude);
}

function getCameraPosition(coordinates: readonly Coordinate[]) {
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

function getVisibleCoordinates(coordinates: readonly Coordinate[], progress: number): Coordinate[] {
  if (coordinates.length <= 1 || progress >= 1) return [...coordinates];
  if (progress <= 0) return coordinates.length > 0 ? [coordinates[0]] : [];

  const position = progress * (coordinates.length - 1);
  const endIndex = Math.floor(position);
  return coordinates.slice(0, endIndex + 1);
}

function startRouteAnimation(progress: { value: number }, duration: number) {
  'worklet';

  progress.value = withSequence(
    withTiming(0, { duration: 0 }),
    withTiming(1, { duration, easing: Easing.inOut(Easing.cubic) }),
  );
}

export function NativeTrackedRouteMap({
  animate = true,
  interactive = true,
  routeId,
  samples,
  style,
}: NativeTrackedRouteMapProps) {
  const { theme } = useAppTheme();
  const coordinates = useMemo(
    () => samples.filter(isValidSample).map(({ latitude, longitude }) => ({ latitude, longitude })),
    [samples],
  );
  const lastSample = samples[samples.length - 1];
  const datasetKey = `${routeId}:${coordinates.length}:${lastSample?.timestamp ?? 0}`;
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

    const duration = Math.min(1200, 800 + Math.min(400, coordinates.length));
    runOnUI(startRouteAnimation)(animationProgress, duration);

    return () => cancelAnimation(animationProgress);
  }, [animate, animationProgress, coordinates.length, datasetKey]);

  const visibleProgress = !animate
    ? 1
    : animationState.datasetKey === datasetKey
      ? animationState.progress
      : 0;
  const visibleCoordinates = getVisibleCoordinates(coordinates, visibleProgress);
  const cameraPosition = coordinates.length > 0 ? getCameraPosition(coordinates) : undefined;
  const markers =
    coordinates.length > 0
      ? [
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
        ]
      : [];

  if (coordinates.length === 0 || !cameraPosition) {
    return <NativeTrackedRouteMapFallback routeId={routeId} samples={samples} style={style} />;
  }

  if (Platform.OS === 'ios') {
    return (
      <AppleMaps.View
        annotations={markers}
        cameraPosition={cameraPosition}
        polylines={
          visibleCoordinates.length > 1
            ? [
                {
                  color: theme.colors.textPrimary,
                  coordinates: visibleCoordinates,
                  id: `${routeId}-path`,
                  width: 5,
                },
              ]
            : []
        }
        style={style}
        uiSettings={{ compassEnabled: interactive, scaleBarEnabled: interactive }}
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
        polylines={
          visibleCoordinates.length > 1
            ? [
                {
                  color: theme.colors.textPrimary,
                  coordinates: visibleCoordinates,
                  id: `${routeId}-path`,
                  width: 5,
                },
              ]
            : []
        }
        style={style}
        uiSettings={{
          compassEnabled: interactive,
          myLocationButtonEnabled: false,
          scaleBarEnabled: interactive,
        }}
      />
    );
  }

  return <NativeTrackedRouteMapFallback routeId={routeId} samples={samples} style={style} />;
}
