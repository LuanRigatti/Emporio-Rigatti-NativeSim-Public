import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, View } from 'react-native';

import {
  EmptyState,
  ErrorState,
  LargeTitleHeader,
  ProgressBar,
  ScrollScreen,
  Section,
  Skeleton,
} from '@/components';
import { useFinancialReport } from '@/hooks/useFinancialReport';
import { useFinancialPrivacy } from '@/hooks/useFinancialPrivacy';
import type { FinanceStackParamList } from '@/navigation/types';
import { useAppTheme } from '@/theme';
import { formatCurrency } from '@/utils/data';

type Props = NativeStackScreenProps<FinanceStackParamList, 'FinanceCharts'>;

export function FinanceChartsScreen({ navigation, route }: Props) {
  const { theme } = useAppTheme();
  const { hidden } = useFinancialPrivacy();
  const report = useFinancialReport(route.params?.period ?? 'month');
  const series = report.series ?? [];
  const max = Math.max(...series.map((item) => item.value), 1);

  return (
    <ScrollScreen onRefresh={() => void report.reload()} refreshing={report.refreshing}>
      <LargeTitleHeader onBack={() => navigation.goBack()} title="Gráficos" />
      <View style={{ padding: theme.spacing.md }}>
        {report.loading ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Skeleton height={theme.sizes.loadingLineHeight * 2} />
            <Skeleton height={theme.sizes.loadingLineHeight * 2} />
            <Skeleton height={theme.sizes.loadingLineHeight * 2} />
          </View>
        ) : report.error ? (
          <ErrorState
            description={report.error}
            onRetry={() => void report.reload()}
            title="Não foi possível carregar os gráficos"
          />
        ) : series.length === 0 ? (
          <EmptyState
            description="Os agrupamentos serão exibidos quando houver entregas no período."
            title="Sem dados para o gráfico"
          />
        ) : (
          <Section title="Evolução mensal">
            <Text
              style={[
                theme.typography.footnote,
                { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm },
              ]}
            >
              Faturamento agrupado pelo serviço financeiro.
            </Text>
            {series.map((item) => (
              <View
                key={item.key}
                style={{ gap: theme.spacing.xs, marginBottom: theme.spacing.md }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
                    {item.label}
                  </Text>
                  <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
                    {hidden ? '••••' : formatCurrency(item.value)}
                  </Text>
                </View>
                <ProgressBar progress={item.value / max} tone="success" />
              </View>
            ))}
          </Section>
        )}
      </View>
    </ScrollScreen>
  );
}
