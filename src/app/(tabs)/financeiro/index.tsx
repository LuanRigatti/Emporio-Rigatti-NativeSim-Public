import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useFocusEffect, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Loading } from '@/components/feedback';
import { NativeGlassHeader } from '@/components/layout';
import {
  NativeAnimatedNumber,
  NativeRetailFinanceCategorySelector,
  renderNativeDateToolbarItems,
} from '@/components/native';
import { FinancialSeriesChart } from '@/components/Charts';
import { PremiumCard, ProgressiveCollapsibleScreen, SummaryCard } from '@/components/premium';
import { FinancialTrendIndicator, renderFinancePeriodToolbarItems } from '@/features/finance';
import { useWholesaleChartNavigation } from '@/features/finance/hooks/useWholesaleChartNavigation';
import { getCurrentHistoryPeriod } from '@/features/history/utils/historyDateUtils';
import {
  createHistoryWeekGroups,
  getHistoryMonthRange,
  getHistoryWeekRange,
} from '@/features/history/utils/historyPeriodUtils';
import { useFinancialData } from '@/hooks/useFinancialData';
import { useFinancialFuelCosts } from '@/hooks/useFinancialFuelCosts';
import { useConnectivity } from '@/hooks/useConnectivity';
import { useRetailCategories } from '@/hooks/useRetailCategories';
import { useRetailFinance } from '@/hooks/useRetailFinance';
import { useAppMode, useAppSafeAreaInsets, useAuth, useTestMode } from '@/providers';
import { expenseQueryForWholesaleFinanceSelection } from '@/services/costs';
import {
  createFinancialPresentationScopeKey,
  FINANCIAL_PRESENTATION_SUMMARY_FIELDS,
  financialCalculationService,
  financialPresentationCache,
  formatWholesaleFinancePeriodLabel,
  wholesaleFinanceFiltersForSelection,
  type FinancialPresentationSummary,
  type FinancialPresentationValues,
} from '@/services/finance';
import { isActiveAuthSession } from '@/services/auth/ActiveAuthSession';
import { locationTrackingService, summarizeRouteKilometersByDate } from '@/services/routes';
import { retailFinanceViewForCategory, type RetailFinanceView } from '@/services/retail-finance';
import type {
  FinancialComparison,
  FinancialSummary,
  WholesaleFinanceSelection,
} from '@/types/data';
import type { RouteFinancialSummary } from '@/types/routeTracking';
import { getCardSurfaceColor, useAppTheme } from '@/theme';
import { todayIso } from '@/utils/data';
import { getFinanceWidgetMonthKey } from '@/features/finance/widgets/ResumoFinanceiroSnapshot';

export default function FinanceiroRoute() {
  const { mode: requestedModeParam } = useLocalSearchParams<{ mode?: string | string[] }>();
  const { isReady, mode, setMode } = useAppMode();
  const { sessionVersion, user } = useAuth();
  const modeIntentState = useRef<'idle' | 'applying' | 'consumed'>('idle');
  const requestedMode =
    requestedModeParam === 'wholesale' || requestedModeParam === 'retail'
      ? requestedModeParam
      : undefined;

  useEffect(() => {
    if (!requestedMode) {
      modeIntentState.current = 'idle';
      return;
    }
    if (!isReady) return;

    if (mode !== requestedMode) {
      if (modeIntentState.current !== 'applying') {
        modeIntentState.current = 'applying';
        setMode(requestedMode);
      }
      return;
    }

    if (modeIntentState.current !== 'consumed') {
      modeIntentState.current = 'consumed';
      router.setParams({ mode: undefined });
    }
  }, [isReady, mode, requestedMode, setMode]);

  if (requestedMode && (!isReady || mode !== requestedMode)) return null;

  return mode === 'retail' ? (
    <RetailFinanceScreen />
  ) : (
    <WholesaleFinanceScreen key={`${user?.id ?? 'unauthenticated'}:${sessionVersion}`} />
  );
}

const WHOLESALE_FINANCE_PERIOD_ITEMS = [
  { key: 'month', label: 'Mensal' },
  { key: 'day', label: 'Diário' },
  { key: 'week', label: 'Semanal' },
  { key: 'all', label: 'Total' },
] as const;

type WholesaleFinancePeriodKind = WholesaleFinanceSelection['kind'];

type ScopedFinancialPresentation = {
  uid: string;
  sessionVersion: number;
  source: 'persistent' | 'live';
  snapshotSessionScopeKey?: string | null;
  scopeKey: string;
  values: FinancialPresentationValues;
};

type DisplayFinancialSummary = FinancialSummary | FinancialPresentationSummary;

function financialComparisonsMatch(
  first: FinancialComparison | null | undefined,
  second: FinancialComparison | null | undefined,
): boolean {
  if (first == null || second == null) return first == null && second == null;
  return (
    first.atual === second.atual &&
    first.anterior === second.anterior &&
    first.diferenca === second.diferenca &&
    first.percentual === second.percentual &&
    first.subiu === second.subiu
  );
}

function financialPresentationValuesMatch(
  first: FinancialPresentationValues,
  second: FinancialPresentationValues,
): boolean {
  return (
    first.faturamento === second.faturamento &&
    first.lucroLiquido === second.lucroLiquido &&
    financialComparisonsMatch(first.faturamentoComparison, second.faturamentoComparison) &&
    financialComparisonsMatch(first.lucroLiquidoComparison, second.lucroLiquidoComparison) &&
    FINANCIAL_PRESENTATION_SUMMARY_FIELDS.every(
      (field) => first.summary[field] === second.summary[field],
    )
  );
}

