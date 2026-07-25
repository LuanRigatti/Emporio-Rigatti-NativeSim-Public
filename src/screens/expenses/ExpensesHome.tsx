import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';

import {
  EmptyState,
  ErrorState,
  FinanceCard,
  IconButton,
  LargeTitleHeader,
  ListItem,
  PrimaryButton,
  Screen,
  Section,
  Skeleton,
  TextButton,
} from '@/components';
import { useExpenses } from '@/hooks/useExpenses';
import type { FinanceStackParamList } from '@/navigation/types';
import { expenseFiltersForSelection } from '@/services/expenses';
import { formatFinancialPeriodLabel } from '@/services/finance';
import type { FinancialPeriodSelection } from '@/types/data';
import { formatPtBrDate, todayIso } from '@/utils/data';
import { useAppTheme } from '@/theme';

import { FinancePeriodControl } from '../finance/FinancePeriodControl';

type Props = NativeStackScreenProps<FinanceStackParamList, 'ExpensesHome'>;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { currency: 'BRL', style: 'currency' }).format(value);
}

export function ExpensesHome({ navigation }: Props) {
  const { theme } = useAppTheme();
  const date = todayIso();
  const [selection, setSelection] = useState<FinancialPeriodSelection>({ kind: 'day', date });
  const filters = useMemo(() => expenseFiltersForSelection(selection), [selection]);
  const { snapshot, summary, dailyExpenses, loading, refreshing, error, reload } =
    useExpenses(filters);
  const availableYears = useMemo(
    () =>
      Object.keys(snapshot?.gastosDiarios ?? {})
        .map((value) => value.slice(0, 4))
        .filter((value, index, values) => /^\d{4}$/.test(value) && values.indexOf(value) === index)
        .sort((left, right) => right.localeCompare(left)),
    [snapshot],
  );
  const periodLabel = formatFinancialPeriodLabel(selection);

  return (
    <Screen>
      <LargeTitleHeader
        rightAction={
          <IconButton
            accessibilityLabel="Registrar gasto diário"
            icon={
              <Ionicons color={theme.colors.primary} name="add" size={theme.sizes.iconMedium} />
            }
            onPress={() => navigation.navigate('DailyExpenseForm', { date })}
          />
        }
        subtitle="Estar, combustível, luz e rateios"
        title="Financeiro"
      />
      <View style={{ flex: 1, paddingHorizontal: theme.spacing.md }}>
        <FinancePeriodControl
          availableYears={availableYears}
          onChange={setSelection}
          selection={selection}
        />
        {loading ? (
          <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.lg }}>
            <Skeleton height={theme.sizes.loadingLineHeight * 3} />
            <Skeleton height={theme.sizes.loadingLineHeight * 3} />
          </View>
        ) : error ? (
          <ErrorState
            description={error}
            onRetry={() => void reload()}
            title="Não foi possível carregar gastos"
          />
        ) : (
          <FlatList
            contentContainerStyle={{ gap: theme.spacing.sm, paddingVertical: theme.spacing.md }}
            data={dailyExpenses}
            keyExtractor={(item) => item.data}
            onRefresh={() => void reload()}
            refreshing={refreshing}
            ListHeaderComponent={
              summary ? (
                <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
                  <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                    <FinanceCard
                      label="Estar"
                      value={formatCurrency(summary.estar)}
                      onPress={() =>
                        navigation.navigate('CostCalculationDetails', {
                          metric: 'estar',
                          periodLabel,
                        })
                      }
                      style={{ flex: 1 }}
                    />
                    <FinanceCard
                      label="Combustível"
                      value={formatCurrency(summary.combustivel)}
                      onPress={() =>
                        navigation.navigate('CostCalculationDetails', {
                          metric: 'combustivel',
                          periodLabel,
                        })
                      }
                      style={{ flex: 1 }}
                    />
                  </View>
                  <FinanceCard
                    label="Luz rateada"
                    value={formatCurrency(summary.luz)}
                    onPress={() =>
                      navigation.navigate('CostCalculationDetails', {
                        metric: 'luz',
                        periodLabel,
                      })
                    }
                  />
                  <FinanceCard
                    label="Custo total"
                    value={formatCurrency(summary.total)}
                    onPress={() =>
                      navigation.navigate('CostCalculationDetails', {
                        metric: 'total',
                        periodLabel,
                      })
                    }
                  />
                  <TextButton onPress={() => navigation.navigate('CostPeriod', { selection })}>
                    Ver custos do período
                  </TextButton>
                  <TextButton onPress={() => navigation.navigate('ExpenseHistory', { selection })}>
                    Ver histórico de gastos
                  </TextButton>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <EmptyState
                description="Registre Estar, quilometragem ou combustível para acompanhar os custos."
                title="Nenhum gasto registrado"
                actionLabel="Registrar gasto"
                onActionPress={() => navigation.navigate('DailyExpenseForm', { date })}
              />
            }
            renderItem={({ item }) => (
              <Section title={formatPtBrDate(item.data)}>
                <ListItem
                  title="Estar"
                  subtitle={formatCurrency(item.estar ?? 0)}
                  trailing={<Text>{formatCurrency(item.estar ?? 0)}</Text>}
                  onPress={() => navigation.navigate('DailyExpenseForm', { date: item.data })}
                />
                <ListItem
                  title="Combustível"
                  subtitle={item.tipoCombustivel ?? 'Legado ou não informado'}
                  trailing={<Text>{formatCurrency(item.gasolina ?? item.precoGasolina ?? 0)}</Text>}
                  onPress={() => navigation.navigate('DailyExpenseForm', { date: item.data })}
                />
              </Section>
            )}
            showsVerticalScrollIndicator={false}
          />
        )}
        <PrimaryButton
          fullWidth
          onPress={() =>
            navigation.navigate('MonthlyLight', {
              month: selection.kind === 'month' ? selection.month : date.slice(0, 7),
            })
          }
        >
          Editar luz mensal
        </PrimaryButton>
      </View>
    </Screen>
  );
}
