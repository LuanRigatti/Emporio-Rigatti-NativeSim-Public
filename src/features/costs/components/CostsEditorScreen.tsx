import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import {
  NativeDatePicker,
  NativeGlassBackButton,
  NativePeriodActionGroup,
} from '@/components/native';
import type { NativeDropdownItem } from '@/components/native';
import { GlassCard, PremiumScreen } from '@/components/premium';
import { useCostSettings } from '@/hooks/useCostSettings';
import { expenseCalculationService } from '@/services/expenses';
import { useAppTheme } from '@/theme';
import { normalizeMoney, todayIso } from '@/utils/data';

import { CostField } from './CostField';

const HEADER_ACTION_WIDTH = 152;

export type CostsEditorMode = 'daily' | 'monthly';

type CostsEditorScreenProps = {
  mode: CostsEditorMode;
};

export function CostsEditorScreen({ mode }: CostsEditorScreenProps) {
  const { theme } = useAppTheme();
  const router = useRouter();
  const { getMonthlySum, getValues, updateField } = useCostSettings();
  const initialDate = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState(() => todayIso(initialDate));
  const [selectedMonth, setSelectedMonth] = useState(() => initialDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(() => initialDate.getFullYear());
  const monthItems = useMemo(() => createMonthItems(), []);
  const yearItems = useMemo(() => createYearItems(), []);
  const date = parseIsoDate(selectedDate);
  const monthKey = `${selectedYear}-${pad(selectedMonth)}`;
  const period = mode === 'monthly' ? 'month' : 'day';
  const periodKey = mode === 'monthly' ? monthKey : selectedDate;
  const values = getValues(period, periodKey);
  const monthlyEstar = getMonthlySum(selectedYear, selectedMonth, 'estar');
  const monthlyOther = getMonthlySum(selectedYear, selectedMonth, 'other');
  const dailyFuelCost = expenseCalculationService.calculateFuelCost(selectedDate, {
    data: selectedDate,
    gasolina: 0,
    km: normalizeMoney(values.kilometers) ?? 0,
    precoGasolina: normalizeMoney(values.fuelPrice) ?? 0,
  });

  const header = (
    <NativeGlassHeader
      leftActions={
        <View style={styles.headerSlot}>
          <NativeGlassBackButton
            accessibilityLabel="Voltar para Custos"
            color={theme.colors.textPrimary}
            containerSize={theme.sizes.touchTargetMinimum}
            onPress={() => router.back()}
            size={theme.sizes.iconMedium}
          />
        </View>
      }
      mode="transparent"
      rightActions={
        mode === 'monthly' ? (
          <NativePeriodActionGroup
            color={theme.colors.textPrimary}
            monthDisplayValue={monthShortLabel(selectedMonth)}
            monthItems={monthItems}
            onMonthChange={(month) => {
              setSelectedMonth(month);
            }}
            onYearChange={(year) => {
              setSelectedYear(year);
            }}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            showValues
            valueFontSize={17}
            yearItems={yearItems}
          />
        ) : (
          <NativeDatePicker
            accessibilityLabel="Selecionar data"
            mode="date"
            onChange={(nextDate) => setSelectedDate(todayIso(nextDate))}
            style="compact"
            value={date}
          />
        )
      }
      title=""
    />
  );

  return (
    <PremiumScreen contentContainerStyle={styles.content} overlayHeader={header} progressiveBlur>
      <GlassCard style={[styles.card, { marginTop: theme.spacing.md }]}>
        {mode === 'monthly' ? (
          <>
            <CostField
              keyboardType="decimal-pad"
              label="Luz"
              onChangeText={(value) => updateField('month', monthKey, 'light', value)}
              placeholder="R$ 0,00"
              value={values.light}
            />
            <ReadOnlyCostField label="Estar" value={formatCurrency(monthlyEstar)} />
            <ReadOnlyCostField label="Outros" value={formatCurrency(monthlyOther)} />
          </>
        ) : (
          <>
            <CostField
              keyboardType="decimal-pad"
              label="Estar"
              onChangeText={(value) => updateField('day', selectedDate, 'estar', value)}
              placeholder="R$ 0,00"
              value={values.estar}
            />
            <CostField
              keyboardType="decimal-pad"
              label="Outros"
              onChangeText={(value) => updateField('day', selectedDate, 'other', value)}
              placeholder="R$ 0,00"
              value={values.other}
            />
            <CostField
              keyboardType="decimal-pad"
              label="Km"
              onChangeText={(value) => updateField('day', selectedDate, 'kilometers', value)}
              placeholder="0,0 km"
              value={values.kilometers}
            />
            <CostField
              keyboardType="decimal-pad"
              label="Preço da gasolina"
              onChangeText={(value) => updateField('day', selectedDate, 'fuelPrice', value)}
              placeholder="R$ 0,00 por litro"
              value={values.fuelPrice}
            />
            <ReadOnlyCostField label="Custo do combustível" value={formatCurrency(dailyFuelCost)} />
          </>
        )}
      </GlassCard>
    </PremiumScreen>
  );
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function monthLabel(month: number): string {
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(
    new Date(2026, month - 1, 1),
  );
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

function monthShortLabel(month: number): string {
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(
    new Date(2026, month - 1, 1),
  );
  const normalized = label.replace('.', '');
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
}

function createMonthItems(): readonly NativeDropdownItem<number>[] {
  return Array.from({ length: 12 }, (_, index) => ({
    label: monthLabel(index + 1),
    value: index + 1,
  }));
}

function createYearItems(): readonly NativeDropdownItem<number>[] {
  return [2024, 2025, 2026].map((year) => ({ label: String(year), value: year }));
}

function ReadOnlyCostField({ label, value }: { label: string; value: string }) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.readOnlyField}>
      <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
        {label}
      </Text>
      <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    currency: 'BRL',
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(value);
}

const styles = StyleSheet.create({
  card: { gap: 20 },
  content: { flexGrow: 1, gap: 16 },
  headerSlot: { width: HEADER_ACTION_WIDTH },
  readOnlyField: { gap: 8 },
});
