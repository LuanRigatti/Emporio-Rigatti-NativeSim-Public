import { RNHostView, VStack } from '@expo/ui/swift-ui';
import { clipped, frame, onGeometryChange } from '@expo/ui/swift-ui/modifiers';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { NativeTrackedRoutesMap } from '@/components/routes';
import { locationTrackingService } from '@/services/routes';
import type { RouteTrackingSession } from '@/types/routeTracking';
import { useAppTheme } from '@/theme';
import { selectHomeSearchRouteSessions } from './HomeSearchRoutePreviewAdapter';

const ROUTE_MAP_PREVIEW_HEIGHT = {
  fixed: 180,
} as const;

type Props = {
  isLarge: boolean;
  sessionIds: readonly string[];
};

type PreviewState = {
  history: RouteTrackingSession[];
  loaded: boolean;
  unavailable: boolean;
};

export default function HomeSearchRoutePreview({ isLarge, sessionIds }: Props) {
  const { theme } = useAppTheme();
  const normalizedIds = useMemo(
    () => Array.from(new Set(sessionIds.filter((sessionId) => sessionId.length > 0))),
    [sessionIds],
  );
  const [state, setState] = useState<PreviewState>({
    history: [],
    loaded: false,
    unavailable: false,
  });

  useEffect(() => {
    let cancelled = false;

    void locationTrackingService
      .getRouteHistory()
      .then((history) => {
        if (cancelled) return;
        if (__DEV__) {
          console.log('[home-route-map]', {
            event: 'sessions-resolved',
            historyCount: history.length,
          });
        }
        setState({
          history,
          loaded: true,
          unavailable: false,
        });
      })
      .catch(() => {
        if (__DEV__) {
          console.log('[home-route-map]', {
            event: 'history-unavailable',
          });
        }
        if (!cancelled) setState({ history: [], loaded: true, unavailable: true });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const height = ROUTE_MAP_PREVIEW_HEIGHT.fixed;
  const sessions = useMemo(
    () => selectHomeSearchRouteSessions(state.history, normalizedIds),
    [normalizedIds, state.history],
  );
  const isLoading = normalizedIds.length > 0 && !state.loaded;
  const previewStatus =
    normalizedIds.length === 0 || state.unavailable
      ? 'unavailable'
      : isLoading
        ? 'loading'
        : sessions.length > 0
          ? 'ready'
          : 'unavailable';
  const visibleSessions = useMemo(() => (isLoading ? [] : sessions), [isLoading, sessions]);
  const mapRoutes = useMemo(
    () =>
      visibleSessions.map((session) => ({
        routeId: session.id,
        samples: session.samples,
      })),
    [visibleSessions],
  );

  useEffect(() => {
    if (__DEV__) {
      console.log('[home-route-map]', {
        event: 'session-ids-received',
        sessionIds: normalizedIds,
      });
    }
  }, [normalizedIds]);

  useEffect(() => {
    if (__DEV__ && previewStatus === 'ready') {
      console.log('[home-route-map]', {
        event: 'sessions-selected',
        sampleCount: visibleSessions.reduce((total, session) => total + session.samples.length, 0),
        sessionCount: visibleSessions.length,
      });
    }
  }, [previewStatus, visibleSessions]);

  return (
    <VStack
      alignment="leading"
      modifiers={[
        frame({ height, maxWidth: Infinity, alignment: 'topLeading' }),
        clipped(),
        onGeometryChange((frame) => {
          if (!__DEV__) return;
          console.log('[bottom-sheet-geometry]', {
            height: frame.height,
            layer: 'route-preview',
            scope: isLarge ? 'home-large' : 'home-small',
            width: frame.width,
            x: frame.x,
            y: frame.y,
          });
        }),
      ]}
    >
      <RNHostView matchContents={false}>
        <View
          onLayout={(event) => {
            if (__DEV__) {
              console.log('[home-route-map]', {
                event: 'container-layout',
                height: event.nativeEvent.layout.height,
                width: event.nativeEvent.layout.width,
              });
            }
          }}
          pointerEvents={isLarge ? 'auto' : 'none'}
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.xl + theme.spacing.xs,
            height,
            overflow: 'hidden',
            width: '100%',
          }}
        >
          {previewStatus === 'ready' ? (
            <NativeTrackedRoutesMap
              animate={false}
              interactive={isLarge}
              routes={mapRoutes}
              style={{ flex: 1 }}
            />
          ) : previewStatus === 'loading' ? (
            <Text
              style={{
                color: theme.colors.textSecondary,
                padding: theme.spacing.md,
                textAlign: 'center',
              }}
            >
              Carregando prévia da rota…
            </Text>
          ) : (
            <Text
              style={{
                color: theme.colors.textSecondary,
                padding: theme.spacing.md,
                textAlign: 'center',
              }}
            >
              Prévia da rota indisponível.
            </Text>
          )}
        </View>
      </RNHostView>
    </VStack>
  );
}
