import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import type { ComponentProps } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { NativePeriodActionGroup } from '@/components/native';
import { PremiumCard, PremiumScreen, SummaryCard } from '@/components/premium';
import {
  HISTORY_MONTH_ITEMS,
  getHistoryYearItems,
} from '@/features/history/components/periodOptions';
import { getCurrentHistoryPeriod } from '@/features/history/utils/historyDateUtils';
import { useAppData } from '@/hooks/useAppData';
import { financialCalculationService } from '@/services/finance';
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

export default function PrototypeFinanceiro() {
  const { theme } = useAppTheme();
  const { refresh, snapshot } = useAppData();
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentHistoryPeriod().month);
  const [selectedYear, setSelectedYear] = useState(() => getCurrentHistoryPeriod().year);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const selectedPeriod = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const summary = useMemo(
    () =>
      snapshot
        ? financialCalculationService.calculateResumo({
            deliveries: snapshot.entregas,
            dailyExpenses: snapshot.gastosDiarios,
            filters: { mesSelecionado: selectedPeriod, periodo: 'mes' },
            monthlyExpenses: snapshot.gastosMensais,
          })
        : undefined,
    [selectedPeriod, snapshot],
  );

  const header = (
    <NativeGlassHeader
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
      mode="transparent"
      titleStyle={{ transform: [{ translateX: theme.spacing.lg + theme.spacing.xs }] }}
      title="Finanças"
    />
  );

  return (
    <PremiumScreen
      contentContainerStyle={styles.content}
      overlayHeader={header}
      overlayHeaderContentOffset={
        theme.typography.headline.lineHeight +
        theme.spacing.xl -
        theme.sizes.touchTargetMinimum +
        theme.spacing.xxs * 8
      }
      progressiveBlur
    >
      <PremiumCard style={[styles.heroCard, { borderRadius: theme.radius.xl + theme.spacing.sm }]}>
        <View style={styles.heroHeader}>
          <Text style={[theme.typography.caption, { color: theme.colors.textPrimary }]}>
            FATURAMENTO MENSAL
          </Text>
          <PreviewIcon color={theme.colors.revenue} name="trending-up" />
        </View>
        <Text style={[theme.typography.metricLarge, { color: theme.colors.textPrimary }]}>
          {formatCurrency(summary?.faturamento ?? 0)}
        </Text>
      </PremiumCard>
      <PremiumCard style={[styles.heroCard, { borderRadius: theme.radius.xl + theme.spacing.sm }]}>
        <View style={styles.heroHeader}>
          <Text style={[theme.typography.caption, { color: theme.colors.textPrimary }]}>
            LUCRO LÍQUIDO MENSAL
          </Text>
          <PreviewIcon color={theme.colors.profit} name="trending-up" />
        </View>
        <Text style={[theme.typography.metricLarge, { color: theme.colors.textPrimary }]}>
          {formatCurrency(summary?.lucroLiquido ?? 0)}
        </Text>
      </PremiumCard>
      <SummaryCard
        rows={[
          { label: 'Baldes vendidos', value: String(summary?.quantidadeBaldes ?? 0) },
          { label: 'Lucro bruto', value: formatCurrency(summary?.lucroBruto ?? 0) },
          { label: 'Recebido', value: formatCurrency(summary?.valoresPagos ?? 0) },
          { label: 'A receber', value: formatCurrency(summary?.valoresPendentes ?? 0) },
        ]}
        title="OPERAÇÃO"
      />
      <SummaryCard
        rows={[
          { label: 'Custo dos baldes', value: formatCurrency(summary?.custoTotalBaldes ?? 0) },
          { label: 'Custo combustível', value: formatCurrency(summary?.custoCombustivel ?? 0) },
          { label: 'Outros', value: formatCurrency(summary?.custoOutros ?? 0) },
          { label: 'Luz do período', value: formatCurrency(summary?.custoLuz ?? 0) },
          {
            label: 'Custo médio de entrega',
            value: formatCurrency(summary?.custoMedioCombustivelPorEntrega ?? 0),
          },
        ]}
        title="CUSTOS"
      />
      <SummaryCard
        rows={[
          { label: 'Recebido', value: formatCurrency(summary?.valoresPagos ?? 0) },
          { label: 'A receber', value: formatCurrency(summary?.valoresPendentes ?? 0) },
          { label: 'Margem bruta', value: `${(summary?.margemBruta ?? 0).toFixed(1)}%` },
          { label: 'Margem líquida', value: `${(summary?.margemLiquida ?? 0).toFixed(1)}%` },
        ]}
        title="RECEBIDO/MARGENS"
      />
      <SummaryCard
        rows={[
          { label: 'Venda p/ balde', value: formatCurrency(summary?.precoMedioBalde ?? 0) },
          { label: 'Lucro p/ balde', value: formatCurrency(summary?.lucroLiquidoPorBalde ?? 0) },
          { label: 'Custo p/ balde', value: formatCurrency(summary?.custoMedioBalde ?? 0) },
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
  heroCard: { gap: 8, padding: 24 },
  heroHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
