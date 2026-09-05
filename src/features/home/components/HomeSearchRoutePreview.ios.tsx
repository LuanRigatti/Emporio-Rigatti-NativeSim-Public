import { RNHostView, VStack } from '@expo/ui/swift-ui';
import { clipped, frame } from '@expo/ui/swift-ui/modifiers';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { NativeTrackedRoutesMap } from '@/components/routes';
import { locationTrackingService } from '@/services/routes';
import type { RouteTrackingSession } from '@/types/routeTracking';
import { getCardSurfaceColor, useAppTheme } from '@/theme';
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
  const { resolvedMode, theme } = useAppTheme();
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
        setState({
          history,
          loaded: true,
          unavailable: false,
        });
      })
      .catch(() => {
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

  return (
    <VStack
      alignment="leading"
      modifiers={[frame({ height, maxWidth: Infinity, alignment: 'topLeading' }), clipped()]}
    >
      <RNHostView matchContents={false}>
        <View
          pointerEvents={isLarge ? 'auto' : 'none'}
          style={{
            backgroundColor: getCardSurfaceColor(resolvedMode, theme.colors.surface),
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
