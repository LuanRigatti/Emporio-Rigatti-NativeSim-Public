import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown, FadeOutUp, LinearTransition } from 'react-native-reanimated';

import { NativeAnimatedNumber } from '@/components/native';
import type { FinancialDailyDetail, MonthlyFinancialDetailMetric } from '@/services/finance';
import { formatCurrency } from '@/utils/data';
import { useAppTheme } from '@/theme';

type Props = {
  detail: FinancialDailyDetail;
  metric: MonthlyFinancialDetailMetric;
  animateRowEntrance?: boolean;
};

const cardLayoutTransition = LinearTransition.duration(200).easing(Easing.out(Easing.quad));
const rowEnteringAnimation = FadeInDown.duration(200).springify().damping(30).stiffness(220);
const rowExitingAnimation = FadeOutUp.duration(180);

export function FinancialDayDetailCard({ detail, metric, animateRowEntrance = true }: Props) {
  const { resolvedMode, theme } = useAppTheme();
  const { summary } = detail;
  const rows = [
    {
      icon: 'cash-outline' as const,
      label: 'Faturamento',
      numericValue: summary.faturamento,
      value: formatCurrency(summary.faturamento),
    },
    {
      icon: 'trending-up-outline' as const,
      label: 'Lucro líquido',
      numericValue: summary.lucroLiquido,
      value: formatCurrency(summary.lucroLiquido),
    },
    {
      icon: 'cube-outline' as const,
      label: 'Baldes vendidos',
      numericValue: summary.quantidadeBaldes,
      value: String(summary.quantidadeBaldes),
    },
    {
      icon: 'people-outline' as const,
      label: 'Entregas',
      numericValue: summary.quantidadeEntregas,
      value: String(summary.quantidadeEntregas),
    },
    ...(summary.custoEstar > 0
      ? [
          {
            icon: 'car-outline' as const,
            label: 'Estar',
            numericValue: summary.custoEstar,
            value: formatCurrency(summary.custoEstar),
          },
        ]
      : []),
    ...(detail.totalKilometers > 0
      ? [
          {
            icon: 'speedometer-outline' as const,
            label: 'Km total',
            numericValue: detail.totalKilometers,
            value: `${formatNumber(detail.totalKilometers)} km`,
          },
        ]
      : []),
    ...(detail.automaticKilometers > 0
      ? [
          {
            icon: 'navigate-outline' as const,
            label: 'Km automático',
            numericValue: detail.automaticKilometers,
            value: `${formatNumber(detail.automaticKilometers)} km`,
          },
        ]
      : []),
    ...(detail.manualKilometers > 0
      ? [
          {
            icon: 'create-outline' as const,
            label: 'Km manual',
            numericValue: detail.manualKilometers,
            value: `${formatNumber(detail.manualKilometers)} km`,
          },
        ]
      : []),
    ...(detail.totalKilometers > 0
      ? [
          {
            icon: 'flame-outline' as const,
            label: 'Custo de combustível',
            numericValue: summary.custoCombustivel,
            value: formatCurrency(summary.custoCombustivel),
          },
        ]
      : []),
    ...(summary.custoOutros > 0
      ? [
          {
            icon: 'ellipsis-horizontal-circle-outline' as const,
            label: 'Outros',
            numericValue: summary.custoOutros,
            value: formatCurrency(summary.custoOutros),
          },
        ]
      : []),
    ...(summary.custoLuz > 0
      ? [
          {
            icon: 'bulb-outline' as const,
            label: 'Luz do período',
            numericValue: summary.custoLuz,
            value: formatCurrency(summary.custoLuz),
          },
        ]
      : []),
  ];
  const visibleRows = rows.filter((row) =>
    metric === 'faturamento' ? row.icon !== 'trending-up-outline' : row.icon !== 'cash-outline',
  );

  return (
    <Animated.View
      layout={cardLayoutTransition}
      style={[
        styles.infoCard,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.separator,
          borderRadius: theme.radius.xl + theme.spacing.sm,
        },
        resolvedMode === 'dark' ? theme.shadows.none : theme.shadows.card,
      ]}
    >
      {visibleRows.map((row) => (
        <Animated.View
          entering={animateRowEntrance ? rowEnteringAnimation : undefined}
          exiting={rowExitingAnimation}
          key={row.label}
          layout={cardLayoutTransition}
          style={styles.row}
        >
          <View style={styles.labelGroup}>
            <Ionicons
              color={theme.colors.textSecondary}
              name={row.icon}
              size={theme.sizes.iconSmall}
            />
            <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
              {row.label}
            </Text>
          </View>
          <NativeAnimatedNumber
            alignment="trailing"
            color={theme.colors.textPrimary}
            fontSize={theme.typography.subheadline.fontSize}
            fontWeight="regular"
            lineHeight={theme.typography.subheadline.lineHeight}
            text={row.value}
            value={row.numericValue}
          />
        </Animated.View>
      ))}
    </Animated.View>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
}

const styles = StyleSheet.create({
  infoCard: { paddingHorizontal: 16, paddingVertical: 14 },
  labelGroup: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8 },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
});
