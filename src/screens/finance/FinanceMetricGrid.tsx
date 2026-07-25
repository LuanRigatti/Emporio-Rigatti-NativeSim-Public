import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';
import type { ComponentProps } from 'react';

import { FinanceCard } from '@/components';
import type { FinanceMetric } from '@/navigation/types';
import type { FinancialComparisonResult, FinancialSummary } from '@/types/data';
import { formatCurrency } from '@/utils/data';
import { useAppTheme } from '@/theme';

import { summaryValue } from '@/hooks/useFinancialReport';

type Props = {
  summary: FinancialSummary;
  hidden: boolean;
  onMetricPress: (metric: FinanceMetric) => void;
  comparison?: FinancialComparisonResult;
};

type MetricDefinition = {
  metric: FinanceMetric;
  label: string;
  format: 'currency' | 'number' | 'percent';
  icon: ComponentProps<typeof Ionicons>['name'];
};

const metrics: readonly MetricDefinition[] = [
  { metric: 'faturamento', label: 'Faturamento', format: 'currency', icon: 'trending-up' },
  { metric: 'pago', label: 'Recebido', format: 'currency', icon: 'checkmark-circle-outline' },
  { metric: 'pendente', label: 'Pendente', format: 'currency', icon: 'time-outline' },
  { metric: 'lucroLiquido', label: 'Lucro líquido', format: 'currency', icon: 'sparkles-outline' },
  { metric: 'custos', label: 'Custos', format: 'currency', icon: 'receipt-outline' },
  {
    metric: 'margemLiquida',
    label: 'Margem líquida',
    format: 'percent',
    icon: 'pie-chart-outline',
  },
  { metric: 'quantidade', label: 'Baldes', format: 'number', icon: 'cube-outline' },
  { metric: 'precoMedio', label: 'Preço médio', format: 'currency', icon: 'pricetag-outline' },
];

function valueLabel(value: number, format: MetricDefinition['format']): string {
  if (format === 'percent') return `${value.toFixed(1)}%`;
  if (format === 'number') return `${value}`;
  return formatCurrency(value);
}

function comparisonForMetric(
  metric: FinanceMetric,
  comparison: FinancialComparisonResult | undefined,
): { trend: 'up' | 'down' | 'neutral'; label: string } | undefined {
  const source =
    metric === 'faturamento'
      ? comparison?.faturamento
      : metric === 'quantidade'
        ? comparison?.quantidadeEntregas
        : metric === 'lucroLiquido'
          ? comparison?.lucroLiquido
          : undefined;
  if (!source) return undefined;
  return {
    trend: source.diferenca === 0 ? 'neutral' : source.subiu ? 'up' : 'down',
    label: `${source.percentual.toFixed(1)}% no período anterior`,
  };
}

export function FinanceMetricGrid({ summary, hidden, onMetricPress, comparison }: Props) {
  const { theme } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
      {metrics.map((definition) => {
        const trend = comparisonForMetric(definition.metric, comparison);
        return (
          <FinanceCard
            key={definition.metric}
            icon={
              <Ionicons
                color={theme.colors.primary}
                name={definition.icon}
                size={theme.sizes.iconSmall}
              />
            }
            label={definition.label}
            onPress={() => onMetricPress(definition.metric)}
            style={{ flexBasis: '47%', flexGrow: 1 }}
            trend={trend?.trend}
            trendLabel={trend?.label}
            value={valueLabel(summaryValue(summary, definition.metric), definition.format)}
            hidden={hidden}
          />
        );
      })}
    </View>
  );
}
