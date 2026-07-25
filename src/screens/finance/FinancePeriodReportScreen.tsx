import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Text, View } from 'react-native';

import {
  EmptyState,
  ErrorState,
  LargeTitleHeader,
  ListItem,
  ScrollScreen,
  Section,
  SegmentedControl,
  Skeleton,
} from '@/components';
import { useFinancialReport, type ReportPeriod } from '@/hooks/useFinancialReport';
import { useFinancialPrivacy } from '@/hooks/useFinancialPrivacy';
import type { FinanceMetric, FinanceStackParamList } from '@/navigation/types';
import { useAppTheme } from '@/theme';
import { formatCurrency } from '@/utils/data';

import { FinanceMetricGrid } from './FinanceMetricGrid';

type Props = NativeStackScreenProps<FinanceStackParamList, 'FinancePeriodReport'>;

export function FinancePeriodReportScreen({ navigation, route }: Props) {
  const { theme } = useAppTheme();
  const { hidden } = useFinancialPrivacy();
  const [period, setPeriod] = useState<ReportPeriod>(route.params?.period ?? 'month');
  const report = useFinancialReport(period);
  const periodLabel =
    period === 'day' ? 'Hoje' : period === 'all' ? 'Todo o histórico' : 'Este mês';

  const openMetric = (metric: FinanceMetric) => {
    navigation.navigate('FinanceIndicatorDetails', { metric, period, periodLabel });
  };

  return (
    <ScrollScreen onRefresh={() => void report.reload()} refreshing={report.refreshing}>
      <LargeTitleHeader
        onBack={() => navigation.goBack()}
        subtitle={periodLabel}
        title="Relatório"
      />
      <View style={{ gap: theme.spacing.lg, padding: theme.spacing.md }}>
        <SegmentedControl
          options={[
            { value: 'day' as const, label: 'Hoje' },
            { value: 'month' as const, label: 'Mês' },
            { value: 'all' as const, label: 'Tudo' },
          ]}
          value={period}
          onChange={setPeriod}
        />
        {report.loading ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Skeleton height={theme.sizes.loadingLineHeight * 4} />
            <Skeleton height={theme.sizes.loadingLineHeight * 4} />
          </View>
        ) : report.error ? (
          <ErrorState
            description={report.error}
            onRetry={() => void report.reload()}
            title="Não foi possível carregar o relatório"
          />
        ) : report.summary ? (
          <>
            <Section title="Indicadores">
              <FinanceMetricGrid
                hidden={hidden}
                onMetricPress={openMetric}
                summary={report.summary}
              />
            </Section>
            {report.comparison ? (
              <Section title="Comparativo">
                <ListItem
                  title="Faturamento"
                  subtitle={`${report.comparison.faturamento.percentual.toFixed(1)}% em relação ao período anterior`}
                  trailing={
                    <Text style={[theme.typography.currency, { color: theme.colors.textPrimary }]}>
                      {hidden ? '••••' : formatCurrency(report.comparison.faturamento.diferenca)}
                    </Text>
                  }
                />
                <ListItem
                  title="Lucro líquido"
                  subtitle={`${report.comparison.lucroLiquido.percentual.toFixed(1)}% em relação ao período anterior`}
                  trailing={
                    <Text style={[theme.typography.currency, { color: theme.colors.textPrimary }]}>
                      {hidden ? '••••' : formatCurrency(report.comparison.lucroLiquido.diferenca)}
                    </Text>
                  }
                />
              </Section>
            ) : null}
            {report.deliveries?.length === 0 ? (
              <EmptyState
                description="Selecione outro período para visualizar registros financeiros."
                title="Nenhum registro encontrado"
              />
            ) : null}
          </>
        ) : null}
      </View>
    </ScrollScreen>
  );
}
