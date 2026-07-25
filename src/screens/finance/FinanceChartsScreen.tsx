import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import {
  ActionSheet,
  EmptyState,
  ErrorState,
  FinanceCard,
  FinancialSeriesChart,
  LargeTitleHeader,
  ListItem,
  ScrollScreen,
  Section,
  SegmentedControl,
  Skeleton,
} from '@/components';
import { useFinancialSeries } from '@/hooks/useFinancialSeries';
import { useFinancialPeriod } from '@/providers';
import { selectionFromReportPeriod } from '@/services/finance';
import type { FinanceMetric, FinanceStackParamList } from '@/navigation/types';
import type { FinancialChartGranularity } from '@/types/data';
import { useAppTheme } from '@/theme';
import { formatCurrency } from '@/utils/data';

import { FinancePeriodControl } from './FinancePeriodControl';

type Props = NativeStackScreenProps<FinanceStackParamList, 'FinanceCharts'>;

const metricLabels: Record<FinanceMetric, string> = {
  faturamento: 'Faturamento',
  pago: 'Recebido',
  pendente: 'Pendente',
  lucroBruto: 'Lucro bruto',
  lucroLiquido: 'Lucro líquido',
  custos: 'Custos',
  margemBruta: 'Margem bruta',
  margemLiquida: 'Margem líquida',
  quantidade: 'Quantidade de baldes',
  precoMedio: 'Preço médio',
  custoMedio: 'Custo médio',
};

const metricOptions: readonly FinanceMetric[] = [
  'faturamento',
  'pago',
  'pendente',
  'lucroLiquido',
  'custos',
  'quantidade',
];

function displayValue(metric: FinanceMetric, value: number): string {
  if (metric === 'quantidade') return `${value} baldes`;
  if (metric === 'margemBruta' || metric === 'margemLiquida') return `${value.toFixed(1)}%`;
  return formatCurrency(value);
}

export function FinanceChartsScreen({ navigation, route }: Props) {
  const { theme } = useAppTheme();
  const { selection, setSelection } = useFinancialPeriod();
  const [metric, setMetric] = useState<FinanceMetric>(route.params?.metric ?? 'faturamento');
  const [granularity, setGranularity] = useState<FinancialChartGranularity>(
    route.params?.granularity ?? 'month',
  );
  const [metricSheetVisible, setMetricSheetVisible] = useState(false);

  useEffect(() => {
    const nextSelection =
      route.params?.selection ??
      (route.params?.period ? selectionFromReportPeriod(route.params.period) : undefined);
    if (nextSelection) setSelection(nextSelection);
  }, [route.params?.period, route.params?.selection, setSelection]);

  const report = useFinancialSeries(selection, metric, granularity);
  const metricColor =
    metric === 'pendente' || metric === 'custos'
      ? theme.colors.warning
      : metric === 'lucroLiquido'
        ? theme.colors.success
        : theme.colors.primary;
  const actionOptions = useMemo(
    () =>
      metricOptions.map((option) => ({
        key: option,
        label: metricLabels[option],
        onPress: () => setMetric(option),
      })),
    [],
  );

  return (
    <ScrollScreen onRefresh={() => void report.reload()} refreshing={report.refreshing}>
      <LargeTitleHeader onBack={() => navigation.goBack()} title="Gráficos" />
      <View style={{ gap: theme.spacing.lg, padding: theme.spacing.md }}>
        <FinancePeriodControl
          availableYears={report?.availableYears ?? []}
          onChange={setSelection}
          selection={selection}
        />
        <Section title="Métrica">
          <ListItem
            onPress={() => setMetricSheetVisible(true)}
            subtitle="Escolha o indicador que será agrupado"
            title={metricLabels[metric]}
            trailing={
              <Text style={[theme.typography.body, { color: theme.colors.primary }]}>Alterar</Text>
            }
          />
          <ActionSheet
            onClose={() => setMetricSheetVisible(false)}
            options={actionOptions}
            title="Selecionar métrica"
            visible={metricSheetVisible}
          />
        </Section>
        <Section title="Agrupamento">
          <SegmentedControl
            options={[
              { value: 'day' as const, label: 'Dia' },
              { value: 'week' as const, label: 'Semana' },
              { value: 'month' as const, label: 'Mês' },
              { value: 'year' as const, label: 'Ano' },
            ]}
            value={granularity}
            onChange={setGranularity}
          />
        </Section>
        {report.loading ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Skeleton height={theme.sizes.loadingLineHeight * 8} />
            <Skeleton height={theme.sizes.loadingLineHeight * 4} />
          </View>
        ) : report.error ? (
          <ErrorState
            description={report.error}
            onRetry={() => void report.reload()}
            title="Não foi possível carregar os gráficos"
          />
        ) : report.series.length === 0 ? (
          <EmptyState
            description="Não existem registros reais para o período e agrupamento selecionados."
            title="Sem dados para o gráfico"
          />
        ) : report.series.length === 1 ? (
          <Section title={metricLabels[metric]}>
            <EmptyState
              description="Existe apenas um período disponível. Selecione Todo o histórico ou outro agrupamento para visualizar evolução."
              title="Apenas um período disponível"
            />
            <FinanceCard
              label={report.series[0].label}
              value={report.series[0] ? displayValue(metric, report.series[0].value) : '—'}
            />
          </Section>
        ) : (
          <Section
            title={`${metricLabels[metric]} por ${granularity === 'day' ? 'dia' : granularity === 'week' ? 'semana' : granularity === 'month' ? 'mês' : 'ano'}`}
          >
            <Text
              style={[
                theme.typography.footnote,
                { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm },
              ]}
            >
              Série calculada exclusivamente a partir dos registros existentes.
            </Text>
            <FinancialSeriesChart
              accessibilityLabel={`Evolução de ${metricLabels[metric]}`}
              color={metricColor}
              points={report.series}
            />
            {report.series.map((point) => (
              <ListItem
                key={point.key}
                title={point.label}
                trailing={
                  <Text style={[theme.typography.currency, { color: theme.colors.textPrimary }]}>
                    {displayValue(metric, point.value)}
                  </Text>
                }
              />
            ))}
          </Section>
        )}
      </View>
    </ScrollScreen>
  );
}
