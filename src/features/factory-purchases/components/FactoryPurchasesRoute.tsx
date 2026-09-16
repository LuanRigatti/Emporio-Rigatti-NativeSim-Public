import { useRouter } from 'expo-router';
import { useState } from 'react';

import { NativeGlassHeader } from '@/components/layout';
import { NativeGlassBackButton, NativePeriodActionGroup } from '@/components/native';
import { FinancePeriodToolbar } from '@/features/finance';
import {
  HISTORY_MONTH_ITEMS,
  getHistoryYearItems,
} from '@/features/history/components/periodOptions';
import { getCurrentHistoryPeriod } from '@/features/history/utils/historyDateUtils';
import { getLiquidGlassTint, useAppTheme } from '@/theme';

import { FactoryPurchasesScreen } from './FactoryPurchasesScreen';

export function FactoryPurchasesRoute({
  nativeHeader = false,
  showLargeTitle = false,
}: { nativeHeader?: boolean; showLargeTitle?: boolean } = {}) {
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
        nativeHeader ? undefined : (
          <NativeGlassBackButton
            accessibilityLabel="Voltar para Fábrica"
            color={theme.colors.textPrimary}
            containerSize={theme.sizes.touchTargetMinimum}
            onPress={() => router.back()}
            size={theme.sizes.iconMedium}
          />
        )
      }
      mode="transparent"
      rightActions={
        nativeHeader ? undefined : (
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
        )
      }
      titleStyle={{
        transform: [{ translateX: theme.spacing.lg + theme.spacing.sm + theme.spacing.xxs / 2 }],
      }}
      title=""
    />
  );
  const pageTitle = showLargeTitle ? (
    <NativeGlassHeader
      includeTopSafeArea={false}
      largeTitle
      mode="transparent"
      title="Fábrica"
      titleStyle={{
        fontFamily: 'System',
        fontSize: 36,
        fontWeight: '700',
        marginLeft: -(theme.spacing.xxs * 2),
      }}
    />
  ) : undefined;

  return (
    <>
      {nativeHeader ? (
        <FinancePeriodToolbar
          composition="combined"
          onMonthChange={setSelectedMonth}
          onYearChange={setSelectedYear}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
        />
      ) : null}
      <FactoryPurchasesScreen
        header={header}
        mode="purchases"
        pageTitle={pageTitle}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
      />
    </>
  );
}
