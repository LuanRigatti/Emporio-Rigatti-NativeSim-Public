import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlatList, Text, View } from 'react-native';

import { EmptyState, ErrorState, LargeTitleHeader, ListItem, Loading, Section } from '@/components';
import { Screen } from '@/components/layout';
import { useExpenses } from '@/hooks/useExpenses';
import type { FinanceStackParamList } from '@/navigation/types';
import { expenseFiltersForSelection } from '@/services/expenses';
import { formatFinancialPeriodLabel } from '@/services/finance';
import { formatCurrency, formatPtBrDate } from '@/utils/data';
import { useAppTheme } from '@/theme';

type Props = NativeStackScreenProps<FinanceStackParamList, 'ExpenseHistory'>;

export function ExpenseHistory({ navigation, route }: Props) {
  const { theme } = useAppTheme();
  const selection = route.params?.selection;
  const filters = selection ? expenseFiltersForSelection(selection) : { period: 'all' as const };
  const { dailyExpenses: history, loading, error, reload } = useExpenses(filters);

  return (
    <Screen>
      <LargeTitleHeader
        onBack={() => navigation.goBack()}
        subtitle={selection ? formatFinancialPeriodLabel(selection) : 'Todo o histórico'}
        title="Histórico de gastos"
      />
      <View style={{ flex: 1, paddingHorizontal: theme.spacing.md }}>
        {loading ? (
          <Loading label="Carregando histórico" size="large" style={{ flex: 1 }} />
        ) : error ? (
          <ErrorState
            description={error}
            onRetry={() => void reload()}
            title="Não foi possível carregar o histórico"
          />
        ) : history.length === 0 ? (
          <EmptyState
            title="Nenhum gasto registrado"
            description="Os registros diários aparecerão aqui."
          />
        ) : (
          <FlatList
            contentContainerStyle={{ paddingVertical: theme.spacing.md }}
            data={history}
            keyExtractor={(item) => item.data}
            renderItem={({ item }) => (
              <Section title={formatPtBrDate(item.data)}>
                <ListItem title="Estar" trailing={<Text>{formatCurrency(item.estar ?? 0)}</Text>} />
                <ListItem
                  title="Combustível"
                  subtitle={item.tipoCombustivel ?? 'Legado ou não informado'}
                  trailing={<Text>{formatCurrency(item.gasolina ?? item.precoGasolina ?? 0)}</Text>}
                />
              </Section>
            )}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Screen>
  );
}
