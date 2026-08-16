import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import type { FinancialDailyDetail, MonthlyFinancialDetailMetric } from '@/services/finance';
import { formatCurrency } from '@/utils/data';
import { useAppTheme } from '@/theme';
import { PremiumCard } from '@/components/premium';

type Props = {
  detail: FinancialDailyDetail;
  metric: MonthlyFinancialDetailMetric;
};

export function FinancialDayDetailCard({ detail, metric }: Props) {
  const { theme } = useAppTheme();
  const { summary } = detail;
  const rows = [
    {
      icon: 'cash-outline' as const,
      label: 'Faturamento',
      value: formatCurrency(summary.faturamento),
    },
    {
      icon: 'trending-up-outline' as const,
      label: 'Lucro líquido',
      value: formatCurrency(summary.lucroLiquido),
    },
    {
      icon: 'cube-outline' as const,
      label: 'Baldes vendidos',
      value: String(summary.quantidadeBaldes),
    },
    {
      icon: 'people-outline' as const,
      label: 'Entregas',
      value: String(summary.quantidadeEntregas),
    },
    ...(summary.custoEstar > 0
      ? [
          {
            icon: 'car-outline' as const,
            label: 'Estar',
            value: formatCurrency(summary.custoEstar),
          },
        ]
      : []),
    ...(detail.totalKilometers > 0
      ? [
          {
            icon: 'speedometer-outline' as const,
            label: 'Km total',
            value: `${formatNumber(detail.totalKilometers)} km`,
          },
        ]
      : []),
    ...(detail.automaticKilometers > 0
      ? [
          {
            icon: 'navigate-outline' as const,
            label: 'Km automático',
            value: `${formatNumber(detail.automaticKilometers)} km`,
          },
        ]
      : []),
    ...(detail.manualKilometers > 0
      ? [
          {
            icon: 'create-outline' as const,
            label: 'Km manual',
            value: `${formatNumber(detail.manualKilometers)} km`,
          },
        ]
      : []),
    ...(summary.custoCombustivel > 0
      ? [
          {
            icon: 'flame-outline' as const,
            label: 'Custo de combustível',
            value: formatCurrency(summary.custoCombustivel),
          },
        ]
      : []),
    ...(summary.custoOutros > 0
      ? [
          {
            icon: 'ellipsis-horizontal-circle-outline' as const,
            label: 'Outros',
            value: formatCurrency(summary.custoOutros),
          },
        ]
      : []),
    ...(summary.custoLuz > 0
      ? [
          {
            icon: 'bulb-outline' as const,
            label: 'Luz do período',
            value: formatCurrency(summary.custoLuz),
          },
        ]
      : []),
  ];
  const visibleRows = rows.filter((row) =>
    metric === 'faturamento' ? row.icon !== 'trending-up-outline' : row.icon !== 'cash-outline',
  );

  return (
    <PremiumCard style={[styles.infoCard, { borderRadius: theme.radius.xl + theme.spacing.sm }]}>
      {visibleRows.map((row) => (
        <View key={row.label} style={styles.row}>
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
          <Text style={[theme.typography.subheadline, { color: theme.colors.textPrimary }]}>
            {row.value}
          </Text>
        </View>
      ))}
    </PremiumCard>
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
