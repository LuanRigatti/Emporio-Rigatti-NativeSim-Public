import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NativeGlassHeader } from '@/components/layout';
import { NativeCardContextMenu, NativeTrackingStatusButton } from '@/components/native';
import { ConfirmationDialog } from '@/components/overlays';
import { TextButton } from '@/components/buttons';
import { PremiumScreen } from '@/components/premium';
import { FinancePeriodToolbar } from '@/features/finance';
import { NativeTrackedRouteMap } from '@/components/routes';
import { locationTrackingService, RouteTrackingError } from '@/services/routes';
import type { LocationTrackingService } from '@/services/routes';
import type { RouteTrackingRecord, RouteTrackingSession } from '@/types/routeTracking';
import { getCardSurfaceColor, getLiquidGlassTint, useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { formatCurrency } from '@/utils/data';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';
import { useRouteFuelCost } from '@/hooks/useRouteFuelCost';
import { getCurrentHistoryPeriod } from '@/features/history/utils/historyDateUtils';

type TrackingErrorState = {
  code?: RouteTrackingError['code'];
  message: string;
};

type NativeStackTransitionNavigation = {
  addListener: (
    event: 'transitionEnd',
    listener: (event: { data?: { closing?: boolean } }) => void,
  ) => () => void;
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
  const navigation = useNavigation();
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
  const [mapReady, setMapReady] = useState(false);
  const [legacyHistoryStatus, setLegacyHistoryStatus] = useState<Awaited<
    ReturnType<LocationTrackingService['getLegacyRouteHistoryStatus']>
  > | null>(null);
  const [claimDialogVisible, setClaimDialogVisible] = useState(false);
  const [claimBusy, setClaimBusy] = useState(false);
  const { enabled: testModeEnabled } = useTestModePresentation();

  useEffect(() => {
    const nativeStackNavigation = navigation as unknown as NativeStackTransitionNavigation;
    const unsubscribe = nativeStackNavigation.addListener('transitionEnd', (event) => {
      if (!event.data?.closing) {
        setMapReady(true);
      }
    });

    return unsubscribe;
  }, [navigation]);

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

  const refreshLegacyHistoryStatus = useCallback(async () => {
    try {
      setLegacyHistoryStatus(await locationTrackingService.getLegacyRouteHistoryStatus());
    } catch {
      setLegacyHistoryStatus(null);
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
      void refreshLegacyHistoryStatus();
      const appStateSubscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') void refreshPermissions();
      });
      const interval = setInterval(() => void sync(), 1_000);
      return () => {
        cancelled = true;
        clearInterval(interval);
        appStateSubscription.remove();
      };
    }, [refreshHistory, refreshLegacyHistoryStatus, refreshPermissions, selectedPeriod]),
  );

  const legacyFingerprint = legacyHistoryStatus?.fingerprint;

  const handleClaimLegacyHistory = useCallback(async () => {
    if (claimBusy || testModeEnabled) return;

    setClaimBusy(true);
    setTrackingError(null);
    try {
      await locationTrackingService.claimLegacyRouteHistory(legacyFingerprint ?? undefined);
      await refreshHistory(selectedPeriod);
      await refreshLegacyHistoryStatus();
      setClaimDialogVisible(false);
    } catch (error) {
      setTrackingError({ message: getErrorMessage(error) });
    } finally {
      setClaimBusy(false);
    }
  }, [
    claimBusy,
    legacyFingerprint,
    refreshHistory,
    refreshLegacyHistoryStatus,
    selectedPeriod,
    testModeEnabled,
  ]);

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
      .map(
        ([date, sessions]) =>
          [
            date,
            [...sessions].sort((left, right) => right.startTimestamp - left.startTimestamp),
          ] as const,
      )
      .sort(([left], [right]) => right.localeCompare(left));
  }, [routeHistory]);

  const visibleErrorMessage =
    trackingError?.code === 'permission-denied' && permissionStatus?.background.granted
      ? undefined
      : trackingError?.message;

  const header = <NativeGlassHeader mode="transparent" title="" />;

  return (
    <>
      <FinancePeriodToolbar
        composition="combined"
        onMonthChange={setSelectedMonth}
        onYearChange={setSelectedYear}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
      />
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
            {legacyHistoryStatus?.available && !legacyHistoryStatus.claimed ? (
              <View
                style={[
                  styles.legacyClaimCard,
                  {
                    backgroundColor: theme.colors.surface,
                    borderRadius: theme.radius.lg,
                    padding: theme.spacing.md,
                  },
                ]}
              >
                <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
                  Encontramos histórico local antigo neste dispositivo. Ele ainda não pertence a
                  nenhuma conta identificável; ao confirmar, você assume esse histórico para a conta
                  atual.
                </Text>
                <TextButton
                  accessibilityLabel="Importar histórico antigo"
                  disabled={claimBusy || testModeEnabled}
                  loading={claimBusy}
                  onPress={() => setClaimDialogVisible(true)}
                  size="small"
                >
                  Importar histórico antigo
                </TextButton>
              </View>
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
                      mapReady={mapReady}
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
      <ConfirmationDialog
        confirmLabel="Importar histórico"
        loading={claimBusy}
        message="Foi encontrado histórico local antigo neste dispositivo. Ele ainda não está vinculado a nenhuma conta identificável. Ao confirmar, você assumirá esse histórico para a conta atual."
        onCancel={() => {
          if (!claimBusy) setClaimDialogVisible(false);
        }}
        onConfirm={() => void handleClaimLegacyHistory()}
        title="Assumir histórico antigo?"
        visible={claimDialogVisible}
      />
    </>
  );
}

function RouteHistoryCard({
  mapReady,
  onDelete,
  onPress,
  session,
  theme,
}: {
  mapReady: boolean;
  onDelete: () => void;
  onPress: () => void;
  session: RouteTrackingSession;
  theme: ReturnType<typeof useAppTheme>['theme'];
}) {
  const fuelCost = useRouteFuelCost(session);
  const { resolvedMode } = useAppTheme();
  const { enabled: testModeEnabled, text: maskText } = useTestModePresentation();
  const routeCardStyle: ViewStyle = {
    backgroundColor: getCardSurfaceColor(resolvedMode, theme.colors.glassSurface),
    borderRadius: theme.radius.xl + theme.spacing.xs,
    width: '100%',
  };
  const renderRouteCardContent = () => (
    <>
      <View pointerEvents="none" style={styles.routePreview}>
        {mapReady ? (
          <NativeTrackedRouteMap
            animate={false}
            interactive={false}
            routeId={session.id}
            samples={session.samples}
            style={styles.routePreviewMap}
          />
        ) : (
          <View style={[styles.routePreviewMap, { backgroundColor: theme.colors.surface }]} />
        )}
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
    <View style={[styles.historyCard, routeCardStyle, { overflow: 'hidden' }]}>
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
  legacyClaimCard: { gap: 8 },
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
