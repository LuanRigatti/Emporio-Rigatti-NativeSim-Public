import { useRouter } from 'expo-router';
import { useState } from 'react';

import { NativeGlassHeader } from '@/components/layout';
import { NativeGlassBackButton, NativePeriodActionGroup } from '@/components/native';
import {
  HISTORY_MONTH_ITEMS,
  getHistoryYearItems,
} from '@/features/history/components/periodOptions';
import { getCurrentHistoryPeriod } from '@/features/history/utils/historyDateUtils';
import { FactoryPurchasesScreen } from '@/features/factory-purchases/components/FactoryPurchasesScreen';
import { getLiquidGlassTint, useAppTheme } from '@/theme';

export default function FactoryPurchasesRoute() {
  const { resolvedMode, theme } = useAppTheme();
  const router = useRouter();
  const currentPeriod = getCurrentHistoryPeriod();
  const [selectedMonth, setSelectedMonth] = useState(currentPeriod.month);
  const [selectedYear, setSelectedYear] = useState(currentPeriod.year);
  const monthDisplayValue =
    ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][
      selectedMonth - 1
    ] ?? String(selectedMonth);

  const header = (
    <NativeGlassHeader
      leftActions={
        <NativeGlassBackButton
          accessibilityLabel="Voltar para Fábrica"
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
          glassTint={getLiquidGlassTint(resolvedMode)}
          monthDisplayValue={monthDisplayValue}
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
      titleStyle={{
        transform: [{ translateX: theme.spacing.lg + theme.spacing.sm + theme.spacing.xxs / 2 }],
      }}
      title=""
    />
  );

  return (
    <FactoryPurchasesScreen
      header={header}
      mode="purchases"
      selectedMonth={selectedMonth}
      selectedYear={selectedYear}
    />
  );
}
