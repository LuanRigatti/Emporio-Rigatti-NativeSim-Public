import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  NativeGlassBackButton,
  NativePeriodActionGroup,
  NativeTextField,
} from '@/components/native';
import { NativeGlassHeader } from '@/components/layout';
import { GlassCard, PremiumScreen } from '@/components/premium';
import {
  HISTORY_MONTH_ITEMS,
  getHistoryYearItems,
} from '@/features/history/components/periodOptions';
import { getCurrentHistoryPeriod } from '@/features/history/utils/historyDateUtils';
import { useStockSettings } from '@/hooks/useStockSettings';
import { useAppData } from '@/hooks/useAppData';
import { createStockPeriodKey, stockCalculationService } from '@/services/stock';
import { useAppTheme } from '@/theme';

function parseBucketQuantity(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

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
  const { getValues, updateField } = useStockSettings();
  const { refresh, snapshot } = useAppData();
  const currentPeriod = getCurrentHistoryPeriod();
  const [selectedMonth, setSelectedMonth] = useState(currentPeriod.month);
  const [selectedYear, setSelectedYear] = useState(currentPeriod.year);
  const deliveries = useMemo(() => snapshot?.entregas ?? [], [snapshot]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  const periodKey = createStockPeriodKey(selectedYear, selectedMonth);
  const periodSettings = getValues(periodKey);
  const soldBuckets = useMemo(
    () => stockCalculationService.calculateSoldBuckets(deliveries, selectedYear, selectedMonth),
    [deliveries, selectedMonth, selectedYear],
  );
  const initialBuckets = parseBucketQuantity(periodSettings.initialBuckets);
  const factoryPurchasedBuckets = useMemo(
    () =>
      stockCalculationService.calculateFactoryPurchasedBuckets(
        snapshot?.recebimentoBaldes ?? [],
        selectedYear,
        selectedMonth,
      ),
    [selectedMonth, selectedYear, snapshot?.recebimentoBaldes],
  );
  const purchasedBuckets =
    parseBucketQuantity(periodSettings.purchasedBuckets) + factoryPurchasedBuckets;
  const currentBuckets = stockCalculationService.calculateCurrentBuckets(
    initialBuckets,
    purchasedBuckets,
    soldBuckets,
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
      <GlassCard style={[styles.card, { marginTop: theme.spacing.md }]}>
        <StockField
          label="Estoque Inicial"
          onChangeText={(value) => updateField(periodKey, 'initialBuckets', value)}
          placeholder="Quantidade de baldes"
          value={periodSettings.initialBuckets}
        />
        <StockField
          label="Baldes Comprados"
          onChangeText={(value) => updateField(periodKey, 'purchasedBuckets', value)}
          placeholder="Quantidade de baldes"
          value={periodSettings.purchasedBuckets}
        />
      </GlassCard>

      <GlassCard style={styles.card}>
        <StockSummaryRow label="Baldes Vendidos" value={soldBuckets} />
        <StockSummaryRow label="Estoque Atual" value={currentBuckets} />
      </GlassCard>
    </PremiumScreen>
  );
}

function StockField({
  label,
  onChangeText,
  placeholder,
  value,
}: {
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.field}>
      <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
        {label}
      </Text>
      <NativeTextField
        accessibilityLabel={label}
        keyboardType="number-pad"
        onChangeText={onChangeText}
        placeholder={placeholder}
        value={value}
      />
    </View>
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

const styles = StyleSheet.create({
  content: { flexGrow: 1, gap: 16 },
  card: { gap: 20 },
  field: { gap: 8 },
  summaryRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
