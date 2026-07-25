import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { View } from 'react-native';

import { FinanceCard, LargeTitleHeader, Screen, Section, TextButton } from '@/components';
import { useExpenses } from '@/hooks/useExpenses';
import type { FinanceStackParamList } from '@/navigation/types';
import { useAppTheme } from '@/theme';

type Props = NativeStackScreenProps<FinanceStackParamList, 'CostPeriod'>;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { currency: 'BRL', style: 'currency' }).format(value);
}

export function CostPeriod({ navigation, route }: Props) {
  const { theme } = useAppTheme();
  const period = route.params?.period ?? 'month';
  const date = route.params?.date ?? new Date().toISOString().slice(0, 10);
  const month = route.params?.month ?? date.slice(0, 7);
  const filters = useMemo(() => ({ period, date, month }), [date, month, period]);
  const { summary, loading } = useExpenses(filters);

  return (
    <Screen>
      <LargeTitleHeader onBack={() => navigation.goBack()} title="Custos do período" />
      <View style={{ gap: theme.spacing.sm, padding: theme.spacing.md }}>
        <Section title="Resumo">
          <FinanceCard
            label="Estar"
            loading={loading}
            value={summary ? formatCurrency(summary.estar) : ''}
          />
          <FinanceCard
            label="Combustível"
            loading={loading}
            value={summary ? formatCurrency(summary.combustivel) : ''}
          />
          <FinanceCard
            label="Luz rateada"
            loading={loading}
            value={summary ? formatCurrency(summary.luz) : ''}
          />
          <FinanceCard
            label="Custo total"
            loading={loading}
            value={summary ? formatCurrency(summary.total) : ''}
          />
          <FinanceCard
            label="Média de combustível por entrega"
            loading={loading}
            value={summary ? formatCurrency(summary.custoMedioCombustivelPorEntrega) : ''}
          />
        </Section>
        <TextButton
          onPress={() =>
            navigation.navigate('CostCalculationDetails', { metric: 'total', periodLabel: period })
          }
        >
          Ver detalhes dos cálculos
        </TextButton>
      </View>
    </Screen>
  );
}
