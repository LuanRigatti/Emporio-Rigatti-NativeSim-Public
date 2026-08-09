import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassBackButton, NativePeriodActionGroup } from '@/components/native';
import { NativeGlassHeader } from '@/components/layout';
import { GlassCard, PremiumScreen } from '@/components/premium';
import {
  HISTORY_MONTH_ITEMS,
  getHistoryYearItems,
} from '@/features/history/components/periodOptions';
import { getCurrentHistoryPeriod } from '@/features/history/utils/historyDateUtils';
import { useAppData } from '@/hooks/useAppData';
import { useFactorySettings } from '@/hooks/useFactorySettings';
import { useFactoryPurchases } from '@/hooks/useFactoryPurchases';
import { stockCalculationService } from '@/services/stock';
import { useAppTheme } from '@/theme';
import { formatCurrency, normalizeMoney } from '@/utils/data';

function monthShortLabel(month: number): string {
  const labels = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ];
  return labels[month - 1] ?? String(month);
}

export default function StockRoute() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { settings: factorySettings } = useFactorySettings();
  const { receipts, refresh: refreshPurchases } = useFactoryPurchases();
  const { refresh, snapshot } = useAppData();
  const currentPeriod = getCurrentHistoryPeriod();
  const [selectedMonth, setSelectedMonth] = useState(currentPeriod.month);
  const [selectedYear, setSelectedYear] = useState(currentPeriod.year);
  const deliveries = useMemo(() => snapshot?.entregas ?? [], [snapshot]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
      void refreshPurchases();
    }, [refresh, refreshPurchases]),
  );
  const stockSummary = useMemo(
    () =>
      stockCalculationService.calculate({
        deliveries,
        month: selectedMonth,
        receipts,
        year: selectedYear,
      }),
    [deliveries, receipts, selectedMonth, selectedYear],
  );
  const bucketCost = normalizeMoney(factorySettings.bucketCost) ?? 0;
  const stockValue = stockCalculationService.calculateStockValue(
    stockSummary.endingBuckets,
    bucketCost,
  );

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
      title="Estoque"
    />
  );

  return (
    <PremiumScreen contentContainerStyle={styles.content} overlayHeader={header} progressiveBlur>
      <GlassCard
        style={[
          styles.card,
          {
            borderRadius: theme.radius.xl + theme.spacing.xs,
            marginTop: theme.spacing.md,
          },
        ]}
      >
        <StockSummaryRow label="Saldo anterior" value={stockSummary.openingBuckets} />
        <StockSummaryRow label="Baldes Comprados" value={stockSummary.purchasedBuckets} />
        <StockSummaryRow label="Baldes Vendidos" value={stockSummary.deliveredBuckets} />
        <StockSummaryRow label="Estoque Atual" value={stockSummary.endingBuckets} />
        <StockValueRow label="Valor do estoque" value={stockValue} />
      </GlassCard>
    </PremiumScreen>
  );
}

function StockSummaryRow({ label, value }: { label: string; value: number }) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.summaryRow}>
      <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>{label}</Text>
      <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
        {value} {value === 1 ? 'balde' : 'baldes'}
      </Text>
    </View>
  );
}

function StockValueRow({ label, value }: { label: string; value: number }) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.summaryRow}>
      <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>{label}</Text>
      <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
        {formatCurrency(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, gap: 16 },
  card: { gap: 20 },
  summaryRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
