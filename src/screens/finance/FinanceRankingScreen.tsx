import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

import {
  EmptyState,
  ErrorState,
  LargeTitleHeader,
  ListItem,
  ProgressBar,
  ScrollScreen,
  Section,
  Skeleton,
} from '@/components';
import { useFinancialReport } from '@/hooks/useFinancialReport';
import { useFinancialPrivacy } from '@/hooks/useFinancialPrivacy';
import { useFinancialPeriod } from '@/providers';
import { formatFinancialPeriodLabel, selectionFromReportPeriod } from '@/services/finance';
import type { FinanceStackParamList } from '@/navigation/types';
import { useAppTheme } from '@/theme';
import { formatCurrency } from '@/utils/data';

import { FinancePeriodControl } from './FinancePeriodControl';

type Props = NativeStackScreenProps<FinanceStackParamList, 'FinanceRanking'>;

export function FinanceRankingScreen({ navigation, route }: Props) {
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
  const ranking = report.ranking ?? [];

  return (
    <ScrollScreen onRefresh={() => void report.reload()} refreshing={report.refreshing}>
      <LargeTitleHeader
        onBack={() => navigation.goBack()}
        subtitle={formatFinancialPeriodLabel(selection)}
        title="Ranking de clientes"
      />
      <View style={{ gap: theme.spacing.lg, padding: theme.spacing.md }}>
        <FinancePeriodControl
          availableYears={report?.availableYears ?? []}
          onChange={setSelection}
          selection={selection}
        />
        {report.loading ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Skeleton height={theme.sizes.loadingLineHeight * 3} />
            <Skeleton height={theme.sizes.loadingLineHeight * 3} />
          </View>
        ) : report.error ? (
          <ErrorState
            description={report.error}
            onRetry={() => void report.reload()}
            title="Não foi possível carregar o ranking"
          />
        ) : ranking.length === 0 ? (
          <EmptyState
            description="Não existem entregas suficientes para montar o ranking."
            title="Ranking vazio"
          />
        ) : (
          <Section title="Clientes">
            <Text
              style={[
                theme.typography.footnote,
                { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm },
              ]}
            >
              Ordenação por valor, quantidade e nome.
            </Text>
            {ranking.map((item, index) => (
              <ListItem
                key={item.nome}
                subtitle={`${item.entregas} entrega(s) · ${item.quantidade} balde(s)`}
                title={`${index + 1}. ${item.nome}`}
                trailing={
                  <Text style={[theme.typography.currency, { color: theme.colors.textPrimary }]}>
                    {hidden ? '••••' : formatCurrency(item.valor)}
                  </Text>
                }
              />
            ))}
            <ProgressBar
              label="Participação relativa"
              progress={ranking[0]?.percentual ? ranking[0].percentual / 100 : 0}
              tone="info"
            />
          </Section>
        )}
      </View>
    </ScrollScreen>
  );
}
