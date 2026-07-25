import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';

import {
  CurrencyInput,
  FormError,
  Input,
  KeyboardScreen,
  LargeTitleHeader,
  PrimaryButton,
  SecondaryButton,
} from '@/components';
import { useExpenses } from '@/hooks/useExpenses';
import type { FinanceStackParamList } from '@/navigation/types';
import { expenseCalculationService } from '@/services/expenses';
import { normalizeMoney } from '@/utils/data';
import { useAppTheme } from '@/theme';

type Props = NativeStackScreenProps<FinanceStackParamList, 'MonthlyLight'>;

function monthNow(): string {
  return new Date().toISOString().slice(0, 7);
}

export function MonthlyLight({ navigation, route }: Props) {
  const { theme } = useAppTheme();
  const initialMonth = route.params?.month ?? monthNow();
  const { snapshot, loading, saveMonthlyLight } = useExpenses({
    period: 'month',
    month: initialMonth,
  });
  const [month, setMonth] = useState(initialMonth);
  const [value, setValue] = useState('100.00');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!snapshot) return;
      const current = snapshot.gastosMensais[month];
      const light = expenseCalculationService.calculateMonthlyLight(month, snapshot.gastosMensais);
      setValue(String(typeof current === 'number' ? current : (current?.luz ?? light)));
    }, 0);
    return () => clearTimeout(timer);
  }, [month, snapshot]);

  const save = async () => {
    setSaving(true);
    setError(undefined);
    try {
      await saveMonthlyLight({ month, light: normalizeMoney(value) ?? 0 });
      navigation.goBack();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Não foi possível salvar a luz mensal.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardScreen>
      <LargeTitleHeader onBack={() => navigation.goBack()} title="Luz mensal" />
      <ScrollView contentContainerStyle={{ gap: theme.spacing.md, padding: theme.spacing.md }}>
        <Input label="Mês (AAAA-MM)" value={month} onChangeText={setMonth} />
        <CurrencyInput
          label="Luz"
          value={value}
          onChangeText={setValue}
          helperText="Sem registro, o valor padrão histórico é R$ 100 para o mês atual ou passado e R$ 0 para mês futuro."
        />
        {loading ? (
          <Text style={{ color: theme.colors.textSecondary }}>Carregando valor...</Text>
        ) : null}
        <FormError message={error} />
        <SecondaryButton fullWidth onPress={() => navigation.goBack()}>
          Cancelar
        </SecondaryButton>
        <PrimaryButton fullWidth loading={saving} onPress={() => void save()}>
          Salvar valor
        </PrimaryButton>
      </ScrollView>
    </KeyboardScreen>
  );
}
