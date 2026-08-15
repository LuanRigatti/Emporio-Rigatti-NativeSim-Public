import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { NativeAnimatedNumber, NativePeriodActionGroup } from '@/components/native';
import { PremiumCard, PremiumScreen, SummaryCard } from '@/components/premium';
import {
  HISTORY_MONTH_ITEMS,
  getHistoryYearItems,
} from '@/features/history/components/periodOptions';
import { getCurrentHistoryPeriod } from '@/features/history/utils/historyDateUtils';
import { useFinancialData } from '@/hooks/useFinancialData';
import { expenseQueryForFinancialSelection } from '@/services/costs';
import { financialCalculationService } from '@/services/finance';
import { routeTrackingRepository, summarizeRouteKilometersByDate } from '@/services/routes';
import type { RouteTrackingSession } from '@/types/routeTracking';
import { useAppTheme } from '@/theme';

function PreviewIcon({
  color,
  name,
}: {
  color: string;
  name: ComponentProps<typeof Ionicons>['name'];
}) {
  const { theme } = useAppTheme();
  return <Ionicons color={color} name={name} size={theme.sizes.iconMedium} />;
}

function monthShortLabel(month: number): string {
  return (
    ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][
      month - 1
    ] ?? String(month)
  );
}

function trendIcon(difference: number | undefined): ComponentProps<typeof Ionicons>['name'] {
  if (difference === undefined || difference === 0) return 'remove-outline';
  return difference > 0 ? 'trending-up' : 'trending-down';
}

export default function PrototypeFinanceiro() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const isFocused = useIsFocused();
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentHistoryPeriod().month);
  const [selectedYear, setSelectedYear] = useState(() => getCurrentHistoryPeriod().year);
  const [routeSessions, setRouteSessions] = useState<RouteTrackingSession[]>([]);
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
          if (active) setRouteSessions(sessions);
        })
        .catch(() => {
          if (active) setRouteSessions([]);
        });

      return () => {
        active = false;
      };
    }, []),
  );

  const automaticKilometersByDate = useMemo(
    () => summarizeRouteKilometersByDate(routeSessions),
    [routeSessions],
  );

  const summary = useMemo(
    () =>
      snapshot
        ? financialCalculationService.calculateResumo({
            deliveries: snapshot.entregas,
            dailyExpenses: snapshot.gastosDiarios,
            filters: { mesSelecionado: selectedPeriod, periodo: 'mes' },
            monthlyExpenses: snapshot.gastosMensais,
            automaticKilometersByDate,
          })
        : undefined,
    [automaticKilometersByDate, selectedPeriod, snapshot],
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
          })
        : undefined,
    [automaticKilometersByDate, comparisonSnapshot, selectedPeriod, snapshot],
  );

  const trendColor = (difference: number | undefined) =>
    difference === undefined || difference === 0
      ? theme.colors.textSecondary
      : difference > 0
        ? theme.colors.success
        : theme.colors.danger;

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
      titleStyle={{ fontFamily: 'System', marginLeft: -(theme.spacing.xxs * 2) }}
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

  return (
    <PremiumScreen
      contentContainerStyle={[styles.content, { marginTop: 0 }]}
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
        accessibilityLabel="Abrir detalhes do faturamento mensal"
        onPress={() => router.push('/faturamento-mensal')}
        style={[styles.heroCard, { borderRadius: theme.radius.xl + theme.spacing.sm }]}
      >
        <View style={styles.heroHeader}>
          <View style={styles.heroTitle}>
            <Text style={[theme.typography.caption, { color: theme.colors.textPrimary }]}>
              FATURAMENTO MENSAL
            </Text>
            <Ionicons
              color={theme.colors.textSecondary}
              name="chevron-forward-outline"
              size={theme.sizes.iconSmall}
            />
          </View>
          <PreviewIcon
            color={trendColor(comparison?.faturamento.diferenca)}
            name={trendIcon(comparison?.faturamento.diferenca)}
          />
        </View>
        <NativeAnimatedNumber
          animationEnabled={!loading && !refreshing}
          color={theme.colors.textPrimary}
          text={summary ? formatCurrency(summary.faturamento) : ''}
          value={summary?.faturamento ?? null}
        />
      </PremiumCard>
      <PremiumCard
        accessibilityLabel="Abrir detalhes do lucro líquido mensal"
        onPress={() => router.push('/lucro-liquido-mensal')}
        style={[styles.heroCard, { borderRadius: theme.radius.xl + theme.spacing.sm }]}
      >
        <View style={styles.heroHeader}>
          <View style={styles.heroTitle}>
            <Text style={[theme.typography.caption, { color: theme.colors.textPrimary }]}>
              LUCRO LÍQUIDO MENSAL
            </Text>
            <Ionicons
              color={theme.colors.textSecondary}
              name="chevron-forward-outline"
              size={theme.sizes.iconSmall}
            />
          </View>
          <PreviewIcon
            color={trendColor(comparison?.lucroLiquido.diferenca)}
            name={trendIcon(comparison?.lucroLiquido.diferenca)}
          />
        </View>
        <NativeAnimatedNumber
          animationEnabled={!loading && !refreshing}
          color={theme.colors.textPrimary}
          text={summary ? formatCurrency(summary.lucroLiquido) : ''}
          value={summary?.lucroLiquido ?? null}
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
            value: summary ? formatCurrency(summary.custoCombustivel) : '',
          },
          { label: 'Outros', value: summary ? formatCurrency(summary.custoOutros) : '' },
          { label: 'Luz do período', value: summary ? formatCurrency(summary.custoLuz) : '' },
          {
            label: 'Custo médio de entrega',
            value: summary ? formatCurrency(summary.custoMedioCombustivelPorEntrega) : '',
          },
        ]}
        title="CUSTOS"
      />
      <SummaryCard
        rows={[
          { label: 'Recebido', value: summary ? formatCurrency(summary.valoresPagos) : '' },
          { label: 'A receber', value: summary ? formatCurrency(summary.valoresPendentes) : '' },
          { label: 'Margem bruta', value: summary ? `${summary.margemBruta.toFixed(1)}%` : '' },
          { label: 'Margem líquida', value: summary ? `${summary.margemLiquida.toFixed(1)}%` : '' },
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
            value: summary ? formatCurrency(summary.lucroLiquidoPorBalde) : '',
          },
          {
            label: 'Custo p/ balde',
            value: summary ? formatCurrency(summary.custoMedioBalde) : '',
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
