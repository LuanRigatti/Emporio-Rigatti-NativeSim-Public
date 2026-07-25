/// <reference types="google.maps" />

import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { useAppTheme } from '@/theme';
import { getWebRouteMapState } from '@/services/routes';
import type { RouteCoordinate, RouteStop } from '@/types/route';

export type NativeRouteMapProps = {
  stops: readonly RouteStop[];
  polylines: readonly RouteCoordinate[][];
  initialCoordinate?: RouteCoordinate;
  selectable?: boolean;
  onSelectCoordinate?: (coordinate: RouteCoordinate) => void;
};

type MapStatus = 'loading' | 'ready' | 'empty' | 'error';

function validCoordinate(coordinate: RouteCoordinate | undefined): coordinate is RouteCoordinate {
  return Boolean(
    coordinate && Number.isFinite(coordinate.latitude) && Number.isFinite(coordinate.longitude),
  );
}

function toLatLng(coordinate: RouteCoordinate): google.maps.LatLngLiteral {
  return { lat: coordinate.latitude, lng: coordinate.longitude };
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ??
      character,
  );
}

function markerColor(stop: RouteStop, colors: ReturnType<typeof useAppTheme>['theme']['colors']) {
  if (stop.kind === 'origin') return colors.success;
  if (stop.kind === 'destination') return colors.textSecondary;
  if (stop.kind === 'mandatory') return colors.info;
  return colors.primary;
}

export function NativeRouteMap({
  stops,
  polylines,
  initialCoordinate,
  selectable = false,
  onSelectCoordinate,
}: NativeRouteMapProps) {
  const { theme } = useAppTheme();
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<MapStatus>(stops.length > 0 ? 'loading' : 'empty');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let disposed = false;
    let map: google.maps.Map | undefined;
    let markers: google.maps.Marker[] = [];
    let routeLines: google.maps.Polyline[] = [];
    let mapClickListener: google.maps.MapsEventListener | undefined;

    const renderMap = async () => {
      const element = mapElementRef.current;
      const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY?.trim();
      const usableStops = stops.filter((stop) => validCoordinate(stop.coordinates));
      const centerCoordinate = usableStops[0]?.coordinates ?? initialCoordinate;
      const center = centerCoordinate ? toLatLng(centerCoordinate) : undefined;
      const mapState = getWebRouteMapState({
        hasApiKey: Boolean(key),
        hasCenter: Boolean(center),
        hasConfirmedStops: usableStops.length > 0,
        selectable,
      });

      if (mapState === 'empty') {
        setStatus('empty');
        setMessage('Nenhum ponto confirmado para exibir no mapa.');
        return;
      }
      if (mapState === 'missingKey') {
        setStatus('error');
        setMessage('Mapa Web indisponível: configure EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY.');
        return;
      }
      if (mapState === 'missingCenter' || !element || !center) {
        setStatus('error');
        setMessage('Não foi possível definir o centro inicial do mapa.');
        return;
      }

      setStatus('loading');
      setMessage('Carregando mapa…');
      try {
        setOptions({ key, language: 'pt-BR', region: 'BR', v: 'weekly' });
        const mapsLibrary = (await importLibrary('maps')) as google.maps.MapsLibrary;
        const markerLibrary = (await importLibrary('marker')) as google.maps.MarkerLibrary;
        if (disposed) return;

        const Map = mapsLibrary.Map;
        const Polyline = mapsLibrary.Polyline;
        const Marker = markerLibrary.Marker;
        map = new Map(element, {
          center,
          fullscreenControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          zoom: usableStops.length > 1 ? 12 : 15,
        });

        const bounds = new google.maps.LatLngBounds();
        usableStops.forEach((stop) => {
          bounds.extend(toLatLng(stop.coordinates));
          const marker = new Marker({
            icon: {
              fillColor: markerColor(stop, theme.colors),
              fillOpacity: 1,
              path: google.maps.SymbolPath.CIRCLE,
              scale: 9,
              strokeColor: theme.colors.surface,
              strokeWeight: 2,
            },
            label: {
              color: theme.colors.textInverse,
              fontWeight: '700',
              text:
                stop.kind === 'origin'
                  ? 'P'
                  : stop.kind === 'destination'
                    ? 'F'
                    : String(stop.sequence),
            },
            map,
            position: toLatLng(stop.coordinates),
            title: `${stop.sequence}. ${stop.label}`,
          });
          markers.push(marker);
        });

        const infoWindow = new google.maps.InfoWindow();
        usableStops.forEach((stop, index) => {
          const marker = markers[index];
          marker?.addListener('click', () => {
            infoWindow.setContent(
              `<strong>${escapeHtml(`${stop.sequence}. ${stop.label}`)}</strong><br />${escapeHtml(stop.address)}`,
            );
            infoWindow.open({ anchor: marker, map });
          });
        });

        polylines.forEach((coordinates, index) => {
          const path = coordinates.filter(validCoordinate).map(toLatLng);
          if (path.length < 2) return;
          path.forEach((coordinate) => bounds.extend(coordinate));
          routeLines.push(
            new Polyline({
              geodesic: true,
              map,
              path,
              strokeColor: theme.colors.primary,
              strokeOpacity: 0.85,
              strokeWeight: 5,
              zIndex: index + 1,
            }),
          );
        });

        if (usableStops.length > 1 || routeLines.length > 0) map.fitBounds(bounds);
        else map.setCenter(center);
        if (selectable) {
          mapClickListener = map.addListener('click', (event: google.maps.MapMouseEvent) => {
            if (event.latLng) {
              const coordinate = event.latLng.toJSON();
              onSelectCoordinate?.({ latitude: coordinate.lat, longitude: coordinate.lng });
            }
          });
        }
        setStatus('ready');
        setMessage('');
      } catch (error) {
        if (disposed) return;
        setStatus('error');
        setMessage(
          error instanceof Error
            ? `Não foi possível carregar o mapa Web: ${error.message}`
            : 'Não foi possível carregar o mapa Web.',
        );
      }
    };

    void renderMap();
    return () => {
      disposed = true;
      mapClickListener?.remove();
      markers.forEach((marker) => marker.setMap(null));
      routeLines.forEach((line) => line.setMap(null));
      map = undefined;
      markers = [];
      routeLines = [];
    };
  }, [initialCoordinate, onSelectCoordinate, polylines, selectable, stops, theme.colors]);

  return (
    <View
      style={{
        flex: 1,
        position: 'relative',
      }}
    >
      <div ref={mapElementRef} style={{ height: '100%', width: '100%' }} />
      {status !== 'ready' ? (
        <View
          style={{
            alignItems: 'center',
            backgroundColor: theme.colors.surface,
            bottom: 0,
            justifyContent: 'center',
            left: 0,
            padding: theme.spacing.md,
            position: 'absolute',
            right: 0,
            top: 0,
          }}
        >
          <Text
            accessibilityRole={status === 'error' ? 'alert' : 'text'}
            style={[
              theme.typography.body,
              { color: theme.colors.textSecondary, textAlign: 'center' },
            ]}
          >
            {message || 'Carregando mapa…'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
