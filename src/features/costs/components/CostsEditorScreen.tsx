import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import {
  NativeDatePicker,
  NativeDateToolbar,
  NativeDropdown,
  NativeGlassBackButton,
  NativePeriodActionGroup,
} from '@/components/native';
import type { NativeDropdownItem } from '@/components/native';
import { GlassCard, PremiumScreen } from '@/components/premium';
import { FinancePeriodToolbar } from '@/features/finance';
import { useCarSettings } from '@/hooks/useCarSettings';
import { useCostSettings } from '@/hooks/useCostSettings';
import { dailyDataQueryService } from '@/services/costs';
import { fuelCostCalculationService, type FuelType } from '@/services/expenses';
import type { RouteDistanceSummary } from '@/services/routes';
import { useAppTheme } from '@/theme';
import { normalizeMoney, todayIso } from '@/utils/data';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import { CostField } from './CostField';

const HEADER_ACTION_WIDTH = 152;

export type CostsEditorMode = 'daily' | 'monthly';

type CostsEditorScreenProps = {
  mode: CostsEditorMode;
  nativeHeader?: boolean;
};

export function CostsEditorScreen({ mode, nativeHeader = false }: CostsEditorScreenProps) {
  const { theme } = useAppTheme();
  const { enabled: testModeEnabled } = useTestModePresentation();
  const router = useRouter();
  const { getLatestDailyValue, getMonthlySum, getValues, isHydrated, updateField } =
    useCostSettings();
  const { settings: carSettings } = useCarSettings();
  const initialDate = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState(() => todayIso(initialDate));
  const [selectedMonth, setSelectedMonth] = useState(() => initialDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(() => initialDate.getFullYear());
  const [routeDistance, setRouteDistance] = useState<{
    date: string;
    summary: RouteDistanceSummary;
  } | null>(null);
  const monthItems = useMemo(() => createMonthItems(), []);
  const yearItems = useMemo(() => createYearItems(), []);
  const handleUpdateField = useCallback(
    (...args: Parameters<typeof updateField>) => {
      if (testModeEnabled) return;
      updateField(...args);
    },
    [testModeEnabled, updateField],
  );
  const date = parseIsoDate(selectedDate);
  const monthKey = `${selectedYear}-${pad(selectedMonth)}`;
  const period = mode === 'monthly' ? 'month' : 'day';
  const periodKey = mode === 'monthly' ? monthKey : selectedDate;
  const values = getValues(period, periodKey);
  const monthlyEstar = getMonthlySum(selectedYear, selectedMonth, 'estar');
  const monthlyOther = getMonthlySum(selectedYear, selectedMonth, 'other');
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      if (mode !== 'daily') {
        setRouteDistance(null);
        return () => {
          cancelled = true;
        };
      }

      setRouteDistance(null);
      void dailyDataQueryService.getRouteDistanceForDate(selectedDate).then((summary) => {
        if (!cancelled) setRouteDistance({ date: selectedDate, summary });
      });

      return () => {
        cancelled = true;
      };
    }, [mode, selectedDate]),
  );

  const routeSummary = routeDistance?.date === selectedDate ? routeDistance.summary : undefined;
  const totalKilometers =
    (normalizeMoney(values.kilometers) ?? 0) + (routeSummary?.totalKilometers ?? 0);
  const automaticKilometers =
    mode === 'daily' && routeSummary?.routeCount ? formatKilometers(totalKilometers) : undefined;
  const persistedFuelType = values.fuelType || getLatestDailyValue('fuelType');
  const fuelType: FuelType = persistedFuelType === 'etanol' ? 'etanol' : 'gasolina';
  const dailyFuelCost = fuelCostCalculationService.calculate({
    consumption: fuelCostCalculationService.fromCarSettings(carSettings),
    fuelPrice: normalizeMoney(values.fuelPrice) ?? 0,
    fuelType,
    kilometers: totalKilometers,
  });

  const header = (
    <NativeGlassHeader
      leftActions={
        nativeHeader ? undefined : (
          <View style={styles.headerSlot}>
            <NativeGlassBackButton
              accessibilityLabel="Voltar para Custos"
              color={theme.colors.textPrimary}
              containerSize={theme.sizes.touchTargetMinimum}
              onPress={() => router.back()}
              size={theme.sizes.iconMedium}
            />
          </View>
        )
      }
      mode="transparent"
      rightActions={
        !nativeHeader && mode === 'monthly' ? (
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
        ) : !nativeHeader ? (
          <NativeDatePicker
            accessibilityLabel="Selecionar data"
            mode="date"
            onChange={(nextDate) => setSelectedDate(todayIso(nextDate))}
            style="compact"
            value={date}
          />
        ) : undefined
      }
      title=""
    />
  );

  return (
    <>
      {nativeHeader ? (
        mode === 'monthly' ? (
          <FinancePeriodToolbar
            composition="combined"
            onMonthChange={setSelectedMonth}
            onYearChange={setSelectedYear}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
          />
        ) : (
          <NativeDateToolbar onDateChange={setSelectedDate} selectedDate={selectedDate} />
        )
      ) : null}
      <PremiumScreen
        contentContainerStyle={styles.content}
        overlayHeader={header}
        progressiveBlur
      >
        <GlassCard
          style={[
            styles.card,
            {
              borderRadius: theme.radius.xl + theme.spacing.sm,
              marginTop: theme.spacing.md,
            },
          ]}
        >
          {mode === 'monthly' ? (
            <>
              <CostField
                keyboardType="decimal-pad"
                label="Luz"
                onChangeText={(value) => handleUpdateField('month', monthKey, 'light', value)}
                placeholder="R$ 0,00"
                value={values.light}
              />
              <ReadOnlyCostField
                label="Estar"
                value={isHydrated ? formatCurrency(monthlyEstar) : ''}
              />
              <ReadOnlyCostField
                label="Outros"
                value={isHydrated ? formatCurrency(monthlyOther) : ''}
              />
            </>
          ) : (
            <>
              <CostField
                keyboardType="decimal-pad"
                label="Estar"
                onChangeText={(value) => handleUpdateField('day', selectedDate, 'estar', value)}
                placeholder="R$ 0,00"
                value={values.estar}
              />
              <CostField
                keyboardType="decimal-pad"
                label="Outros"
                onChangeText={(value) => handleUpdateField('day', selectedDate, 'other', value)}
                placeholder="R$ 0,00"
                value={values.other}
              />
              <CostField
                disabled={automaticKilometers !== undefined}
                keyboardType="decimal-pad"
                label="Km"
                onChangeText={(value) => handleUpdateField('day', selectedDate, 'kilometers', value)}
                placeholder="0,0 km"
                value={automaticKilometers ?? values.kilometers}
              />
              <CostField
                keyboardType="decimal-pad"
                label="Preço do combustível"
                onChangeText={(value) => handleUpdateField('day', selectedDate, 'fuelPrice', value)}
                placeholder="R$ 0,00 por litro"
                trailing={
                  <NativeDropdown
                    accessibilityLabel="Tipo de combustível"
                    color={theme.colors.textPrimary}
                    items={[
                      { label: 'Gasolina', value: 'gasolina' as const },
                      { label: 'Álcool', value: 'etanol' as const },
                    ]}
                    disabled={testModeEnabled}
                    onValueChange={(value) => handleUpdateField('day', selectedDate, 'fuelType', value)}
                    selectedValue={fuelType}
                    variant="glass"
                  />
                }
                value={values.fuelPrice}
              />
              <ReadOnlyCostField
                label="Custo do combustível"
                value={isHydrated ? formatCurrency(dailyFuelCost) : ''}
              />
            </>
          )}
        </GlassCard>
      </PremiumScreen>
    </>
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
  const { text: maskText } = useTestModePresentation();

  return (
    <View style={styles.readOnlyField}>
      <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
        {label}
      </Text>
      <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
        {maskText(value)}
      </Text>
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

function formatKilometers(value: number): string {
  return `${value.toLocaleString('pt-BR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 1,
  })} km`;
}

const styles = StyleSheet.create({
  card: { gap: 20 },
  content: { flexGrow: 1, gap: 16 },
  headerSlot: { width: HEADER_ACTION_WIDTH },
  readOnlyField: { gap: 8 },
});