function WholesaleFinanceScreen() {
  const { resolvedMode, theme } = useAppTheme();
  const insets = useAppSafeAreaInsets();
  const { status: authStatus, user: authUser, sessionVersion } = useAuth();
  const { enabled: testModeEnabled, isReady: testModeReady } = useTestMode();
  const financeCardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surface);
  const isFocused = useIsFocused();
  const connectivity = useConnectivity();
  const initialHistoryPeriod = getCurrentHistoryPeriod();
  const [selectedMonth, setSelectedMonth] = useState(initialHistoryPeriod.month);
  const [selectedYear, setSelectedYear] = useState(initialHistoryPeriod.year);
  const [periodKind, setPeriodKind] = useState<WholesaleFinancePeriodKind>('month');
  const [selectedDay, setSelectedDay] = useState(() => todayIso());
  const [selectedWeek, setSelectedWeek] = useState(() => getHistoryWeekRange(todayIso()));
  const [displayedSelection, setDisplayedSelection] = useState<WholesaleFinanceSelection>(() => ({
    kind: 'month',
    month: `${initialHistoryPeriod.year}-${String(initialHistoryPeriod.month).padStart(2, '0')}`,
  }));
  const [displayedRevenue, setDisplayedRevenue] = useState<{
    uid?: string;
    sessionVersion?: number;
    scopeKey?: string;
    sessionScopeKey?: string | null;
    requestScopeKey?: string;
    faturamento: number | null;
  }>({ faturamento: null });
  const [lastConfirmedNetProfit, setLastConfirmedNetProfit] = useState<{
    uid: string;
    sessionVersion: number;
    snapshotSessionScopeKey: string;
    scopeKey: string;
    requestScopeKey: string;
    value: number;
    comparison: FinancialComparison | undefined;
  }>();
  const [storedPresentation, setStoredPresentation] = useState<ScopedFinancialPresentation | null>(
    null,
  );
  const presentationReadGeneration = useRef(0);
  const livePresentationReadyRef = useRef(false);
  const initialRouteSessions = locationTrackingService.getMemoryFinancialRouteSummaries();
  const [routeSessions, setRouteSessions] = useState<RouteFinancialSummary[]>(
    () => initialRouteSessions ?? [],
  );
  const [routesLoaded, setRoutesLoaded] = useState(() => initialRouteSessions !== null);
  const lastConnectivityState = useRef<boolean | null>(null);
  const retryAfterReconnectSettles = useRef(false);
  const selectedPeriod = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const wholesaleSelection = useMemo<WholesaleFinanceSelection>(() => {
    if (periodKind === 'day') return { date: selectedDay, kind: 'day' };
    if (periodKind === 'week') {
      return {
        endDate: selectedWeek.endDate,
        kind: 'week',
        startDate: selectedWeek.startDate,
      };
    }
    if (periodKind === 'all') return { kind: 'all' };
    return { kind: 'month', month: selectedPeriod };
  }, [periodKind, selectedDay, selectedPeriod, selectedWeek]);
  const financialPresentationScopeKey = useMemo(
    () =>
      createFinancialPresentationScopeKey(
        wholesaleSelection,
        wholesaleFinanceFiltersForSelection(wholesaleSelection),
      ),
    [wholesaleSelection],
  );
  const presentationContextRef = useRef({
    uid: authUser?.id ?? null,
    sessionVersion,
    scopeKey: financialPresentationScopeKey,
    isFocused,
    authStatus,
    testModeEnabled,
    testModeReady,
  });
  useEffect(() => {
    presentationContextRef.current = {
      uid: authUser?.id ?? null,
      sessionVersion,
      scopeKey: financialPresentationScopeKey,
      isFocused,
      authStatus,
      testModeEnabled,
      testModeReady,
    };
  }, [
    authStatus,
    authUser?.id,
    financialPresentationScopeKey,
    isFocused,
    sessionVersion,
    testModeEnabled,
    testModeReady,
  ]);

  useEffect(() => {
    const generation = ++presentationReadGeneration.current;
    const uid = authUser?.id;
    if (authStatus !== 'authenticated' || !uid || !testModeReady || testModeEnabled) {
      return () => {
        if (presentationReadGeneration.current === generation) {
          presentationReadGeneration.current += 1;
        }
      };
    }

    const canApplyRead = () => {
      const current = presentationContextRef.current;
      return (
        presentationReadGeneration.current === generation &&
        !livePresentationReadyRef.current &&
        current.uid === uid &&
        current.sessionVersion === sessionVersion &&
        current.scopeKey === financialPresentationScopeKey &&
        current.authStatus === 'authenticated' &&
        current.testModeReady &&
        !current.testModeEnabled &&
        isActiveAuthSession(uid, sessionVersion)
      );
    };

    void financialPresentationCache
      .readWithStatus(uid, financialPresentationScopeKey)
      .then((result) => {
        if (result.status === 'miss' || !canApplyRead()) return;
        const { entry } = result;
        setStoredPresentation({
          uid,
          sessionVersion,
          source: 'persistent',
          scopeKey: financialPresentationScopeKey,
          values: {
            faturamento: entry.faturamento,
            lucroLiquido: entry.lucroLiquido,
            faturamentoComparison: entry.faturamentoComparison,
            lucroLiquidoComparison: entry.lucroLiquidoComparison,
            summary: entry.summary,
          },
        });
      })
      .catch(() => undefined);

    return () => {
      if (presentationReadGeneration.current === generation) {
        presentationReadGeneration.current += 1;
      }
    };
  }, [
    authStatus,
    authUser?.id,
    financialPresentationScopeKey,
    sessionVersion,
    testModeEnabled,
    testModeReady,
  ]);
  const financialQuery = useMemo(
    () => expenseQueryForWholesaleFinanceSelection(wholesaleSelection),
    [wholesaleSelection],
  );
  const requestedScopeKey =
    wholesaleSelection.kind === 'month'
      ? selectedPeriod
      : wholesaleSelection.kind === 'all'
        ? 'all'
        : JSON.stringify(financialQuery);
  const {
    comparisonSnapshot,
    coverage: financeCoverage,
    confirmedDeliveryPreview,
    error,
    hasPreviouslyConfirmedSnapshot,
    loading,
    remoteComplete,
    refreshing,
    reload,
    requestScopeKey,
    snapshot,
    snapshotSessionScopeKey,
    snapshotScopeKey,
  } = useFinancialData(financialQuery, {
    displayMonth: wholesaleSelection.kind === 'month' ? selectedPeriod : undefined,
    enabled: isFocused,
  });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void locationTrackingService
        .getFinancialRouteSummaries()
        .then((sessions) => {
          if (active) {
            setRouteSessions(sessions);
            setRoutesLoaded(true);
          }
        })
        .catch(() => {
          if (active && locationTrackingService.getMemoryFinancialRouteSummaries() !== null) {
            setRoutesLoaded(true);
          }
        });

      return () => {
        active = false;
      };
    }, []),
  );

  const automaticKilometersByDate = useMemo(
    () => (routesLoaded ? summarizeRouteKilometersByDate(routeSessions) : {}),
    [routesLoaded, routeSessions],
  );
  const hasStableSnapshot = snapshot !== null && snapshotScopeKey === requestedScopeKey;
  // The all-time cache omits a request key for its single canonical query.
  const visibleRequestScopeKey =
    snapshotScopeKey === 'all' ? 'all' : financeCoverage.requestScopeKey;
  const hasDisplayedRevenueForVisibleScope =
    displayedRevenue.uid === authUser?.id &&
    displayedRevenue.sessionVersion === sessionVersion &&
    displayedRevenue.scopeKey === snapshotScopeKey &&
    displayedRevenue.sessionScopeKey !== undefined &&
    displayedRevenue.sessionScopeKey === snapshotSessionScopeKey &&
    displayedRevenue.requestScopeKey === visibleRequestScopeKey;
  /* eslint-disable react-hooks/set-state-in-effect -- this state stores only the last stable visible scope. */
  useEffect(() => {
    if (!hasStableSnapshot) return;
    setDisplayedSelection((current) =>
      current === wholesaleSelection ? current : wholesaleSelection,
    );
  }, [hasStableSnapshot, wholesaleSelection]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const summarySelection = hasStableSnapshot ? wholesaleSelection : displayedSelection;
  const hasVisibleSnapshot = hasStableSnapshot || hasDisplayedRevenueForVisibleScope;
  const activeSnapshot = hasVisibleSnapshot ? snapshot : null;
  const activeComparisonSnapshot = hasVisibleSnapshot ? comparisonSnapshot : null;
  const fuelExpenses = useMemo(
    () => ({
      ...(activeComparisonSnapshot?.gastosDiarios ?? {}),
      ...(activeSnapshot?.gastosDiarios ?? {}),
    }),
    [activeComparisonSnapshot?.gastosDiarios, activeSnapshot?.gastosDiarios],
  );
  const { fuelCostByDate, isReady: fuelCostsReady } = useFinancialFuelCosts(
    fuelExpenses,
    routeSessions,
    { allowCachedInitialSettings: true },
  );

  const summaryFilters = useMemo(
    () => wholesaleFinanceFiltersForSelection(summarySelection),
    [summarySelection],
  );
  const isNetProfitReady =
    activeSnapshot !== null && routesLoaded && fuelCostsReady && remoteComplete;

  const summary = useMemo(
    () =>
      activeSnapshot
        ? financialCalculationService.calculateResumo({
            deliveries: activeSnapshot.entregas,
            dailyExpenses: activeSnapshot.gastosDiarios,
            filters: summaryFilters,
            fullLightInterval: summarySelection.kind === 'week',
            monthlyExpenses: activeSnapshot.gastosMensais,
            automaticKilometersByDate,
            fuelCostByDate,
          })
        : undefined,
    [activeSnapshot, automaticKilometersByDate, fuelCostByDate, summaryFilters, summarySelection],
  );
  const comparison = useMemo(
    () =>
      summarySelection.kind === 'month' && activeSnapshot && activeComparisonSnapshot
        ? financialCalculationService.compareCalendarMonths({
            deliveries: activeComparisonSnapshot.entregas,
            dailyExpenses: activeComparisonSnapshot.gastosDiarios,
            filters: summaryFilters,
            monthlyExpenses: activeSnapshot.gastosMensais,
            automaticKilometersByDate,
            fuelCostByDate,
          })
        : undefined,
    [
      activeComparisonSnapshot,
      activeSnapshot,
      automaticKilometersByDate,
      fuelCostByDate,
      summaryFilters,
      summarySelection.kind,
    ],
  );
  const confirmedDeliveryPreviewFaturamento = confirmedDeliveryPreview
    ? financialCalculationService.calculateFaturamento(
        financialCalculationService.filterDeliveries(
          confirmedDeliveryPreview,
          wholesaleFinanceFiltersForSelection(wholesaleSelection),
        ),
      )
    : null;
  const hasProgressiveRevenuePreview =
    summary === undefined && confirmedDeliveryPreviewFaturamento !== null;
  const currentFaturamentoValue = summary?.faturamento ?? confirmedDeliveryPreviewFaturamento;
  const currentLucroLiquidoValue =
    hasStableSnapshot &&
    snapshotSessionScopeKey &&
    visibleRequestScopeKey !== undefined &&
    isNetProfitReady &&
    summary
      ? summary.lucroLiquido
      : null;
  const faturamentoReady = currentFaturamentoValue !== null;
  const lucroLiquidoReady = isNetProfitReady && currentLucroLiquidoValue !== null;
  const isOffline =
    connectivity?.isConnected === false || connectivity?.isInternetReachable === false;
  const previousNetProfit =
    lastConfirmedNetProfit?.uid === authUser?.id &&
    lastConfirmedNetProfit?.sessionVersion === sessionVersion &&
    (snapshotSessionScopeKey === undefined ||
      snapshotSessionScopeKey === null ||
      lastConfirmedNetProfit?.snapshotSessionScopeKey === snapshotSessionScopeKey) &&
    lastConfirmedNetProfit?.scopeKey === requestedScopeKey &&
    lastConfirmedNetProfit?.requestScopeKey === requestScopeKey
      ? lastConfirmedNetProfit
      : undefined;
  const hasConfirmedNetProfitForVisibleScope = lucroLiquidoReady || previousNetProfit !== undefined;
  const isShowingPreviouslyConfirmedNetProfit =
    hasConfirmedNetProfitForVisibleScope &&
    (!lucroLiquidoReady || isOffline || loading || refreshing || Boolean(error));
  const canReuseDisplayedNetProfit =
    previousNetProfit !== undefined && isShowingPreviouslyConfirmedNetProfit;
  const showingPriorNetProfitWithoutSnapshotProof =
    canReuseDisplayedNetProfit && (!hasStableSnapshot || !hasPreviouslyConfirmedSnapshot);
  const canPresentCurrentNetProfit = lucroLiquidoReady && !canReuseDisplayedNetProfit;
  const currentLivePresentationReady = Boolean(
    authStatus === 'authenticated' &&
    authUser?.id &&
    testModeReady &&
    !testModeEnabled &&
    hasStableSnapshot &&
    snapshotSessionScopeKey &&
    visibleRequestScopeKey !== undefined &&
    remoteComplete &&
    !isOffline &&
    !loading &&
    !refreshing &&
    !error &&
    currentFaturamentoValue !== null &&
    lucroLiquidoReady &&
    summary,
  );
  useEffect(() => {
    livePresentationReadyRef.current = currentLivePresentationReady;
  }, [currentLivePresentationReady]);
  const scopedStoredPresentation =
    storedPresentation &&
    storedPresentation.uid === authUser?.id &&
    storedPresentation.sessionVersion === sessionVersion &&
    storedPresentation.scopeKey === financialPresentationScopeKey &&
    authStatus === 'authenticated' &&
    testModeReady &&
    !testModeEnabled &&
    (storedPresentation.source === 'persistent' ||
      snapshotSessionScopeKey === undefined ||
      snapshotSessionScopeKey === null ||
      storedPresentation.snapshotSessionScopeKey === snapshotSessionScopeKey) &&
    isActiveAuthSession(authUser?.id ?? null, sessionVersion)
      ? storedPresentation.values
      : null;
  const showingStoredPresentation =
    scopedStoredPresentation !== null && !currentLivePresentationReady;
  const currentFinanceDataNotice = hasProgressiveRevenuePreview
    ? error
      ? 'Faturamento confirmado. Os demais indicadores aguardam cobertura financeira completa.'
      : undefined
    : hasConfirmedNetProfitForVisibleScope && isOffline
      ? 'Sem conexão. Exibindo o último resultado confirmado.'
      : hasConfirmedNetProfitForVisibleScope && error
        ? 'A atualização não foi confirmada. Exibindo o último resultado confirmado.'
        : showingPriorNetProfitWithoutSnapshotProof
          ? 'Exibindo o último resultado confirmado enquanto o período é atualizado.'
          : canReuseDisplayedNetProfit
            ? undefined
            : (error ??
              (activeSnapshot !== null && !financeCoverage.remoteComplete
                ? 'Os valores locais ou em cache são provisórios até haver confirmação remota completa.'
                : undefined));
  const financeDataNotice = showingStoredPresentation ? undefined : currentFinanceDataNotice;
  const financeNoticeSource =
    showingStoredPresentation || showingPriorNetProfitWithoutSnapshotProof
      ? undefined
      : hasProgressiveRevenuePreview
        ? undefined
        : financeCoverage.source;
  const preserveStoredFaturamentoComparison =
    !showingStoredPresentation &&
    currentLivePresentationReady &&
    scopedStoredPresentation !== null &&
    financialComparisonsMatch(
      comparison?.faturamento,
      scopedStoredPresentation.faturamentoComparison,
    );
  const preserveStoredNetProfitComparison =
    !showingStoredPresentation &&
    currentLivePresentationReady &&
    scopedStoredPresentation !== null &&
    financialComparisonsMatch(
      comparison?.lucroLiquido,
      scopedStoredPresentation.lucroLiquidoComparison,
    );
  const displayedFaturamentoComparison = showingStoredPresentation
    ? (scopedStoredPresentation?.faturamentoComparison ?? undefined)
    : preserveStoredFaturamentoComparison
      ? (scopedStoredPresentation?.faturamentoComparison ?? undefined)
      : comparison?.faturamento;
  const displayedNetProfitComparison = showingStoredPresentation
    ? (scopedStoredPresentation?.lucroLiquidoComparison ?? undefined)
    : preserveStoredNetProfitComparison
      ? (scopedStoredPresentation?.lucroLiquidoComparison ?? undefined)
      : ((canPresentCurrentNetProfit ? comparison?.lucroLiquido : undefined) ??
        previousNetProfit?.comparison);
  const currentLivePresentationValues = useMemo<FinancialPresentationValues | null>(
    () =>
      currentLivePresentationReady &&
      summary !== undefined &&
      currentFaturamentoValue !== null &&
      currentLucroLiquidoValue !== null
        ? {
            faturamento: currentFaturamentoValue,
            lucroLiquido: currentLucroLiquidoValue,
            faturamentoComparison: displayedFaturamentoComparison ?? null,
            lucroLiquidoComparison: displayedNetProfitComparison ?? null,
            summary: {
              quantidadeBaldes: summary.quantidadeBaldes,
              lucroBruto: summary.lucroBruto,
              valoresPagos: summary.valoresPagos,
              valoresPendentes: summary.valoresPendentes,
              custoTotalBaldes: summary.custoTotalBaldes,
              custoCombustivel: summary.custoCombustivel,
              custoOutros: summary.custoOutros,
              custoLuz: summary.custoLuz,
              custoMedioCombustivelPorEntrega: summary.custoMedioCombustivelPorEntrega,
              margemBruta: summary.margemBruta,
              margemLiquida: summary.margemLiquida,
              precoMedioBalde: summary.precoMedioBalde,
              lucroLiquidoPorBalde: summary.lucroLiquidoPorBalde,
              custoMedioBalde: summary.custoMedioBalde,
            },
          }
        : null,
    [
      currentFaturamentoValue,
      currentLivePresentationReady,
      currentLucroLiquidoValue,
      displayedFaturamentoComparison,
      displayedNetProfitComparison,
      summary,
    ],
  );
  const displayedSummary: DisplayFinancialSummary | undefined = showingStoredPresentation
    ? scopedStoredPresentation?.summary
    : summary;
  const displayedSummaryHasCompleteProfitFields = showingStoredPresentation || isNetProfitReady;
  useEffect(() => {
    const isOnline =
      connectivity?.isConnected === true && connectivity.isInternetReachable !== false;
    const isOffline =
      connectivity?.isConnected === false || connectivity?.isInternetReachable === false;
    const nextState = isOnline ? true : isOffline ? false : null;
    const previousState = lastConnectivityState.current;
    lastConnectivityState.current = nextState;

    if (previousState === false && nextState === true && isFocused && !remoteComplete) {
      if (loading || refreshing) retryAfterReconnectSettles.current = true;
      else reload();
    }

    if (!loading && !refreshing) {
      if (remoteComplete) {
        retryAfterReconnectSettles.current = false;
      } else if (retryAfterReconnectSettles.current && nextState === true && isFocused) {
        retryAfterReconnectSettles.current = false;
        reload();
      }
    }
  }, [connectivity, isFocused, loading, refreshing, remoteComplete, reload]);

  useEffect(() => {
    if (
      !hasStableSnapshot ||
      wholesaleSelection.kind !== 'month' ||
      selectedPeriod !== getFinanceWidgetMonthKey(new Date()) ||
      !snapshotSessionScopeKey ||
      !faturamentoReady
    ) {
      return;
    }

    const widgetSnapshot = {
      snapshotSessionScopeKey,
      monthKey: selectedPeriod,
      faturamento: currentFaturamentoValue,
      lucroLiquido: lucroLiquidoReady ? currentLucroLiquidoValue : null,
    };
    let active = true;
    void import('@/features/finance/widgets/ResumoFinanceiroSnapshotCoordinator')
      .then(({ resumoFinanceiroSnapshotCoordinator }) => {
        if (active) resumoFinanceiroSnapshotCoordinator.publishWholesale(widgetSnapshot);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [
    currentFaturamentoValue,
    currentLucroLiquidoValue,
    faturamentoReady,
    hasStableSnapshot,
    lucroLiquidoReady,
    selectedPeriod,
    snapshotSessionScopeKey,
    wholesaleSelection.kind,
  ]);

  const displayedFaturamentoValue = showingStoredPresentation
    ? (scopedStoredPresentation?.faturamento ?? null)
    : faturamentoReady
      ? currentFaturamentoValue
      : hasDisplayedRevenueForVisibleScope
        ? displayedRevenue.faturamento
        : null;
  const displayedLucroLiquidoValue = showingStoredPresentation
    ? (scopedStoredPresentation?.lucroLiquido ?? null)
    : canReuseDisplayedNetProfit
      ? previousNetProfit.value
      : currentLucroLiquidoValue;
  const showHeroCards =
    summary !== undefined ||
    canReuseDisplayedNetProfit ||
    hasProgressiveRevenuePreview ||
    showingStoredPresentation;
  // Keep SwiftUI Text identity stable across revalidation of the same account and presentation scope.
  const netProfitNumberKey = JSON.stringify([
    authUser?.id,
    sessionVersion,
    financialPresentationScopeKey,
  ]);
  /* eslint-disable react-hooks/set-state-in-effect -- stores only stable data, never animation frames. */
  useEffect(() => {
    const uid = authUser?.id;
    if (!uid || !hasStableSnapshot || !faturamentoReady) return;
    setDisplayedRevenue((current) =>
      current.faturamento === currentFaturamentoValue &&
      current.uid === uid &&
      current.sessionVersion === sessionVersion &&
      current.scopeKey === requestedScopeKey &&
      current.sessionScopeKey === snapshotSessionScopeKey &&
      current.requestScopeKey === visibleRequestScopeKey
        ? current
        : {
            uid,
            sessionVersion,
            faturamento: currentFaturamentoValue,
            scopeKey: requestedScopeKey,
            sessionScopeKey: snapshotSessionScopeKey,
            requestScopeKey: visibleRequestScopeKey,
          },
    );
  }, [
    currentFaturamentoValue,
    authUser?.id,
    faturamentoReady,
    hasStableSnapshot,
    requestedScopeKey,
    snapshotSessionScopeKey,
    sessionVersion,
    visibleRequestScopeKey,
  ]);

  useEffect(() => {
    const uid = authUser?.id;
    if (
      !canPresentCurrentNetProfit ||
      currentLucroLiquidoValue === null ||
      !uid ||
      !snapshotSessionScopeKey
    ) {
      return;
    }
    setLastConfirmedNetProfit((current) =>
      current?.uid === uid &&
      current?.sessionVersion === sessionVersion &&
      current?.snapshotSessionScopeKey === snapshotSessionScopeKey &&
      current?.scopeKey === requestedScopeKey &&
      current?.requestScopeKey === requestScopeKey &&
      current.value === currentLucroLiquidoValue &&
      current.comparison === displayedNetProfitComparison
        ? current
        : {
            uid,
            sessionVersion,
            snapshotSessionScopeKey,
            scopeKey: requestedScopeKey,
            requestScopeKey,
            value: currentLucroLiquidoValue,
            comparison: displayedNetProfitComparison,
          },
    );
  }, [
    canPresentCurrentNetProfit,
    currentLucroLiquidoValue,
    displayedNetProfitComparison,
    authUser?.id,
    requestedScopeKey,
    requestScopeKey,
    sessionVersion,
    snapshotSessionScopeKey,
  ]);

  useEffect(() => {
    const uid = authUser?.id;
    const values = currentLivePresentationValues;
    if (
      !currentLivePresentationReady ||
      !isFocused ||
      authStatus !== 'authenticated' ||
      !uid ||
      !testModeReady ||
      testModeEnabled ||
      !values ||
      !isActiveAuthSession(uid, sessionVersion)
    ) {
      return;
    }

    const scopeKey = financialPresentationScopeKey;
    setStoredPresentation((current) => {
      if (
        current?.uid === uid &&
        current.sessionVersion === sessionVersion &&
        current.scopeKey === scopeKey &&
        current.source === 'live' &&
        current.snapshotSessionScopeKey === snapshotSessionScopeKey &&
        financialPresentationValuesMatch(current.values, values)
      ) {
        return current;
      }
      return { uid, sessionVersion, source: 'live', snapshotSessionScopeKey, scopeKey, values };
    });

    const canPersist = () => {
      const context = presentationContextRef.current;
      return (
        context.uid === uid &&
        context.sessionVersion === sessionVersion &&
        context.scopeKey === scopeKey &&
        context.isFocused &&
        context.authStatus === 'authenticated' &&
        context.testModeReady &&
        !context.testModeEnabled &&
        livePresentationReadyRef.current &&
        isActiveAuthSession(uid, sessionVersion)
      );
    };

    void financialPresentationCache
      .writeWithStatus(uid, scopeKey, values, canPersist)
      .catch(() => undefined);
  }, [
    authStatus,
    authUser?.id,
    currentLivePresentationReady,
    currentLivePresentationValues,
    financialPresentationScopeKey,
    isFocused,
    sessionVersion,
    snapshotSessionScopeKey,
    testModeEnabled,
    testModeReady,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const header = (
    <NativeGlassHeader
      includeTopSafeArea={false}
      largeTitle
      mode="transparent"
      titleStyle={{
        fontFamily: 'System',
        fontSize: 36,
        fontWeight: '700',
        marginLeft: -(theme.spacing.xxs * 2),
      }}
      title="Finanças"
    />
  );
  const canOpenMonthlyDetails = hasStableSnapshot && wholesaleSelection.kind === 'month';
  const canOpenMonthlyNetProfitDetails = canOpenMonthlyDetails && routesLoaded && fuelCostsReady;
  const openMonthlyChart = useWholesaleChartNavigation(
    selectedPeriod,
    canOpenMonthlyDetails,
    canOpenMonthlyNetProfitDetails,
  );

  const handleSelectWeek = useCallback((weekStart: string) => {
    setSelectedWeek(getHistoryWeekRange(weekStart));
  }, []);
  const weekGroups = useMemo(
    () => createHistoryWeekGroups(Number(selectedWeek.startDate.slice(0, 4))),
    [selectedWeek.startDate],
  );
  const financeToolbarItems = useMemo(() => {
    if (wholesaleSelection.kind === 'month') {
      return renderFinancePeriodToolbarItems({
        composition: 'combined',
        onMonthChange: setSelectedMonth,
        onYearChange: setSelectedYear,
        selectedMonth,
        selectedYear,
      });
    }

    if (wholesaleSelection.kind === 'day') {
      return renderNativeDateToolbarItems({
        mode: 'day',
        onDateChange: setSelectedDay,
        placement: 'right',
        selectedDate: selectedDay,
      });
    }

    if (wholesaleSelection.kind === 'week') {
      return renderNativeDateToolbarItems({
        mode: 'week',
        onDateChange: handleSelectWeek,
        onWeekChange: handleSelectWeek,
        placement: 'right',
        selectedDate: selectedWeek.startDate,
        weekGroups,
      });
    }

    return [
      <Stack.Toolbar.Button
        accessibilityLabel="Período financeiro"
        key="all"
        separateBackground={false}
      >
        <Stack.Toolbar.Label>
          {formatWholesaleFinancePeriodLabel(wholesaleSelection)}
        </Stack.Toolbar.Label>
      </Stack.Toolbar.Button>,
    ];
  }, [
    handleSelectWeek,
    selectedDay,
    selectedMonth,
    selectedWeek.startDate,
    selectedYear,
    weekGroups,
    wholesaleSelection,
  ]);

  return (
    <>
      <Stack.Toolbar placement="right">{financeToolbarItems}</Stack.Toolbar>
      <ProgressiveCollapsibleScreen
        compactTitle="Finanças"
        contentGap={24}
        contentTopInset={theme.spacing.xl + theme.spacing.xxl + theme.spacing.xxs * 2 + 2}
        largeTitle={<View style={styles.header}>{header}</View>}
        nativeTabRoot
        scrollContentContainerStyle={{
          paddingBottom: theme.layout.tabBarHeight + insets.bottom + theme.spacing.lg,
        }}
      >
        <NativeRetailFinanceCategorySelector
          accessibilityLabel="Período financeiro do Atacado"
          fillAvailableWidth
          items={WHOLESALE_FINANCE_PERIOD_ITEMS}
          onChange={(nextKind) => {
            if (WHOLESALE_FINANCE_PERIOD_ITEMS.some((item) => item.key === nextKind)) {
              setPeriodKind(nextKind as WholesaleFinancePeriodKind);
            }
          }}
          selectionAnimationMode="slidingBubble"
          selectedKey={periodKind}
        />
        {showHeroCards ? (
          <>
            <PremiumCard
              accessibilityLabel={
                canOpenMonthlyDetails ? 'Abrir detalhes do faturamento' : undefined
              }
              onPress={
                canOpenMonthlyDetails ? () => openMonthlyChart('faturamento-mensal') : undefined
              }
              preservePressableIdentity
              style={[
                styles.heroCard,
                {
                  backgroundColor: financeCardSurface,
                  borderRadius: theme.radius.xl + theme.spacing.md,
                },
              ]}
            >
              <View style={styles.heroHeader}>
                <View style={styles.heroTitle}>
                  <Text style={[theme.typography.caption, { color: theme.colors.textPrimary }]}>
                    FATURAMENTO
                  </Text>
                  {canOpenMonthlyDetails ? (
                    <Ionicons
                      color={theme.colors.textSecondary}
                      name="chevron-forward-outline"
                      size={theme.sizes.iconSmall}
                    />
                  ) : null}
                </View>
                <FinancialTrendIndicator
                  comparison={displayedFaturamentoComparison}
                  visible={displayedFaturamentoComparison !== undefined}
                />
              </View>
              <NativeAnimatedNumber
                animationEnabled={displayedFaturamentoValue !== null}
                color={theme.colors.textPrimary}
                ignoreSafeArea="all"
                text={
                  displayedFaturamentoValue !== null
                    ? formatCurrency(displayedFaturamentoValue)
                    : ''
                }
                value={displayedFaturamentoValue}
              />
            </PremiumCard>
            <PremiumCard
              accessibilityLabel={
                canOpenMonthlyNetProfitDetails ? 'Abrir detalhes do lucro líquido' : undefined
              }
              onPress={
                canOpenMonthlyNetProfitDetails
                  ? () => openMonthlyChart('lucro-liquido-mensal')
                  : undefined
              }
              preservePressableIdentity
              style={[
                styles.heroCard,
                {
                  backgroundColor: financeCardSurface,
                  borderRadius: theme.radius.xl + theme.spacing.md,
                },
              ]}
            >
              <View style={styles.heroHeader}>
                <View style={styles.heroTitle}>
                  <Text style={[theme.typography.caption, { color: theme.colors.textPrimary }]}>
                    LUCRO LÍQUIDO
                  </Text>
                  {canOpenMonthlyNetProfitDetails ? (
                    <Ionicons
                      color={theme.colors.textSecondary}
                      name="chevron-forward-outline"
                      size={theme.sizes.iconSmall}
                    />
                  ) : null}
                </View>
                <FinancialTrendIndicator
                  comparison={displayedNetProfitComparison}
                  visible={displayedNetProfitComparison !== undefined}
                />
              </View>
              <NativeAnimatedNumber
                key={netProfitNumberKey}
                animateFirstValue
                animationEnabled={displayedLucroLiquidoValue !== null}
                color={
                  displayedLucroLiquidoValue === null
                    ? theme.colors.textSecondary
                    : theme.colors.textPrimary
                }
                fontSize={
                  displayedLucroLiquidoValue === null
                    ? theme.typography.footnote.fontSize
                    : undefined
                }
                fontWeight={displayedLucroLiquidoValue === null ? 'regular' : undefined}
                ignoreSafeArea="all"
                text={
                  displayedLucroLiquidoValue !== null
                    ? formatCurrency(displayedLucroLiquidoValue)
                    : loading || refreshing
                      ? 'Aguardando confirmação'
                      : 'Lucro líquido indisponível'
                }
                value={displayedLucroLiquidoValue}
              />
            </PremiumCard>
          </>
        ) : null}
        {displayedSummary ? (
          <>
            <SummaryCard
              rows={[
                {
                  label: 'Baldes vendidos',
                  value: String(displayedSummary.quantidadeBaldes),
                },
                { label: 'Lucro bruto', value: formatCurrency(displayedSummary.lucroBruto) },
                { label: 'Recebido', value: formatCurrency(displayedSummary.valoresPagos) },
                {
                  label: 'A receber',
                  value: formatCurrency(displayedSummary.valoresPendentes),
                },
              ]}
              style={{ backgroundColor: financeCardSurface }}
              title="OPERAÇÃO"
            />
            <SummaryCard
              rows={[
                {
                  label: 'Custo dos baldes',
                  value: formatCurrency(displayedSummary.custoTotalBaldes),
                },
                {
                  label: 'Custo combustível',
                  value: displayedSummaryHasCompleteProfitFields
                    ? formatCurrency(displayedSummary.custoCombustivel)
                    : '',
                },
                { label: 'Outros', value: formatCurrency(displayedSummary.custoOutros) },
                { label: 'Luz do período', value: formatCurrency(displayedSummary.custoLuz) },
                {
                  label: 'Custo médio de entrega',
                  value: displayedSummaryHasCompleteProfitFields
                    ? formatCurrency(displayedSummary.custoMedioCombustivelPorEntrega)
                    : '',
                },
              ]}
              style={{ backgroundColor: financeCardSurface }}
              title="CUSTOS"
            />
            <SummaryCard
              rows={[
                { label: 'Recebido', value: formatCurrency(displayedSummary.valoresPagos) },
                {
                  label: 'A receber',
                  value: formatCurrency(displayedSummary.valoresPendentes),
                },
                {
                  label: 'Margem bruta',
                  value: `${displayedSummary.margemBruta.toFixed(1)}%`,
                },
                {
                  label: 'Margem líquida',
                  value: displayedSummaryHasCompleteProfitFields
                    ? `${displayedSummary.margemLiquida.toFixed(1)}%`
                    : '',
                },
              ]}
              style={{ backgroundColor: financeCardSurface }}
              title="RECEBIDO/MARGENS"
            />
            <SummaryCard
              rows={[
                {
                  label: 'Venda p/ balde',
                  value: formatCurrency(displayedSummary.precoMedioBalde),
                },
                {
                  label: 'Lucro p/ balde',
                  value: displayedSummaryHasCompleteProfitFields
                    ? formatCurrency(displayedSummary.lucroLiquidoPorBalde)
                    : '',
                },
                {
                  label: 'Custo p/ balde',
                  value: displayedSummaryHasCompleteProfitFields
                    ? formatCurrency(displayedSummary.custoMedioBalde)
                    : '',
                },
              ]}
              style={{ backgroundColor: financeCardSurface }}
              title="POR BALDE"
            />
          </>
        ) : null}
        {showHeroCards ? (
          !showingStoredPresentation && financeDataNotice ? (
            <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
              {financeNoticeSource === 'cache'
                ? 'Dados exibidos do cache local. '
                : financeNoticeSource === 'local'
                  ? 'Dados locais sem confirmação remota. '
                  : ''}
              {financeDataNotice}
            </Text>
          ) : !showingStoredPresentation && hasProgressiveRevenuePreview && loading ? (
            <Loading label="Carregando demais indicadores..." />
          ) : null
        ) : loading ? (
          <Loading label="Carregando Finanças Atacado..." />
        ) : error ? (
          <Text style={[theme.typography.footnote, { color: theme.colors.danger }]}>
            Lucro líquido indisponível. {error}
          </Text>
        ) : null}
      </ProgressiveCollapsibleScreen>
    </>
  );
}

function RetailFinanceScreen() {
  const { resolvedMode, theme } = useAppTheme();
  const insets = useAppSafeAreaInsets();
  const { month, year } = getCurrentHistoryPeriod();
  const isFocused = useIsFocused();
  const [selectedMonth, setSelectedMonth] = useState(month);
  const [selectedYear, setSelectedYear] = useState(year);
  const [view, setView] = useState<RetailFinanceView>('general');
  const { categories } = useRetailCategories({ includeInactive: true });
  const selectedPeriod = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-15`;
  const period = useMemo(() => getHistoryMonthRange(selectedPeriod), [selectedPeriod]);
  const { categoryOptions, error, refreshing, reload, summary } = useRetailFinance(period, view, {
    categories,
    enabled: isFocused,
  });
  const showRetailFinanceInitialization = !summary && !error;
  const financeViews = useMemo(
    () => [
      { key: 'general' as const, label: 'Geral' },
      ...categoryOptions.map((category) => ({
        key: retailFinanceViewForCategory(category.categoryId),
        label: category.label,
      })),
    ],
    [categoryOptions],
  );
  const selectedViewLabel = financeViews.find((item) => item.key === view)?.label ?? 'Geral';
  const financeCardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surface);
  const toolbarItems = useMemo(
    () =>
      renderFinancePeriodToolbarItems({
        composition: 'combined',
        onMonthChange: setSelectedMonth,
        onYearChange: setSelectedYear,
        selectedMonth,
        selectedYear,
      }),
    [selectedMonth, selectedYear],
  );
  const header = (
    <NativeGlassHeader
      includeTopSafeArea={false}
      largeTitle
      mode="transparent"
      title="Finanças"
      titleStyle={{
        fontFamily: 'System',
        fontSize: 36,
        fontWeight: '700',
        marginLeft: -(theme.spacing.xxs * 2),
      }}
    />
  );
  return (
    <>
      <Stack.Toolbar placement="right">{toolbarItems}</Stack.Toolbar>
      <ProgressiveCollapsibleScreen
        compactTitle="Finanças"
        contentGap={24}
        contentTopInset={theme.spacing.xl + theme.spacing.xxl + theme.spacing.xxs * 2 + 2}
        largeTitle={<View style={styles.header}>{header}</View>}
        nativeTabRoot
        scrollContentContainerStyle={{
          paddingBottom: theme.layout.tabBarHeight + insets.bottom + theme.spacing.lg,
        }}
      >
        <NativeRetailFinanceCategorySelector
          accessibilityLabel="Visão financeira do Varejo"
          contentLeadingPadding={0}
          contentTrailingPadding={0}
          itemHorizontalPadding={theme.spacing.xs}
          itemSpacing={theme.spacing.md}
          items={financeViews}
          onChange={(nextView) => setView(nextView as RetailFinanceView)}
          selectionAnimationMode="slidingBubble"
          selectedKey={view}
        />
        {showRetailFinanceInitialization ? (
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            Carregando Finanças Varejo...
          </Text>
        ) : error && !summary ? (
          <PremiumCard style={{ backgroundColor: financeCardSurface, padding: 20 }}>
            <Text style={[theme.typography.body, { color: theme.colors.danger }]}>{error}</Text>
            <Text
              onPress={() => void reload()}
              style={[
                theme.typography.footnote,
                { color: theme.colors.textPrimary, marginTop: 12 },
              ]}
            >
              Tentar novamente
            </Text>
          </PremiumCard>
        ) : summary ? (
          <>
            <PremiumCard
              style={[
                styles.heroCard,
                {
                  backgroundColor: financeCardSurface,
                  borderRadius: theme.radius.xl + theme.spacing.md,
                },
              ]}
            >
              <Text style={[theme.typography.caption, { color: theme.colors.textPrimary }]}>
                RECEBIDO
              </Text>
              <NativeAnimatedNumber
                animationEnabled={!refreshing}
                color={theme.colors.textPrimary}
                text={formatCurrency(summary.revenueReceived)}
                value={summary.revenueReceived}
              />
            </PremiumCard>
            <PremiumCard
              style={[
                styles.heroCard,
                {
                  backgroundColor: financeCardSurface,
                  borderRadius: theme.radius.xl + theme.spacing.md,
                },
              ]}
            >
              <Text style={[theme.typography.caption, { color: theme.colors.textPrimary }]}>
                LUCRO DIRETO
              </Text>
              <NativeAnimatedNumber
                animationEnabled={!refreshing}
                color={theme.colors.textPrimary}
                text={formatCurrency(summary.profit)}
                value={summary.profit}
              />
            </PremiumCard>
            <PremiumCard
              style={{
                backgroundColor: financeCardSurface,
                borderRadius: theme.radius.xl + theme.spacing.md,
                padding: 16,
              }}
            >
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                RECEITA POR PERÍODO
              </Text>
              <FinancialSeriesChart
                accessibilityLabel="Série de receita recebida do Varejo"
                color={theme.colors.primary}
                points={summary.series}
              />
            </PremiumCard>
            <SummaryCard
              rows={[
                {
                  label: 'Receita dos produtos',
                  value: formatCurrency(summary.productRevenueRecognized),
                },
                ...(view === 'general'
                  ? [
                      {
                        label: 'Taxa de entrega',
                        value: formatCurrency(summary.deliveryFeeRecognized),
                      },
                    ]
                  : []),
                {
                  label: 'Custo dos produtos',
                  value: formatCurrency(summary.productCostRecognized),
                },
                ...(view === 'general'
                  ? [
                      {
                        label: 'Custo de entrega',
                        value: formatCurrency(summary.deliveryCostRecognized),
                      },
                      { label: 'Taxas de pagamento', value: formatCurrency(summary.paymentFees) },
                    ]
                  : []),
                { label: 'Margem', value: `${summary.margin.toFixed(1)}%` },
                { label: 'Pedidos', value: String(summary.orderCount) },
                { label: 'Unidades', value: String(summary.unitsSold) },
              ]}
              style={{ backgroundColor: financeCardSurface }}
              title={selectedViewLabel}
            />
            {error ? (
              <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
                Dados exibidos do último cache válido. {error}
              </Text>
            ) : null}
          </>
        ) : null}
      </ProgressiveCollapsibleScreen>
    </>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    currency: 'BRL',
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(value);
}

const styles = StyleSheet.create({
  header: { minHeight: 44 },
  heroCard: { gap: 8, padding: 24 },
  heroHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  heroTitle: { alignItems: 'center', flexDirection: 'row', gap: 4 },
});
