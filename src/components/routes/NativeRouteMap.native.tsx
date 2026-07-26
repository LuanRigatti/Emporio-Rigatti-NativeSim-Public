import { AppleMaps, GoogleMaps } from 'expo-maps';
import { Platform, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';
import type { RouteCoordinate, RouteStop } from '@/types/route';

export type NativeRouteMapProps = {
  stops: readonly RouteStop[];
  polylines: readonly RouteCoordinate[][];
  initialCoordinate?: RouteCoordinate;
  selectable?: boolean;
  onSelectCoordinate?: (coordinate: RouteCoordinate) => void;
};

function validCoordinate(coordinate: {
  latitude?: number;
  longitude?: number;
}): coordinate is RouteCoordinate {
  return Number.isFinite(coordinate.latitude) && Number.isFinite(coordinate.longitude);
}

export function NativeRouteMap({
  stops,
  polylines,
  initialCoordinate,
  selectable = false,
  onSelectCoordinate,
}: NativeRouteMapProps) {
  const { theme } = useAppTheme();
  const firstStop = stops[0];
  const cameraCoordinate = firstStop?.coordinates ?? initialCoordinate;
  if (!cameraCoordinate) {
    return (
      <View
        style={{
          alignItems: 'center',
          backgroundColor: theme.colors.surface,
          flex: 1,
          justifyContent: 'center',
          padding: theme.spacing.md,
        }}
      >
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          Nenhum ponto confirmado para exibir no mapa.
        </Text>
      </View>
    );
  }

  const cameraPosition = {
    coordinates: cameraCoordinate,
    zoom: 11,
  };

  if (Platform.OS === 'ios') {
    return (
      <AppleMaps.View
        annotations={stops.map((stop) => ({
          coordinates: stop.coordinates,
          id: stop.id,
          monogram: stop.sequence.toString(),
          title: `${stop.sequence}. ${stop.label}`,
        }))}
        cameraPosition={cameraPosition}
        onMapClick={(event) => {
          if (selectable && validCoordinate(event.coordinates))
            onSelectCoordinate?.(event.coordinates);
        }}
        polylines={polylines.map((coordinates, index) => ({
          color: theme.colors.primary,
          coordinates,
          id: `route-polyline-${index}`,
          width: 5,
        }))}
        style={{ flex: 1 }}
        uiSettings={{ compassEnabled: true, scaleBarEnabled: true }}
      />
    );
  }

  if (Platform.OS === 'android') {
    return (
      <GoogleMaps.View
        cameraPosition={cameraPosition}
        markers={stops.map((stop) => ({
          coordinates: stop.coordinates,
          id: stop.id,
          showCallout: true,
          snippet: stop.address,
          title: `${stop.sequence}. ${stop.label}`,
        }))}
        onMapClick={(event) => {
          if (selectable && validCoordinate(event.coordinates))
            onSelectCoordinate?.(event.coordinates);
        }}
        polylines={polylines.map((coordinates, index) => ({
          color: theme.colors.primary,
          coordinates,
          id: `route-polyline-${index}`,
          width: 5,
        }))}
        style={{ flex: 1 }}
        uiSettings={{ compassEnabled: true, myLocationButtonEnabled: false }}
      />
    );
  }

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        flex: 1,
        justifyContent: 'center',
      }}
    >
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
        O mapa nativo está disponível no iOS e Android.
      </Text>
    </View>
  );
}
