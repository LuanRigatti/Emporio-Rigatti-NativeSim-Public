import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

import {
  EmptyState,
  ErrorState,
  LargeTitleHeader,
  ListItem,
  ScrollScreen,
  Section,
  Skeleton,
} from '@/components';
import { useFinancialReport } from '@/hooks/useFinancialReport';
import { useFinancialPrivacy } from '@/hooks/useFinancialPrivacy';
import { useFinancialPeriod } from '@/providers';
import { formatFinancialPeriodLabel, selectionFromReportPeriod } from '@/services/finance';
import type { FinanceMetric, FinanceStackParamList } from '@/navigation/types';
import { useAppTheme } from '@/theme';

import { FinanceMetricGrid } from './FinanceMetricGrid';
import { FinancePeriodControl } from './FinancePeriodControl';

type Props = NativeStackScreenProps<FinanceStackParamList, 'FinancePeriodReport'>;

export function FinancePeriodReportScreen({ navigation, route }: Props) {
  const { theme } = useAppTheme();
  const { hidden } = useFinancialPrivacy();
  const { selection, setSelection } = useFinancialPeriod();

  useEffect(() => {
    const nextSelection =
      route.params?.selection ??
      (route.params?.period ? selectionFromReportPeriod(route.params.period) : undefined);
    if (nextSelection) setSelection(nextSelection);
  }, [route.params?.period, route.params?.selection, setSelection]);

  const report = useFinancialReport(selection);
  const periodLabel = formatFinancialPeriodLabel(selection);
  const openMetric = (metric: FinanceMetric) => {
    navigation.navigate('FinanceIndicatorDetails', {
      metric,
      period: selection.kind,
      periodLabel,
      selection,
    });
  };

  return (
    <ScrollScreen onRefresh={() => void report.reload()} refreshing={report.refreshing}>
      <LargeTitleHeader
        onBack={() => navigation.goBack()}
        subtitle={periodLabel}
        title="Relatório"
      />
      <View style={{ gap: theme.spacing.lg, padding: theme.spacing.md }}>
        <FinancePeriodControl
          availableYears={report?.availableYears ?? []}
          onChange={setSelection}
          selection={selection}
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
                  subtitle={`${report.comparison.faturamento.percentual.toFixed(1)}% em relação ao período anterior`}
                  title="Faturamento"
                  trailing={
                    <Text style={[theme.typography.currency, { color: theme.colors.textPrimary }]}>
                      {hidden
                        ? '••••'
                        : report.comparison.faturamento.diferenca.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                    </Text>
                  }
                />
                <ListItem
                  subtitle={`${report.comparison.lucroLiquido.percentual.toFixed(1)}% em relação ao período anterior`}
                  title="Lucro líquido"
                  trailing={
                    <Text style={[theme.typography.currency, { color: theme.colors.textPrimary }]}>
                      {hidden
                        ? '••••'
                        : report.comparison.lucroLiquido.diferenca.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
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
