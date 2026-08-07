import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NativeGlassHeader } from '@/components/layout';
import {
  NativeDatePicker,
  NativeGlassBackButton,
  NativeGlassIconButton,
} from '@/components/native';
import { GlassCard, PremiumScreen } from '@/components/premium';
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

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return [hours, minutes, remainingSeconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

function formatTimestamp(timestamp: number | undefined): string {
  if (!timestamp) return '—';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(timestamp);
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}

function formatSessionDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, '0')} min`;
  return `${minutes} min ${String(remainingSeconds).padStart(2, '0')} s`;
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
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<Awaited<
    ReturnType<LocationTrackingService['getPermissionStatus']>
  > | null>(null);
  const [trackingError, setTrackingError] = useState<TrackingErrorState | null>(null);

  const refreshRoute = useCallback(async () => {
    const storedRoute = await locationTrackingService.getRoute();
    setRoute(storedRoute);
    setNow(Date.now());
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
          setNow(Date.now());
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
      setNow(Date.now());
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
      setNow(Date.now());
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

  const durationSeconds = useMemo(() => {
    if (!route) return 0;
    return Math.max(0, ((route.endTimestamp ?? now) - route.startTimestamp) / 1000);
  }, [now, route]);
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
        <GlassCard
          elevated
          style={[
            styles.card,
            { borderRadius: theme.radius.xl + theme.spacing.xs, marginTop: theme.spacing.md },
          ]}
        >
          <StatusRow
            label="Status"
            theme={theme}
            value={route?.active ? 'Rastreando' : 'Parado'}
            valueColor={route?.active ? theme.colors.success : theme.colors.textPrimary}
          />
          <StatusRow
            label="Distância"
            theme={theme}
            value={formatDistance(route?.accumulatedDistanceMeters ?? 0)}
          />
          <StatusRow label="Duração" theme={theme} value={formatDuration(durationSeconds)} />
          <StatusRow
            label="Pontos coletados"
            theme={theme}
            value={String(route?.samples.length ?? 0)}
          />
          <StatusRow label="Início" theme={theme} value={formatTimestamp(route?.startTimestamp)} />
          <StatusRow label="Término" theme={theme} value={formatTimestamp(route?.endTimestamp)} />
          {visibleErrorMessage ? (
            <Text style={[theme.typography.footnote, { color: theme.colors.danger }]}>
              {visibleErrorMessage}
            </Text>
          ) : null}
        </GlassCard>

        <View style={styles.historySection}>
          <Text
            style={[
              theme.typography.headline,
              { color: theme.colors.textPrimary, textAlign: 'center' },
            ]}
          >
            Rotas do dia
          </Text>
          {routeHistory.length > 0 ? (
            routeHistory.map((session) => (
              <RouteHistoryCard key={session.id} session={session} theme={theme} />
            ))
          ) : (
            <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
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
  session,
  theme,
}: {
  session: RouteTrackingSession;
  theme: ReturnType<typeof useAppTheme>['theme'];
}) {
  return (
    <GlassCard
      elevated
      style={[styles.historyCard, { borderRadius: theme.radius.xl + theme.spacing.xs }]}
    >
      <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
        {formatTime(session.startTimestamp)} → {formatTime(session.endTimestamp)}
      </Text>
      <StatusRow
        label="Duração"
        theme={theme}
        value={formatSessionDuration(session.durationSeconds)}
      />
      <StatusRow label="Distância" theme={theme} value={formatDistance(session.distanceMeters)} />
      <StatusRow label="Pontos coletados" theme={theme} value={String(session.pointsCount)} />
    </GlassCard>
  );
}

function StatusRow({
  label,
  theme,
  value,
  valueColor,
}: {
  label: string;
  theme: ReturnType<typeof useAppTheme>['theme'];
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.statusRow}>
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{label}</Text>
      <Text style={[theme.typography.body, { color: valueColor ?? theme.colors.textPrimary }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: 120 },
  card: { gap: 18 },
  historyCard: { gap: 12 },
  historySection: { gap: 12 },
  statusRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  floatingAction: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
});
