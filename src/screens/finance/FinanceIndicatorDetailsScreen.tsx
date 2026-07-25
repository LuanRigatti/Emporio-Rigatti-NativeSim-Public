import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, View } from 'react-native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import {
  DeliveryCard,
  EmptyState,
  ErrorState,
  FinanceCard,
  LargeTitleHeader,
  ListItem,
  ScrollScreen,
  Section,
  Skeleton,
} from '@/components';
import { summaryValue, useFinancialReport } from '@/hooks/useFinancialReport';
import { useFinancialPrivacy } from '@/hooks/useFinancialPrivacy';
import type { FinanceMetric, FinanceStackParamList, MainTabParamList } from '@/navigation/types';
import { useAppTheme } from '@/theme';
import { formatCurrency } from '@/utils/data';

type Props = NativeStackScreenProps<FinanceStackParamList, 'FinanceIndicatorDetails'>;

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

const descriptions: Record<FinanceMetric, string> = {
  faturamento: 'Soma dos valores persistidos das entregas filtradas.',
  pago: 'Soma das entregas cujo status persistido é exatamente Pago.',
  pendente: 'Soma das entregas cujo status é diferente de Pago.',
  lucroBruto: 'Faturamento menos o custo histórico dos baldes.',
  lucroLiquido: 'Lucro bruto menos Estar, combustível e luz rateada.',
  custos: 'Custos de baldes, Estar, combustível e luz rateada.',
  margemBruta: 'Lucro bruto dividido pelo faturamento, em percentual.',
  margemLiquida: 'Lucro líquido dividido pelo faturamento, em percentual.',
  quantidade: 'Quantidade de baldes somada nas entregas filtradas.',
  precoMedio: 'Faturamento dividido pela quantidade de baldes.',
  custoMedio: 'Custo completo dividido pela quantidade de baldes.',
};

function metricValue(metric: FinanceMetric, value: number): string {
  return metric === 'quantidade'
    ? `${value} baldes`
    : metric === 'margemBruta' || metric === 'margemLiquida'
      ? `${value.toFixed(1)}%`
      : formatCurrency(value);
}

export function FinanceIndicatorDetailsScreen({ navigation, route }: Props) {
  const { theme } = useAppTheme();
  const { hidden } = useFinancialPrivacy();
  const report = useFinancialReport(route.params.period);
  const summary = report.summary;

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
        ) : summary ? (
          <>
            <FinanceCard
              label={route.params.periodLabel}
              subtitle={descriptions[route.params.metric]}
              value={
                hidden
                  ? '••••'
                  : metricValue(route.params.metric, summaryValue(summary, route.params.metric))
              }
            />
            <Section title="Registros relacionados">
              {report.deliveries?.length ? (
                report.deliveries.slice(0, 20).map((delivery) => (
                  <DeliveryCard
                    key={delivery.id}
                    clientName={delivery.cliente}
                    dateLabel={delivery.data}
                    delivered={delivery.entregue}
                    onPress={() =>
                      navigation
                        .getParent<BottomTabNavigationProp<MainTabParamList>>()
                        ?.navigate('Entregas', {
                          screen: 'DeliveryDetails',
                          params: { deliveryId: delivery.id },
                        })
                    }
                    quantityLabel={`${delivery.quantidade} balde(s)`}
                    status={delivery.status === 'Pago' ? 'Pago' : 'Não Pago'}
                    totalLabel={hidden ? '••••' : formatCurrency(delivery.valor)}
                  />
                ))
              ) : (
                <EmptyState
                  description="Este indicador não possui registros no período selecionado."
                  title="Nenhum registro relacionado"
                />
              )}
            </Section>
            <Section title="Composição">
              <ListItem
                title="Quantidade de entregas"
                trailing={
                  <Text style={{ color: theme.colors.textPrimary }}>
                    {summary.quantidadeEntregas}
                  </Text>
                }
              />
              <ListItem
                title="Quantidade de baldes"
                trailing={
                  <Text style={{ color: theme.colors.textPrimary }}>
                    {summary.quantidadeBaldes}
                  </Text>
                }
              />
            </Section>
          </>
        ) : null}
      </View>
    </ScrollScreen>
  );
}
