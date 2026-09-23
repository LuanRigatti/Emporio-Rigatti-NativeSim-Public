import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Loading } from '@/components/feedback';
import { NativeGlassHeader } from '@/components/layout';
import {
  NativeAnimatedNumber,
  NativeRetailFinanceCategorySelector,
  renderNativeDateToolbarItems,
} from '@/components/native';
import { FinancialSeriesChart } from '@/components/Charts';
import { PremiumCard, PremiumScreen, SummaryCard } from '@/components/premium';
import { FinancialTrendIndicator, renderFinancePeriodToolbarItems } from '@/features/finance';
import { getCurrentHistoryPeriod } from '@/features/history/utils/historyDateUtils';
import {
  createHistoryWeekGroups,
  getHistoryMonthRange,
  getHistoryWeekRange,
} from '@/features/history/utils/historyPeriodUtils';
import { useFinancialData } from '@/hooks/useFinancialData';
import { useFinancialFuelCosts } from '@/hooks/useFinancialFuelCosts';
import { useRetailCategories } from '@/hooks/useRetailCategories';
import { useRetailFinance } from '@/hooks/useRetailFinance';
import { useAppMode } from '@/providers';
import { expenseQueryForWholesaleFinanceSelection } from '@/services/costs';
import {
  financialCalculationService,
  formatWholesaleFinancePeriodLabel,
  wholesaleFinanceFiltersForSelection,
} from '@/services/finance';
import { routeTrackingRepository, summarizeRouteKilometersByDate } from '@/services/routes';
import { retailFinanceViewForCategory, type RetailFinanceView } from '@/services/retail-finance';
import type { WholesaleFinanceSelection } from '@/types/data';
import type { RouteTrackingSession } from '@/types/routeTracking';
import { getCardSurfaceColor, useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { todayIso } from '@/utils/data';

export default function FinanceiroRoute() {
  const { mode } = useAppMode();
  return mode === 'retail' ? <RetailFinanceScreen /> : <WholesaleFinanceScreen />;
}

const WHOLESALE_FINANCE_PERIOD_ITEMS = [
  { key: 'month', label: 'Mês' },
  { key: 'day', label: 'Dia' },
  { key: 'week', label: 'Semana' },
  { key: 'all', label: 'Total' },
] as const;

type WholesaleFinancePeriodKind = WholesaleFinanceSelection['kind'];

function WholesaleFinanceScreen() {
  const router = useRouter();
  const { resolvedMode, theme } = useAppTheme();
  const financeCardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surface);
  const isFocused = useIsFocused();
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
  const [displayedHeroValues, setDisplayedHeroValues] = useState<{
    scopeKey?: string;
    faturamento: number | null;
    lucroLiquido: number | null;
  }>({ faturamento: null, lucroLiquido: null });
  const initialRouteSessions = routeTrackingRepository.getMemoryRouteHistory();
  const [routeSessions, setRouteSessions] = useState<RouteTrackingSession[]>(
    () => initialRouteSessions ?? [],
  );
  const [routesLoaded, setRoutesLoaded] = useState(() => initialRouteSessions !== null);
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
    error,
    loading,
    remoteComplete,
    routesCoverage,
    snapshot,
    snapshotScopeKey,
  } = useFinancialData(financialQuery, {
    displayMonth: wholesaleSelection.kind === 'month' ? selectedPeriod : undefined,
    enabled: isFocused,
  });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void routeTrackingRepository
        .getRouteHistory()
        .then((sessions) => {
          if (active) {
            setRouteSessions(sessions);
            setRoutesLoaded(true);
          }
        })
        .catch(() => {
          if (active) {
            setRouteSessions([]);
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
  /* eslint-disable react-hooks/set-state-in-effect -- this state stores only the last stable visible scope. */
  useEffect(() => {
    if (!hasStableSnapshot) return;
    setDisplayedSelection((current) =>
      current === wholesaleSelection ? current : wholesaleSelection,
    );
  }, [hasStableSnapshot, wholesaleSelection]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const summarySelection = hasStableSnapshot ? wholesaleSelection : displayedSelection;
  const hasVisibleSnapshot = hasStableSnapshot || displayedHeroValues.scopeKey !== undefined;
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
  );

  const summaryFilters = useMemo(
    () => wholesaleFinanceFiltersForSelection(summarySelection),
    [summarySelection],
  );
  const isNetProfitReady =
    activeSnapshot !== null &&
    routesLoaded &&
    fuelCostsReady &&
    (routesCoverage === 'local-only' || remoteComplete);

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
  const currentFaturamentoValue = summary?.faturamento ?? null;
  const currentLucroLiquidoValue = isNetProfitReady && summary ? summary.lucroLiquido : null;
  const faturamentoReady = summary !== undefined && currentFaturamentoValue !== null;
  const lucroLiquidoReady = isNetProfitReady && currentLucroLiquidoValue !== null;
  const keepingPreviousSummary = !hasStableSnapshot && displayedHeroValues.scopeKey !== undefined;
  const displayedFaturamentoValue = faturamentoReady
    ? currentFaturamentoValue
    : keepingPreviousSummary
      ? displayedHeroValues.faturamento
      : null;
  const displayedLucroLiquidoValue = lucroLiquidoReady
    ? currentLucroLiquidoValue
    : keepingPreviousSummary
      ? displayedHeroValues.lucroLiquido
      : null;

  /* eslint-disable react-hooks/set-state-in-effect -- stores only stable data, never animation frames. */
  useEffect(() => {
    if (!hasStableSnapshot || (!faturamentoReady && !lucroLiquidoReady)) return;
    setDisplayedHeroValues((current) => {
      const base =
        current.scopeKey === requestedScopeKey
          ? current
          : { faturamento: null, lucroLiquido: null, scopeKey: requestedScopeKey };
      const next = {
        faturamento: faturamentoReady ? currentFaturamentoValue : base.faturamento,
        lucroLiquido: lucroLiquidoReady ? currentLucroLiquidoValue : base.lucroLiquido,
        scopeKey: requestedScopeKey,
      };
      return next.faturamento === current.faturamento &&
        next.lucroLiquido === current.lucroLiquido &&
        next.scopeKey === current.scopeKey
        ? current
        : next;
    });
  }, [
    currentFaturamentoValue,
    currentLucroLiquidoValue,
    faturamentoReady,
    hasStableSnapshot,
    lucroLiquidoReady,
    requestedScopeKey,
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
  const handleOpenFaturamento = () => {
    if (!canOpenMonthlyDetails) return;
    triggerLightImpactHaptic();
    router.push({
      pathname: '/faturamento-mensal',
      params: { period: selectedPeriod },
    });
  };

  const handleOpenLucroLiquido = () => {
    if (!canOpenMonthlyDetails) return;
    triggerLightImpactHaptic();
    router.push({
      pathname: '/lucro-liquido-mensal',
      params: { period: selectedPeriod },
    });
  };

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
    <PremiumScreen
      contentContainerStyle={[
        styles.content,
        {
          marginTop: theme.spacing.xl + theme.spacing.xxl + theme.spacing.xxs * 2 + 2,
        },
      ]}
      progressiveBlurHeight={
        theme.spacing.xxxl + theme.spacing.xs * 2 + theme.spacing.xl + theme.spacing.sm
      }
      progressiveBlurTopOffset={0}
      progressiveBlur
    >
      <Stack.Toolbar placement="right">{financeToolbarItems}</Stack.Toolbar>
      <View style={styles.header}>{header}</View>
      <NativeRetailFinanceCategorySelector
        accessibilityLabel="Período financeiro do Atacado"
        fillAvailableWidth
        items={WHOLESALE_FINANCE_PERIOD_ITEMS}
        onChange={(nextKind) => {
          if (WHOLESALE_FINANCE_PERIOD_ITEMS.some((item) => item.key === nextKind)) {
            setPeriodKind(nextKind as WholesaleFinancePeriodKind);
          }
        }}
        selectedKey={periodKind}
        selectedVisualScale={1.06}
      />
      {summary ? (
        <>
          <PremiumCard
            accessibilityLabel={canOpenMonthlyDetails ? 'Abrir detalhes do faturamento' : undefined}
            onPress={canOpenMonthlyDetails ? handleOpenFaturamento : undefined}
            preservePressableIdentity
            style={[
              styles.heroCard,
              {
                backgroundColor: financeCardSurface,
                borderRadius: theme.radius.xl + theme.spacing.sm,
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
                comparison={comparison?.faturamento}
                visible={comparison !== undefined}
              />
            </View>
            <NativeAnimatedNumber
              animationEnabled={faturamentoReady}
              color={theme.colors.textPrimary}
              text={
                displayedFaturamentoValue !== null ? formatCurrency(displayedFaturamentoValue) : ''
              }
              value={displayedFaturamentoValue}
            />
          </PremiumCard>
          <PremiumCard
            accessibilityLabel={
              canOpenMonthlyDetails ? 'Abrir detalhes do lucro líquido' : undefined
            }
            onPress={canOpenMonthlyDetails ? handleOpenLucroLiquido : undefined}
            preservePressableIdentity
            style={[
              styles.heroCard,
              {
                backgroundColor: financeCardSurface,
                borderRadius: theme.radius.xl + theme.spacing.sm,
              },
            ]}
          >
            <View style={styles.heroHeader}>
              <View style={styles.heroTitle}>
                <Text style={[theme.typography.caption, { color: theme.colors.textPrimary }]}>
                  LUCRO LÍQUIDO
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
                comparison={isNetProfitReady ? comparison?.lucroLiquido : undefined}
                visible={isNetProfitReady && comparison !== undefined}
              />
            </View>
            <NativeAnimatedNumber
              animationEnabled={lucroLiquidoReady}
              color={theme.colors.textPrimary}
              text={
                displayedLucroLiquidoValue !== null
                  ? formatCurrency(displayedLucroLiquidoValue)
                  : ''
              }
              value={displayedLucroLiquidoValue}
            />
          </PremiumCard>
          <SummaryCard
            rows={[
              { label: 'Baldes vendidos', value: summary ? String(summary.quantidadeBaldes) : '' },
              { label: 'Lucro bruto', value: summary ? formatCurrency(summary.lucroBruto) : '' },
              { label: 'Recebido', value: summary ? formatCurrency(summary.valoresPagos) : '' },
              {
                label: 'A receber',
                value: summary ? formatCurrency(summary.valoresPendentes) : '',
              },
            ]}
            style={{ backgroundColor: financeCardSurface }}
            title="OPERAÇÃO"
          />
          <SummaryCard
            rows={[
              {
                label: 'Custo dos baldes',
                value: summary ? formatCurrency(summary.custoTotalBaldes) : '',
              },
              {
                label: 'Custo combustível',
                value: isNetProfitReady && summary ? formatCurrency(summary.custoCombustivel) : '',
              },
              { label: 'Outros', value: summary ? formatCurrency(summary.custoOutros) : '' },
              { label: 'Luz do período', value: summary ? formatCurrency(summary.custoLuz) : '' },
              {
                label: 'Custo médio de entrega',
                value:
                  isNetProfitReady && summary
                    ? formatCurrency(summary.custoMedioCombustivelPorEntrega)
                    : '',
              },
            ]}
            style={{ backgroundColor: financeCardSurface }}
            title="CUSTOS"
          />
          <SummaryCard
            rows={[
              { label: 'Recebido', value: summary ? formatCurrency(summary.valoresPagos) : '' },
              {
                label: 'A receber',
                value: summary ? formatCurrency(summary.valoresPendentes) : '',
              },
              { label: 'Margem bruta', value: summary ? `${summary.margemBruta.toFixed(1)}%` : '' },
              {
                label: 'Margem líquida',
                value: isNetProfitReady && summary ? `${summary.margemLiquida.toFixed(1)}%` : '',
              },
            ]}
            style={{ backgroundColor: financeCardSurface }}
            title="RECEBIDO/MARGENS"
          />
          <SummaryCard
            rows={[
              {
                label: 'Venda p/ balde',
                value: summary ? formatCurrency(summary.precoMedioBalde) : '',
              },
              {
                label: 'Lucro p/ balde',
                value:
                  isNetProfitReady && summary ? formatCurrency(summary.lucroLiquidoPorBalde) : '',
              },
              {
                label: 'Custo p/ balde',
                value: isNetProfitReady && summary ? formatCurrency(summary.custoMedioBalde) : '',
              },
            ]}
            style={{ backgroundColor: financeCardSurface }}
            title="POR BALDE"
          />
          {error ? (
            <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
              Dados exibidos do último cache válido. {error}
            </Text>
          ) : null}
        </>
      ) : loading ? (
        <Loading label="Carregando Finanças Atacado..." />
      ) : error ? (
        <Text style={[theme.typography.footnote, { color: theme.colors.danger }]}>{error}</Text>
      ) : null}
    </PremiumScreen>
  );
}

function RetailFinanceScreen() {
  const { resolvedMode, theme } = useAppTheme();
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
    <PremiumScreen
      contentContainerStyle={[
        styles.content,
        { marginTop: theme.spacing.xl + theme.spacing.xxl + theme.spacing.xxs * 2 + 2 },
      ]}
      progressiveBlur
      progressiveBlurHeight={
        theme.spacing.xxxl + theme.spacing.xs * 2 + theme.spacing.xl + theme.spacing.sm
      }
      progressiveBlurTopOffset={0}
    >
      <Stack.Toolbar placement="right">{toolbarItems}</Stack.Toolbar>
      <View style={styles.header}>{header}</View>
      <NativeRetailFinanceCategorySelector
        accessibilityLabel="Visão financeira do Varejo"
        contentTrailingPadding={0}
        itemHorizontalPadding={theme.spacing.xs / 2}
        itemSpacing={theme.spacing.xxs / 4}
        items={financeViews}
        onChange={(nextView) => setView(nextView as RetailFinanceView)}
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
            style={[theme.typography.footnote, { color: theme.colors.textPrimary, marginTop: 12 }]}
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
                borderRadius: theme.radius.xl + theme.spacing.sm,
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
                borderRadius: theme.radius.xl + theme.spacing.sm,
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
              { label: 'Custo dos produtos', value: formatCurrency(summary.productCostRecognized) },
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
    </PremiumScreen>
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
  content: { gap: 24 },
  header: { minHeight: 44 },
  heroCard: { gap: 8, padding: 24 },
  heroHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  heroTitle: { alignItems: 'center', flexDirection: 'row', gap: 4 },
});
