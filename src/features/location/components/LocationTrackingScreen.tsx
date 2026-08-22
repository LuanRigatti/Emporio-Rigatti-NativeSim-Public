import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NativeGlassHeader } from '@/components/layout';
import {
  NativeCardContextMenu,
  NativeGlassBackButton,
  NativePeriodActionGroup,
  NativeTrackingStatusButton,
} from '@/components/native';
import { PremiumScreen } from '@/components/premium';
import { NativeTrackedRouteMap } from '@/components/routes';
import { locationTrackingService, RouteTrackingError } from '@/services/routes';
import type { LocationTrackingService } from '@/services/routes';
import type { RouteTrackingRecord, RouteTrackingSession } from '@/types/routeTracking';
import { getLiquidGlassTint, useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { formatCurrency } from '@/utils/data';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';
import { useRouteFuelCost } from '@/hooks/useRouteFuelCost';
import {
  HISTORY_MONTH_ITEMS,
  getHistoryYearItems,
} from '@/features/history/components/periodOptions';
import { getCurrentHistoryPeriod } from '@/features/history/utils/historyDateUtils';

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

function monthShortLabel(month: number): string {
  return (
    ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][
      month - 1
    ] ?? String(month)
  );
}

function formatRouteDayLabel(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;

  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
  }).format(new Date(year, month - 1, day, 12));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof RouteTrackingError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Não foi possível atualizar o rastreamento de localização.';
}

