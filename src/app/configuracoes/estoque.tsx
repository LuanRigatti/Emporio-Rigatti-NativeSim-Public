import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/providers';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { GlassCard, PremiumScreen } from '@/components/premium';
import { FinancePeriodToolbar } from '@/features/finance';
import { getCurrentHistoryPeriod } from '@/features/history/utils/historyDateUtils';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useFactorySettings } from '@/hooks/useFactorySettings';
import { useFactoryPurchases } from '@/hooks/useFactoryPurchases';
import {
  stockCalculationService,
  stockPeriodSnapshotCache,
  type StockPeriodSnapshotCacheEntry,
} from '@/services/stock';
import { useAppTheme } from '@/theme';
import { normalizeMoney } from '@/utils/data';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

function monthEnd(year: number, month: number): string {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

export default function StockRoute() {
  const { user } = useAuth();
  const { theme } = useAppTheme();
  const currentPeriod = getCurrentHistoryPeriod();
  const [selectedMonth, setSelectedMonth] = useState(currentPeriod.month);
  const [selectedYear, setSelectedYear] = useState(currentPeriod.year);
  const periodEnd = useMemo(
    () => monthEnd(selectedYear, selectedMonth),
    [selectedMonth, selectedYear],
  );
  const periodKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const [cachedStockState, setCachedStockState] = useState<{
    entry: StockPeriodSnapshotCacheEntry | null;
    period: string;
  }>(() => ({
    entry: user?.id ? stockPeriodSnapshotCache.getMemory(user.id, periodKey) : null,
    period: periodKey,
  }));
  const cachedStock = cachedStockState.period === periodKey ? cachedStockState.entry : null;
  const { isHydrated: factorySettingsHydrated, settings: factorySettings } = useFactorySettings();
  const {
    allDeliveries,
    loading: deliveriesLoading,
    reload: refreshDeliveries,
  } = useDeliveries({
    endDate: periodEnd,
    mode: 'all',
  });
  const {
    loading: purchasesLoading,
    receipts,
    refresh: refreshPurchases,
  } = useFactoryPurchases({
    endDate: periodEnd,
    period: 'all',
  });
  useEffect(() => {
    let active = true;
    if (!user?.id) {
      return () => undefined;
    }

    void stockPeriodSnapshotCache.read(user.id, periodKey).then((entry) => {
      if (active) setCachedStockState({ entry, period: periodKey });
    });
    return () => {
      active = false;
    };
  }, [periodKey, user?.id]);
  const hasFocused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!hasFocused.current) {
        hasFocused.current = true;
        return undefined;
      }
      void refreshDeliveries();
      void refreshPurchases();
      return undefined;
    }, [refreshDeliveries, refreshPurchases]),
  );
  const calculatedStockSummary = useMemo(
    () =>
      stockCalculationService.calculate({
        deliveries: allDeliveries,
        month: selectedMonth,
        receipts,
        year: selectedYear,
      }),
    [allDeliveries, receipts, selectedMonth, selectedYear],
  );
  const bucketCost = normalizeMoney(factorySettings.bucketCost) ?? 0;
  const cacheMatchesSettings =
    cachedStock === null || !factorySettingsHydrated || cachedStock.bucketCost === bucketCost;
  const sourcesReady = !deliveriesLoading && !purchasesLoading && factorySettingsHydrated;
  const stockSummary = sourcesReady
    ? calculatedStockSummary
    : cacheMatchesSettings
      ? (cachedStock?.summary ?? null)
      : null;
  const stockValue = stockSummary
    ? sourcesReady
      ? stockCalculationService.calculateStockValue(stockSummary.endingBuckets, bucketCost)
      : (cachedStock?.stockValue ?? null)
    : null;

  useEffect(() => {
    if (!user?.id || !sourcesReady) return;
    const value = stockCalculationService.calculateStockValue(
      calculatedStockSummary.endingBuckets,
      bucketCost,
    );
    void stockPeriodSnapshotCache
      .write(user.id, periodKey, calculatedStockSummary, bucketCost, value)
      .catch(() => undefined);
  }, [bucketCost, calculatedStockSummary, periodKey, sourcesReady, user?.id]);

  const header = <NativeGlassHeader mode="transparent" title="Estoque" />;

  return (
    <>
      <FinancePeriodToolbar
        composition="combined"
        onMonthChange={setSelectedMonth}
        onYearChange={setSelectedYear}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
      />
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
          <StockSummaryRow label="Saldo anterior" value={stockSummary?.openingBuckets ?? null} />
          <StockSummaryRow
            label="Baldes Comprados"
            value={stockSummary?.purchasedBuckets ?? null}
          />
          <StockSummaryRow label="Baldes Vendidos" value={stockSummary?.deliveredBuckets ?? null} />
          <StockSummaryRow label="Estoque Atual" value={stockSummary?.endingBuckets ?? null} />
          <StockValueRow label="Valor do estoque" value={stockValue} />
        </GlassCard>
      </PremiumScreen>
    </>
  );
}

function StockSummaryRow({ label, value }: { label: string; value: number | null }) {
  const { theme } = useAppTheme();
  const { quantity: maskQuantity } = useTestModePresentation();

  return (
    <View style={styles.summaryRow}>
      <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>{label}</Text>
      <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
        {value === null ? '' : maskQuantity(value)}
      </Text>
    </View>
  );
}

function StockValueRow({ label, value }: { label: string; value: number | null }) {
  const { theme } = useAppTheme();
  const { currency: maskCurrency } = useTestModePresentation();

  return (
    <View style={styles.summaryRow}>
      <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>{label}</Text>
      <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
        {value === null ? '' : maskCurrency(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, gap: 16 },
  card: { gap: 20 },
  summaryRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
