import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, View } from 'react-native';

import {
  EmptyState,
  ErrorState,
  IconButton,
  LargeTitleHeader,
  ListItem,
  ScrollScreen,
  Section,
  Skeleton,
} from '@/components';
import { useFinancialReport } from '@/hooks/useFinancialReport';
import { useFinancialPrivacy } from '@/hooks/useFinancialPrivacy';
import { useFinancialPeriod } from '@/providers';
import { formatFinancialPeriodLabel } from '@/services/finance';
import type { FinanceMetric, FinanceStackParamList } from '@/navigation/types';
import { useAppTheme } from '@/theme';

import { FinanceMetricGrid } from './FinanceMetricGrid';
import { FinancePeriodControl } from './FinancePeriodControl';

type Props = NativeStackScreenProps<FinanceStackParamList, 'FinanceHome'>;

export function FinanceHomeScreen({ navigation }: Props) {
  const { theme } = useAppTheme();
  const { selection, setSelection } = useFinancialPeriod();
  const { hidden, toggleHidden } = useFinancialPrivacy();
  const report = useFinancialReport(selection);

  const openMetric = (metric: FinanceMetric) => {
    navigation.navigate('FinanceIndicatorDetails', {
      metric,
      period: selection.kind,
      periodLabel: formatFinancialPeriodLabel(selection),
      selection,
    });
  };

  return (
    <ScrollScreen onRefresh={() => void report.reload()} refreshing={report.refreshing}>
      <LargeTitleHeader
        rightAction={
          <IconButton
            accessibilityLabel={hidden ? 'Mostrar valores' : 'Ocultar valores'}
            icon={
              <Ionicons
                color={theme.colors.primary}
                name={hidden ? 'eye-off-outline' : 'eye-outline'}
                size={theme.sizes.iconMedium}
              />
            }
            onPress={toggleHidden}
          />
        }
        subtitle="Receitas, custos e resultados"
        title="Financeiro"
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
            title="Não foi possível carregar o financeiro"
          />
        ) : report.summary ? (
          <>
            <Section title="Resumo">
              <FinanceMetricGrid
                comparison={report.comparison}
                hidden={hidden}
                onMetricPress={openMetric}
                summary={report.summary}
              />
            </Section>
            {report.deliveries?.length === 0 ? (
              <EmptyState
                description="Não há entregas no período selecionado. Os valores permanecem zerados conforme as regras históricas."
                title="Nenhuma entrega no período"
              />
            ) : null}
          </>
        ) : null}
        <Section title="Acessos financeiros">
          <ListItem
            leading={
              <Ionicons
                color={theme.colors.primary}
                name="calendar-outline"
                size={theme.sizes.iconMedium}
              />
            }
            onPress={() => navigation.navigate('FinancePeriodReport', { selection })}
            subtitle="Filtros, comparativos e registros relacionados"
            title="Relatório do período"
          />
          <ListItem
            leading={
              <Ionicons
                color={theme.colors.primary}
                name="bar-chart-outline"
                size={theme.sizes.iconMedium}
              />
            }
            onPress={() =>
              navigation.navigate('FinanceCharts', { selection, granularity: 'month' })
            }
            subtitle="Evolução agrupada pelas funções financeiras"
            title="Gráficos"
          />
          <ListItem
            leading={
              <Ionicons
                color={theme.colors.primary}
                name="podium-outline"
                size={theme.sizes.iconMedium}
              />
            }
            onPress={() => navigation.navigate('FinanceRanking', { selection })}
            subtitle="Clientes ordenados pelas regras do Ionic"
            title="Ranking de clientes"
          />
          <ListItem
            leading={
              <Ionicons
                color={theme.colors.primary}
                name="business-outline"
                size={theme.sizes.iconMedium}
              />
            }
            onPress={() => navigation.navigate('FinanceFactory')}
            subtitle="Recebimentos, parcelas e valores em aberto"
            title="Fábrica"
          />
          <ListItem
            leading={
              <Ionicons
                color={theme.colors.primary}
                name="car-outline"
                size={theme.sizes.iconMedium}
              />
            }
            onPress={() => navigation.navigate('ExpensesHome')}
            subtitle="Estar, combustível e luz mensal"
            title="Gastos e custos"
          />
        </Section>
        {report.comparison ? (
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            Comparativo calculado com os mesmos dias trabalhados do período anterior.
          </Text>
        ) : null}
      </View>
    </ScrollScreen>
  );
}