export function LocationTrackingScreen() {
  const { resolvedMode, theme } = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currentPeriod = getCurrentHistoryPeriod();
  const [route, setRoute] = useState<RouteTrackingRecord | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(currentPeriod.month);
  const [selectedYear, setSelectedYear] = useState(currentPeriod.year);
  const [routeHistory, setRouteHistory] = useState<RouteTrackingSession[]>([]);
  const [busy, setBusy] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<Awaited<
    ReturnType<LocationTrackingService['getPermissionStatus']>
  > | null>(null);
  const [trackingError, setTrackingError] = useState<TrackingErrorState | null>(null);
  const { enabled: testModeEnabled } = useTestModePresentation();

  const refreshRoute = useCallback(async () => {
    const storedRoute = await locationTrackingService.getRoute();
    setRoute(storedRoute);
  }, []);

  const selectedPeriod = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  const refreshHistory = useCallback(async (period: string) => {
    const history = await locationTrackingService.getRouteHistory();
    setRouteHistory(history.filter((session) => session.date.startsWith(`${period}-`)));
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
      void refreshHistory(selectedPeriod);
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
    }, [refreshHistory, refreshPermissions, selectedPeriod]),
  );

  const handleStart = useCallback(async () => {
    if (testModeEnabled) return;
    triggerLightImpactHaptic();
    setBusy(true);
    setTrackingError(null);

    try {
      const startedRoute = await locationTrackingService.startRouteTracking(createRouteId());
      setRoute(startedRoute);
    } catch (error) {
      setTrackingError({
        code: error instanceof RouteTrackingError ? error.code : undefined,
        message: getErrorMessage(error),
      });
      await refreshRoute();
    } finally {
      setBusy(false);
    }
  }, [refreshRoute, testModeEnabled]);

  const handleStop = useCallback(async () => {
    if (!route || testModeEnabled) return;

    triggerLightImpactHaptic();
    setBusy(true);
    setTrackingError(null);

    try {
      const finishedRoute = await locationTrackingService.stopRouteTracking(route.routeId);
      setRoute(finishedRoute ?? (await locationTrackingService.getRoute()));
      await refreshHistory(selectedPeriod);
    } catch (error) {
      setTrackingError({
        code: error instanceof RouteTrackingError ? error.code : undefined,
        message: getErrorMessage(error),
      });
      await refreshRoute();
    } finally {
      setBusy(false);
    }
  }, [refreshHistory, refreshRoute, route, selectedPeriod, testModeEnabled]);

  const handleDeleteRoute = useCallback(
    async (sessionId: string) => {
      if (testModeEnabled) return;
      setBusy(true);
      setTrackingError(null);

      try {
        await locationTrackingService.removeRouteSession(sessionId);
        await refreshHistory(selectedPeriod);
      } catch (error) {
        setTrackingError({ message: getErrorMessage(error) });
      } finally {
        setBusy(false);
      }
    },
    [refreshHistory, selectedPeriod, testModeEnabled],
  );

  const handleOpenRoute = useCallback(
    (sessionId: string) => {
      triggerLightImpactHaptic();
      router.push(`/localizacao/${encodeURIComponent(sessionId)}`);
    },
    [router],
  );

  const routeHistoryByDay = useMemo(() => {
    const groups = new Map<string, RouteTrackingSession[]>();

    routeHistory.forEach((session) => {
      const sessions = groups.get(session.date) ?? [];
      sessions.push(session);
      groups.set(session.date, sessions);
    });

    return Array.from(groups.entries())
      .map(([date, sessions]) => [
        date,
        [...sessions].sort((left, right) => right.startTimestamp - left.startTimestamp),
      ] as const)
      .sort(([left], [right]) => right.localeCompare(left));
  }, [routeHistory]);

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
        <NativePeriodActionGroup
          color={theme.colors.textPrimary}
          monthDisplayValue={monthShortLabel(selectedMonth)}
          monthItems={HISTORY_MONTH_ITEMS}
          onMonthChange={setSelectedMonth}
          onYearChange={setSelectedYear}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          showValues
          valueFontSize={17}
          yearItems={getHistoryYearItems()}
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
          <View style={{ height: theme.typography.headline.lineHeight }} />
          {visibleErrorMessage ? (
            <Text style={[theme.typography.footnote, { color: theme.colors.danger }]}>
              {visibleErrorMessage}
            </Text>
          ) : null}
          {routeHistoryByDay.length > 0 ? (
            routeHistoryByDay.map(([date, sessions]) => (
              <View key={date} style={styles.dayGroup}>
                <Text
                  style={[
                    theme.typography.headline,
                    { color: theme.colors.textPrimary, marginLeft: theme.spacing.sm },
                  ]}
                >
                  {formatRouteDayLabel(date)}
                </Text>
                {sessions.map((session) => (
                  <RouteHistoryCard
                    key={session.id}
                    onDelete={() => void handleDeleteRoute(session.id)}
                    onPress={() => handleOpenRoute(session.id)}
                    session={session}
                    theme={theme}
                  />
                ))}
              </View>
            ))
          ) : (
            <Text
              style={[
                theme.typography.footnote,
                { alignSelf: 'stretch', color: theme.colors.textSecondary, textAlign: 'center' },
              ]}
            >
              Nenhuma rota registrada neste mês.
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
          <NativeTrackingStatusButton
            accessibilityLabel={route?.active ? 'Parar rastreamento' : 'Iniciar rastreamento'}
            active={Boolean(route?.active)}
            busy={busy}
            color={theme.colors.textPrimary}
            disabled={busy || testModeEnabled}
            glassTint={getLiquidGlassTint(resolvedMode)}
            onPress={() => void (route?.active ? handleStop() : handleStart())}
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
  const fuelCost = useRouteFuelCost(session);
  const { resolvedMode } = useAppTheme();
  const { enabled: testModeEnabled, text: maskText } = useTestModePresentation();
  const routeCardStyle: ViewStyle = {
    backgroundColor: resolvedMode === 'dark' ? '#131417' : theme.colors.glassSurface,
    borderRadius: theme.radius.xl + theme.spacing.xs,
    width: '100%',
  };
  const renderRouteCardContent = () => (
    <>
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
        <View style={styles.routeStatsRow}>
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            {maskText(formatDistance(session.distanceMeters))}
          </Text>
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            {maskText(formatCurrency(fuelCost))}
          </Text>
        </View>
      </View>
    </>
  );
  const routePreview = (
    <View
      style={[
        styles.historyCard,
        routeCardStyle,
        { overflow: 'hidden' },
      ]}
    >
      {renderRouteCardContent()}
    </View>
  );

  return (
    <View
      style={[
        styles.routeContextContainer,
        routeCardStyle,
        resolvedMode === 'dark' ? theme.shadows.none : theme.shadows.elevated,
      ]}
    >
      <NativeCardContextMenu
        actions={[
          {
            destructive: true,
            disabled: testModeEnabled,
            id: 'delete-route',
            onPress: onDelete,
            systemImage: 'trash',
            title: 'Excluir rota',
          },
        ]}
        preview={routePreview}
        style={{ borderRadius: theme.radius.xl + theme.spacing.xs, width: '100%' }}
      >
        <View
          style={[
            styles.historyCard,
            {
              backgroundColor: 'transparent',
              borderRadius: theme.radius.xl + theme.spacing.xs,
              width: '100%',
            },
          ]}
        >
          <Pressable
            accessibilityLabel="Abrir detalhes da rota"
            accessibilityRole="button"
            onPress={onPress}
            style={{ width: '100%' }}
          >
            {renderRouteCardContent()}
          </Pressable>
        </View>
      </NativeCardContextMenu>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: 120 },
  historyCard: { overflow: 'hidden', padding: 0 },
  routeContextContainer: { overflow: 'hidden' },
  dayGroup: { gap: 12 },
  historySection: { gap: 12 },
  routeMeta: { gap: 4, padding: 16 },
  routePreview: { height: 180, overflow: 'hidden' },
  routePreviewMap: { flex: 1 },
  routeStatsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  floatingAction: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
});
