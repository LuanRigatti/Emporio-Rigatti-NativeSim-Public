import type { ComponentProps } from 'react';
import { useState } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import HistorySymbolIcon from '@/features/history/components/HistorySymbolIcon';
import type { FinancialComparison } from '@/types/data';
import { useAppTheme } from '@/theme';
import { formatTrendPercentage } from '../utils/financialTrendUtils';

export type FinancialTrendIndicatorProps = {
  comparison?: FinancialComparison;
  visible?: boolean;
};

export { formatTrendPercentage };

export function FinancialTrendIndicator({
  comparison,
  visible = true,
}: FinancialTrendIndicatorProps) {
  const { theme } = useAppTheme();
  const [cachedComparison, setCachedComparison] = useState<FinancialComparison | undefined>(
    comparison,
  );
  const [prevComparison, setPrevComparison] = useState(comparison);

  if (comparison !== prevComparison) {
    setPrevComparison(comparison);
    if (comparison !== undefined) {
      setCachedComparison(comparison);
    }
  }

  const effectiveComparison = comparison ?? cachedComparison;
  const isReady = visible && effectiveComparison !== undefined;
  const difference = effectiveComparison?.diferenca ?? 0;
  const isPositive = difference > 0;
  const isNegative = difference < 0;
  const trendColors = isPositive
    ? { background: theme.colors.successSurface, foreground: theme.colors.success }
    : isNegative
      ? { background: theme.colors.dangerSurface, foreground: theme.colors.danger }
      : { background: 'transparent', foreground: theme.colors.textPrimary };

  const systemName = isPositive ? 'arrow.up.right' : isNegative ? 'arrow.down.right' : 'minus';

  const fallbackIcon: ComponentProps<typeof Ionicons>['name'] = isPositive
    ? 'trending-up'
    : isNegative
      ? 'trending-down'
      : 'remove-outline';

  const percentageText = isReady
    ? formatTrendPercentage(effectiveComparison?.percentual)
    : '\u00a0';

  return (
    <View
      accessibilityLabel={
        isReady
          ? `Tendência: ${isPositive ? 'alta de' : isNegative ? 'queda de' : 'estável em'} ${percentageText}`
          : undefined
      }
      style={[
        styles.container,
        {
          backgroundColor: trendColors.background,
          borderRadius: theme.radius.pill,
          opacity: isReady ? 1 : 0,
          paddingHorizontal: theme.spacing.xs,
          paddingVertical: theme.spacing.xxs,
        },
      ]}
    >
      <HistorySymbolIcon
        color={trendColors.foreground}
        fallbackIcon={fallbackIcon}
        size={9.5}
        systemName={systemName}
      />
      <Text style={[styles.text, { color: trendColors.foreground }]}>{percentageText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 2,
  },
  text: {
    fontSize: 10.5,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
