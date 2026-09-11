import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, View } from 'react-native';

import {
  DeliveryCard,
  EmptyState,
  ErrorState,
  FinanceCard,
  LargeTitleHeader,
  ScrollScreen,
  Section,
  Skeleton,
} from '@/components';
import { useFinancialReport, summaryValue } from '@/hooks/useFinancialReport';
import { useFinancialPrivacy } from '@/hooks/useFinancialPrivacy';
import type { DashboardStackParamList, FinanceMetric } from '@/navigation/types';
import { useAppTheme } from '@/theme';
import { formatCurrency } from '@/utils/data';

type Props = NativeStackScreenProps<DashboardStackParamList, 'DashboardIndicatorDetails'>;

const labels: Record<FinanceMetric, string> = {
  faturamento: 'Faturamento',
  pago: 'Recebido',
  pendente: 'Pendente',
  lucroBruto: 'Lucro bruto',
  lucroLiquido: 'Lucro líquido',
  custos: 'Custos',
  margemBruta: 'Margem bruta',
  margemLiquida: 'Margem líquida',
  quantidade: 'Baldes',
  precoMedio: 'Preço médio',
  custoMedio: 'Custo médio',
};

function displayValue(metric: FinanceMetric, value: number): string {
  return metric === 'quantidade'
    ? `${value} baldes`
    : metric === 'margemBruta' || metric === 'margemLiquida'
      ? `${value.toFixed(1)}%`
      : formatCurrency(value);
}

export function DashboardIndicatorDetailsScreen({ navigation, route }: Props) {
  const { theme } = useAppTheme();
  const { hidden } = useFinancialPrivacy();
  const report = useFinancialReport(route.params.period);

  return (
    <ScrollScreen onRefresh={() => void report.reload()} refreshing={report.refreshing}>
      <LargeTitleHeader onBack={() => navigation.goBack()} title={labels[route.params.metric]} />
      <View style={{ gap: theme.spacing.lg, padding: theme.spacing.md }}>
        {report.loading ? (
          <Skeleton height={theme.sizes.loadingLineHeight * 6} />
        ) : report.error ? (
          <ErrorState
            description={report.error}
            onRetry={() => void report.reload()}
            title="Não foi possível carregar o indicador"
          />
        ) : report.summary ? (
          <>
            <FinanceCard
              label={route.params.period === 'day' ? 'Hoje' : 'Este mês'}
              value={
                hidden
                  ? '••••'
                  : displayValue(
                      route.params.metric,
                      summaryValue(report.summary, route.params.metric),
                    )
              }
            />
            <Section title="Registros relacionados">
              {report.deliveries?.length ? (
                report.deliveries
                  .slice(0, 20)
                  .map((delivery) => (
                    <DeliveryCard
                      key={delivery.id}
                      clientName={delivery.cliente}
                      dateLabel={delivery.data}
                      delivered={delivery.entregue}
                      quantityLabel={`${delivery.quantidade} balde(s)`}
                      status={delivery.status === 'Pago' ? 'Pago' : 'Não Pago'}
                      totalLabel={hidden ? '••••' : formatCurrency(delivery.valor)}
                    />
                  ))
              ) : (
                <EmptyState
                  description="Não há registros associados ao indicador."
                  title="Nenhum registro relacionado"
                />
              )}
            </Section>
            <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
              Os valores desta tela são derivados das mesmas funções usadas no Dashboard e no
              Financeiro.
            </Text>
          </>
        ) : null}
      </View>
    </ScrollScreen>
  );
}
