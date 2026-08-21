import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { NativeAnimatedNumber, NativePeriodActionGroup } from '@/components/native';
import { PremiumCard, PremiumScreen, SummaryCard } from '@/components/premium';
import { FinancialTrendIndicator } from '@/features/finance';
import {
  HISTORY_MONTH_ITEMS,
  getHistoryYearItems,
} from '@/features/history/components/periodOptions';
import { getCurrentHistoryPeriod } from '@/features/history/utils/historyDateUtils';
import { useFinancialData } from '@/hooks/useFinancialData';
import { useFinancialFuelCosts } from '@/hooks/useFinancialFuelCosts';
import { expenseQueryForFinancialSelection } from '@/services/costs';
import { financialCalculationService } from '@/services/finance';
import { routeTrackingRepository, summarizeRouteKilometersByDate } from '@/services/routes';
import type { RouteTrackingSession } from '@/types/routeTracking';
import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';

function monthShortLabel(month: number): string {
  return (
    ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][
      month - 1
    ] ?? String(month)
  );
}

export default function PrototypeFinanceiro() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const isFocused = useIsFocused();
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentHistoryPeriod().month);
  const [selectedYear, setSelectedYear] = useState(() => getCurrentHistoryPeriod().year);
  const initialRouteSessions = routeTrackingRepository.getMemoryRouteHistory();
  const [routeSessions, setRouteSessions] = useState<RouteTrackingSession[]>(
    () => initialRouteSessions ?? [],
  );
  const [routesLoaded, setRoutesLoaded] = useState(() => initialRouteSessions !== null);
  const selectedPeriod = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const { comparisonSnapshot, loading, refreshing, snapshot } = useFinancialData(
    expenseQueryForFinancialSelection({ kind: 'month', month: selectedPeriod }),
    { displayMonth: selectedPeriod, enabled: isFocused },
  );

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

  const isNetProfitReady = !loading && routesLoaded && fuelCostsReady;

  const summary = useMemo(
    () =>
      snapshot
        ? financialCalculationService.calculateResumo({
            deliveries: snapshot.entregas,
            dailyExpenses: snapshot.gastosDiarios,
            filters: { mesSelecionado: selectedPeriod, periodo: 'mes' },
            monthlyExpenses: snapshot.gastosMensais,
            automaticKilometersByDate,
            fuelCostByDate,
          })
        : undefined,
    [automaticKilometersByDate, fuelCostByDate, selectedPeriod, snapshot],
  );
  const comparison = useMemo(
    () =>
      snapshot
        ? financialCalculationService.compareByDeliveryDays({
            deliveries: comparisonSnapshot?.entregas ?? snapshot.entregas,
            dailyExpenses: comparisonSnapshot?.gastosDiarios ?? snapshot.gastosDiarios,
            filters: { mesSelecionado: selectedPeriod, periodo: 'mes' },
            monthlyExpenses: comparisonSnapshot?.gastosMensais ?? snapshot.gastosMensais,
            automaticKilometersByDate,
            fuelCostByDate,
          })
        : undefined,
    [automaticKilometersByDate, comparisonSnapshot, fuelCostByDate, selectedPeriod, snapshot],
  );

  const periodActions = (
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
  );

  const header = (
    <NativeGlassHeader
      includeTopSafeArea
      largeTitle
      mode="transparent"
      titleStyle={{
        fontFamily: 'System',
        fontSize: 32,
        fontWeight: '700',
        marginLeft: -(theme.spacing.xxs * 2),
      }}
      title="Finanças"
    />
  );
  const filterHeader = (
    <NativeGlassHeader
      includeTopSafeArea
      mode="transparent"
      rightActions={periodActions}
      title=""
    />
  );

  const handleOpenFaturamento = () => {
    triggerLightImpactHaptic();
    router.push({
      pathname: '/faturamento-mensal',
      params: { period: selectedPeriod },
    });
  };

  const handleOpenLucroLiquido = () => {
    triggerLightImpactHaptic();
    router.push({
      pathname: '/lucro-liquido-mensal',
      params: { period: selectedPeriod },
    });
  };

  return (
    <PremiumScreen
      contentContainerStyle={[styles.content, { marginTop: -theme.spacing.md }]}
      overlayHeader={filterHeader}
      overlayHeaderUnderlay
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
        style={[styles.heroCard, { borderRadius: theme.radius.xl + theme.spacing.sm }]}
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
          <FinancialTrendIndicator comparison={comparison?.faturamento} />
        </View>
        <NativeAnimatedNumber
          animationEnabled={!loading && !refreshing}
          color={theme.colors.textPrimary}
          text={summary ? formatCurrency(summary.faturamento) : ''}
          value={summary?.faturamento ?? null}
        />
      </PremiumCard>
      <PremiumCard
        accessibilityLabel="Abrir detalhes do lucro líquido"
        onPress={handleOpenLucroLiquido}
        style={[styles.heroCard, { borderRadius: theme.radius.xl + theme.spacing.sm }]}
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
          />
        </View>
        <NativeAnimatedNumber
          animationEnabled={isNetProfitReady && !refreshing}
          color={theme.colors.textPrimary}
          text={isNetProfitReady && summary ? formatCurrency(summary.lucroLiquido) : ''}
          value={isNetProfitReady && summary ? summary.lucroLiquido : null}
        />
      </PremiumCard>
      <SummaryCard
        rows={[
          { label: 'Baldes vendidos', value: summary ? String(summary.quantidadeBaldes) : '' },
          { label: 'Lucro bruto', value: summary ? formatCurrency(summary.lucroBruto) : '' },
          { label: 'Recebido', value: summary ? formatCurrency(summary.valoresPagos) : '' },
          { label: 'A receber', value: summary ? formatCurrency(summary.valoresPendentes) : '' },
        ]}
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

const styles = StyleSheet.create({
  content: { gap: 24 },
  header: { minHeight: 44 },
  heroCard: { gap: 8, padding: 24 },
  heroHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  heroTitle: { alignItems: 'center', flexDirection: 'row', gap: 4 },
});
