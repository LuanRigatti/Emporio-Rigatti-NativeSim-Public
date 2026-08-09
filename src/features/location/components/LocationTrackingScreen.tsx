import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NativeGlassHeader } from '@/components/layout';
import {
  NativeCardContextMenu,
  NativeDatePicker,
  NativeGlassBackButton,
  NativeGlassIconButton,
} from '@/components/native';
import { GlassCard, PremiumScreen } from '@/components/premium';
import { NativeTrackedRouteMap } from '@/components/routes';
import { formatRouteDateKey, locationTrackingService, RouteTrackingError } from '@/services/routes';
import type { LocationTrackingService } from '@/services/routes';
import type { RouteTrackingRecord, RouteTrackingSession } from '@/types/routeTracking';
import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';

type TrackingErrorState = {
  code?: RouteTrackingError['code'];
  message: string;
};

function formatDistance(meters: number): string {
  return `${(meters / 1000).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} km`;
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}

function createRouteId(): string {
  return `location-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseRouteDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof RouteTrackingError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Não foi possível atualizar o rastreamento de localização.';
}

export function LocationTrackingScreen() {
  const { theme } = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [route, setRoute] = useState<RouteTrackingRecord | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => formatRouteDateKey(new Date()));
  const [routeHistory, setRouteHistory] = useState<RouteTrackingSession[]>([]);
  const [busy, setBusy] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<Awaited<
    ReturnType<LocationTrackingService['getPermissionStatus']>
  > | null>(null);
  const [trackingError, setTrackingError] = useState<TrackingErrorState | null>(null);

  const refreshRoute = useCallback(async () => {
    const storedRoute = await locationTrackingService.getRoute();
    setRoute(storedRoute);
  }, []);

  const refreshHistory = useCallback(async (date: string) => {
    setRouteHistory(await locationTrackingService.getRouteHistory(date));
  }, []);

  const refreshPermissions = useCallback(async () => {
    const nextPermissionStatus = await locationTrackingService.getPermissionStatus();
    setPermissionStatus(nextPermissionStatus);
    if (nextPermissionStatus.foreground.granted && nextPermissionStatus.background.granted) {
      setTrackingError((current) => (current?.code === 'permission-denied' ? null : current));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const sync = async () => {
        const storedRoute = await locationTrackingService.getRoute();
        if (!cancelled) {
          setRoute(storedRoute);
        }
      };

      void sync();
      void refreshHistory(selectedDate);
      void refreshPermissions();
      const appStateSubscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') void refreshPermissions();
      });
      const interval = setInterval(() => void sync(), 1_000);
      return () => {
        cancelled = true;
        clearInterval(interval);
        appStateSubscription.remove();
      };
    }, [refreshHistory, refreshPermissions, selectedDate]),
  );

  useEffect(() => {
    let cancelled = false;

    void locationTrackingService.getRouteHistory(selectedDate).then((sessions) => {
      if (!cancelled) setRouteHistory(sessions);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const handleStart = useCallback(async () => {
    setBusy(true);
    setTrackingError(null);

    try {
      const startedRoute = await locationTrackingService.startRouteTracking(createRouteId());
      setRoute(startedRoute);
      triggerLightImpactHaptic();
    } catch (error) {
      setTrackingError({
        code: error instanceof RouteTrackingError ? error.code : undefined,
        message: getErrorMessage(error),
      });
      await refreshRoute();
    } finally {
      setBusy(false);
    }
  }, [refreshRoute]);

  const handleStop = useCallback(async () => {
    if (!route) return;

    setBusy(true);
    setTrackingError(null);

    try {
      const finishedRoute = await locationTrackingService.stopRouteTracking(route.routeId);
      setRoute(finishedRoute ?? (await locationTrackingService.getRoute()));
      await refreshHistory(selectedDate);
      triggerLightImpactHaptic();
    } catch (error) {
      setTrackingError({
        code: error instanceof RouteTrackingError ? error.code : undefined,
        message: getErrorMessage(error),
      });
      await refreshRoute();
    } finally {
      setBusy(false);
    }
  }, [refreshHistory, refreshRoute, route, selectedDate]);

  const handleDeleteRoute = useCallback(
    async (sessionId: string) => {
      setBusy(true);
      setTrackingError(null);

      try {
        await locationTrackingService.removeRouteSession(sessionId);
        await refreshHistory(selectedDate);
      } catch (error) {
        setTrackingError({ message: getErrorMessage(error) });
      } finally {
        setBusy(false);
      }
    },
    [refreshHistory, selectedDate],
  );

  const visibleErrorMessage =
    trackingError?.code === 'permission-denied' && permissionStatus?.background.granted
      ? undefined
      : trackingError?.message;

  const header = (
    <NativeGlassHeader
      leftActions={
        <NativeGlassBackButton
          accessibilityLabel="Voltar para Configurações"
          color={theme.colors.textPrimary}
          containerSize={theme.sizes.touchTargetMinimum}
          onPress={() => router.back()}
          size={theme.sizes.iconMedium}
        />
      }
      mode="transparent"
      rightActions={
        <NativeDatePicker
          accessibilityLabel="Selecionar dia da rota"
          mode="date"
          onChange={(nextDate) => setSelectedDate(formatRouteDateKey(nextDate))}
          style="compact"
          value={parseRouteDate(selectedDate)}
        />
      }
      title=""
    />
  );

  return (
    <View style={styles.root}>
      <PremiumScreen
        contentContainerStyle={[styles.content, { gap: theme.spacing.lg }]}
        overlayHeader={header}
        progressiveBlur
      >
        <View style={styles.historySection}>
          <Text
            style={[
              theme.typography.headline,
              { color: theme.colors.textPrimary, textAlign: 'center' },
            ]}
          >
            Rotas do dia
          </Text>
          {visibleErrorMessage ? (
            <Text style={[theme.typography.footnote, { color: theme.colors.danger }]}>
              {visibleErrorMessage}
            </Text>
          ) : null}
          {routeHistory.length > 0 ? (
            routeHistory.map((session) => (
              <RouteHistoryCard
                key={session.id}
                onDelete={() => void handleDeleteRoute(session.id)}
                onPress={() => router.push(`/localizacao/${encodeURIComponent(session.id)}`)}
                session={session}
                theme={theme}
              />
            ))
          ) : (
            <Text
              style={[
                theme.typography.footnote,
                { alignSelf: 'stretch', color: theme.colors.textSecondary, textAlign: 'center' },
              ]}
            >
              Nenhuma rota registrada neste dia.
            </Text>
          )}
        </View>
      </PremiumScreen>

      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <View
          style={[
            styles.floatingAction,
            {
              bottom: Math.max(0, insets.bottom - theme.spacing.xs),
            },
          ]}
        >
          <NativeGlassIconButton
            accessibilityLabel={route?.active ? 'Parar rastreamento' : 'Iniciar rastreamento'}
            color={theme.colors.textPrimary}
            containerSize={56}
            containerWidth={116}
            disabled={busy}
            interactiveGlass
            label={route?.active ? 'Parar' : 'Iniciar'}
            onPress={() => void (route?.active ? handleStop() : handleStart())}
            shape="capsule"
          />
        </View>
      </View>
    </View>
  );
}

function RouteHistoryCard({
  onDelete,
  onPress,
  session,
  theme,
}: {
  onDelete: () => void;
  onPress: () => void;
  session: RouteTrackingSession;
  theme: ReturnType<typeof useAppTheme>['theme'];
}) {
  return (
    <NativeCardContextMenu
      actions={[
        {
          destructive: true,
          id: 'delete-route',
          onPress: onDelete,
          systemImage: 'trash',
          title: 'Excluir rota',
        },
      ]}
    >
      <Pressable
        accessibilityLabel="Abrir detalhes da rota"
        accessibilityRole="button"
        onPress={onPress}
      >
        <GlassCard
          elevated
          style={[styles.historyCard, { borderRadius: theme.radius.xl + theme.spacing.xs }]}
        >
          <View pointerEvents="none" style={styles.routePreview}>
            <NativeTrackedRouteMap
              animate={false}
              interactive={false}
              routeId={session.id}
              samples={session.samples}
              style={styles.routePreviewMap}
            />
          </View>
          <View style={styles.routeMeta}>
            <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
              {formatTime(session.startTimestamp)} → {formatTime(session.endTimestamp)}
            </Text>
            <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
              {formatDistance(session.distanceMeters)}
            </Text>
          </View>
        </GlassCard>
      </Pressable>
    </NativeCardContextMenu>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: 120 },
  historyCard: { overflow: 'hidden', padding: 0 },
  historySection: { gap: 12 },
  routeMeta: { gap: 4, padding: 16 },
  routePreview: { height: 180, overflow: 'hidden' },
  routePreviewMap: { flex: 1 },
  floatingAction: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
});
