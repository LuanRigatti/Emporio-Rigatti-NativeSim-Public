import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, Text } from 'react-native';

import { AppModal, LargeTitleHeader, Screen } from '@/components';
import type { FinanceStackParamList } from '@/navigation/types';
import { useAppTheme } from '@/theme';

type Props = NativeStackScreenProps<FinanceStackParamList, 'CostCalculationDetails'>;

const explanations: Record<FinanceStackParamList['CostCalculationDetails']['metric'], string> = {
  estar: 'O Estar é somado pelos registros diários que pertencem ao período selecionado.',
  combustivel:
    'Antes de 01/05/2026, o custo usa gasolina. A partir dessa data, usa quilometragem, preço e média de km/l conforme o tipo de combustível e os cortes históricos.',
  luz: 'A luz é rateada somente entre segunda, quarta e sexta. O custo mensal é multiplicado pela proporção de dias trabalhados no intervalo.',
  total:
    'O custo total é a soma de Estar, combustível e luz rateada, sem alterar os valores persistidos.',
  mediaCombustivel:
    'A média de combustível por entrega considera somente datas a partir de 01/05/2026 e divide o custo pelo número de registros de entrega, não pela quantidade de baldes.',
};

export function CostCalculationDetails({ navigation, route }: Props) {
  const { theme } = useAppTheme();
  return (
    <Screen>
      <AppModal title="Detalhes do cálculo" visible onRequestClose={() => navigation.goBack()}>
        <LargeTitleHeader onBack={() => navigation.goBack()} title={route.params.periodLabel} />
        <ScrollView contentContainerStyle={{ paddingTop: theme.spacing.md }}>
          <Text style={[theme.typography.title3, { color: theme.colors.textPrimary }]}>
            {route.params.metric}
          </Text>
          <Text
            style={[
              theme.typography.body,
              { color: theme.colors.textSecondary, marginTop: theme.spacing.sm },
            ]}
          >
            {explanations[route.params.metric]}
          </Text>
        </ScrollView>
      </AppModal>
    </Screen>
  );
}
