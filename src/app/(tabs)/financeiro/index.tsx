import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { NativeAnimatedNumber } from '@/components/native';
import { PremiumCard, PremiumScreen, SummaryCard } from '@/components/premium';
import { FinancialTrendIndicator, renderFinancePeriodToolbarItems } from '@/features/finance';
import { activeTabStore } from '@/navigation/activeTabStore';
import { getCurrentHistoryPeriod } from '@/features/history/utils/historyDateUtils';
import { useFinancialData } from '@/hooks/useFinancialData';
import { useFinancialFuelCosts } from '@/hooks/useFinancialFuelCosts';
import { expenseQueryForFinancialSelection } from '@/services/costs';
import { financialCalculationService } from '@/services/finance';
import { routeTrackingRepository, summarizeRouteKilometersByDate } from '@/services/routes';
import type { RouteTrackingSession } from '@/types/routeTracking';
import { getCardSurfaceColor, useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';

export default function PrototypeFinanceiro() {
  const router = useRouter();
  const { resolvedMode, theme } = useAppTheme();
  const financeCardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surface);
  const isFocused = useIsFocused();
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentHistoryPeriod().month);
  const [selectedYear, setSelectedYear] = useState(() => getCurrentHistoryPeriod().year);
  const [displayedHeroValues, setDisplayedHeroValues] = useState<{
    faturamento: number | null;
    lucroLiquido: number | null;
  }>({ faturamento: null, lucroLiquido: null });
  const initialRouteSessions = routeTrackingRepository.getMemoryRouteHistory();
  const [routeSessions, setRouteSessions] = useState<RouteTrackingSession[]>(
    () => initialRouteSessions ?? [],
  );
  const [routesLoaded, setRoutesLoaded] = useState(() => initialRouteSessions !== null);
  const selectedPeriod = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const { comparisonSnapshot, snapshot, snapshotScopeKey } = useFinancialData(
    expenseQueryForFinancialSelection({ kind: 'month', month: selectedPeriod }),
    { displayMonth: selectedPeriod, enabled: isFocused },
  );
  const displayedPeriod = isMonthlyPeriod(snapshotScopeKey) ? snapshotScopeKey : selectedPeriod;
  const { month: displayedMonth, year: displayedYear } = parsePeriodKey(displayedPeriod);

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
  const fuelExpenses = useMemo(
    () => ({
      ...(comparisonSnapshot?.gastosDiarios ?? {}),
      ...(snapshot?.gastosDiarios ?? {}),
    }),
    [comparisonSnapshot?.gastosDiarios, snapshot?.gastosDiarios],
  );
  const { fuelCostByDate, isReady: fuelCostsReady } = useFinancialFuelCosts(
    fuelExpenses,
    routeSessions,
  );

  const hasStableSnapshot = snapshot !== null && snapshotScopeKey === displayedPeriod;
  const isNetProfitReady = hasStableSnapshot && routesLoaded && fuelCostsReady;

  const summary = useMemo(
    () =>
      snapshot
        ? financialCalculationService.calculateResumo({
            deliveries: snapshot.entregas,
            dailyExpenses: snapshot.gastosDiarios,
            filters: { mesSelecionado: displayedPeriod, periodo: 'mes' },
            monthlyExpenses: snapshot.gastosMensais,
            automaticKilometersByDate,
            fuelCostByDate,
          })
        : undefined,
    [automaticKilometersByDate, displayedPeriod, fuelCostByDate, snapshot],
  );
  const comparison = useMemo(
    () =>
      snapshot && comparisonSnapshot
        ? financialCalculationService.compareCalendarMonths({
            deliveries: comparisonSnapshot.entregas,
            dailyExpenses: comparisonSnapshot.gastosDiarios,
            filters: { mesSelecionado: displayedPeriod, periodo: 'mes' },
            monthlyExpenses: comparisonSnapshot.gastosMensais,
            automaticKilometersByDate,
            fuelCostByDate,
          })
        : undefined,
    [automaticKilometersByDate, comparisonSnapshot, displayedPeriod, fuelCostByDate, snapshot],
  );
  const currentFaturamentoValue = summary?.faturamento ?? null;
  const currentLucroLiquidoValue = isNetProfitReady && summary ? summary.lucroLiquido : null;
  const faturamentoReady = hasStableSnapshot && currentFaturamentoValue !== null;
  const lucroLiquidoReady = isNetProfitReady && currentLucroLiquidoValue !== null;
  const displayedFaturamentoValue = faturamentoReady
    ? currentFaturamentoValue
    : displayedHeroValues.faturamento;
  const displayedLucroLiquidoValue = lucroLiquidoReady
    ? currentLucroLiquidoValue
    : displayedHeroValues.lucroLiquido;

  /* eslint-disable react-hooks/set-state-in-effect -- stores only stable data, never animation frames. */
  useEffect(() => {
    if (!faturamentoReady && !lucroLiquidoReady) return;
    setDisplayedHeroValues((current) => {
      const next = {
        faturamento: faturamentoReady ? currentFaturamentoValue : current.faturamento,
        lucroLiquido: lucroLiquidoReady ? currentLucroLiquidoValue : current.lucroLiquido,
      };
      return next.faturamento === current.faturamento && next.lucroLiquido === current.lucroLiquido
        ? current
        : next;
    });
  }, [currentFaturamentoValue, currentLucroLiquidoValue, faturamentoReady, lucroLiquidoReady]);
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
  const handleOpenFaturamento = () => {
    triggerLightImpactHaptic();
    router.push({
      pathname: '/faturamento-mensal',
      params: { period: displayedPeriod },
    });
  };

  const handleOpenLucroLiquido = () => {
    triggerLightImpactHaptic();
    router.push({
      pathname: '/lucro-liquido-mensal',
      params: { period: displayedPeriod },
    });
  };

  const renderFinanceToolbarItems = useCallback(
    () =>
      renderFinancePeriodToolbarItems({
        composition: 'combined',
        onMonthChange: setSelectedMonth,
        onYearChange: setSelectedYear,
        selectedMonth: displayedMonth,
        selectedYear: displayedYear,
      }),
    [displayedMonth, displayedYear],
  );

  useEffect(() => {
    activeTabStore.setFinanceToolbar(renderFinanceToolbarItems());
    return () => {
      activeTabStore.setFinanceToolbar(null);
    };
  }, [renderFinanceToolbarItems]);

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
      <View style={styles.header}>{header}</View>
      <PremiumCard
        accessibilityLabel="Abrir detalhes do faturamento"
        onPress={handleOpenFaturamento}
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
            <Ionicons
              color={theme.colors.textSecondary}
              name="chevron-forward-outline"
              size={theme.sizes.iconSmall}
            />
          </View>
          <FinancialTrendIndicator
            comparison={comparison?.faturamento}
            visible={comparison !== undefined}
          />
        </View>
        <NativeAnimatedNumber
          animationEnabled={faturamentoReady}
          color={theme.colors.textPrimary}
          text={displayedFaturamentoValue !== null ? formatCurrency(displayedFaturamentoValue) : ''}
          value={displayedFaturamentoValue}
        />
      </PremiumCard>
      <PremiumCard
        accessibilityLabel="Abrir detalhes do lucro líquido"
        onPress={handleOpenLucroLiquido}
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
            <Ionicons
              color={theme.colors.textSecondary}
              name="chevron-forward-outline"
              size={theme.sizes.iconSmall}
            />
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
            displayedLucroLiquidoValue !== null ? formatCurrency(displayedLucroLiquidoValue) : ''
          }
          value={displayedLucroLiquidoValue}
        />
      </PremiumCard>
      <SummaryCard
        rows={[
          { label: 'Baldes vendidos', value: summary ? String(summary.quantidadeBaldes) : '' },
          { label: 'Lucro bruto', value: summary ? formatCurrency(summary.lucroBruto) : '' },
          { label: 'Recebido', value: summary ? formatCurrency(summary.valoresPagos) : '' },
          { label: 'A receber', value: summary ? formatCurrency(summary.valoresPendentes) : '' },
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
          { label: 'A receber', value: summary ? formatCurrency(summary.valoresPendentes) : '' },
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
            value: isNetProfitReady && summary ? formatCurrency(summary.lucroLiquidoPorBalde) : '',
          },
          {
            label: 'Custo p/ balde',
            value: isNetProfitReady && summary ? formatCurrency(summary.custoMedioBalde) : '',
          },
        ]}
        style={{ backgroundColor: financeCardSurface }}
        title="POR BALDE"
      />
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

function isMonthlyPeriod(value: string | undefined): value is string {
  return value !== undefined && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function parsePeriodKey(value: string): { month: number; year: number } {
  const [year, month] = value.split('-').map(Number);
  return { month, year };
}

const styles = StyleSheet.create({
  content: { gap: 24 },
  header: { minHeight: 44 },
  heroCard: { gap: 8, padding: 24 },
  heroHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  heroTitle: { alignItems: 'center', flexDirection: 'row', gap: 4 },
});
