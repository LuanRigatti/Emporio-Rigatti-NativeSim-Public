import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import type { FinancialDailyDetail, MonthlyFinancialDetailMetric } from '@/services/finance';
import { formatCurrency, formatPtBrDate } from '@/utils/data';
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
    <View style={styles.container}>
      <PremiumCard style={styles.headingCard}>
        <View style={styles.heading}>
          <View style={[styles.headingIcon, { backgroundColor: theme.colors.selectionSurface }]}>
            <Ionicons
              color={theme.colors.selectionContent}
              name="analytics-outline"
              size={theme.sizes.iconMedium}
            />
          </View>
          <View style={styles.headingCopy}>
            <Text style={[theme.typography.title3, { color: theme.colors.textPrimary }]}>
              Detalhes do dia
            </Text>
            <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
              {formatPtBrDate(detail.date)}
            </Text>
          </View>
        </View>
      </PremiumCard>
      <View style={{ gap: theme.spacing.sm }}>
        {visibleRows.map((row) => (
          <PremiumCard key={row.label} style={styles.infoCard}>
            <View style={styles.row}>
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
          </PremiumCard>
        ))}
      </View>
    </View>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  heading: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  headingCard: { padding: 20 },
  headingCopy: { flex: 1, gap: 2 },
  headingIcon: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  infoCard: { paddingHorizontal: 16, paddingVertical: 14 },
  labelGroup: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8 },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
