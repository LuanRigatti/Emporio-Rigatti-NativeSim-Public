import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Platform, ScrollView, Text } from 'react-native';

import {
  DateInput,
  FormError,
  Input,
  KeyboardScreen,
  LargeTitleHeader,
  PrimaryButton,
  QuantityInput,
  SecondaryButton,
} from '@/components';
import { useFactoryReceipts } from '@/hooks/useFactoryReceipts';
import type { FinanceStackParamList } from '@/navigation/types';
import { factoryCalculationService } from '@/services/finance';
import { formatCurrency, normalizeMoney } from '@/utils/data';
import { useFinancialPrivacy } from '@/hooks/useFinancialPrivacy';
import { useAppTheme } from '@/theme';

type Props = NativeStackScreenProps<FinanceStackParamList, 'FinanceFactoryForm'>;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseDate(value: string): Date {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function FactoryReceiptFormScreen({ navigation }: Props) {
  const { theme } = useAppTheme();
  const { hidden } = useFinancialPrivacy();
  const { create } = useFactoryReceipts({ period: 'all' });
  const [quantity, setQuantity] = useState('');
  const [date, setDate] = useState(todayIso());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const calculatedValue = factoryCalculationService.calculateReceiptTotal(
    normalizeMoney(quantity) ?? 0,
    date,
  );

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setDatePickerVisible(Platform.OS !== 'ios' && event.type !== 'dismissed');
    if (selectedDate) setDate(formatDate(selectedDate));
  };

  const save = async () => {
    setSaving(true);
    setError(undefined);
    try {
      await create({ quantity: normalizeMoney(quantity) ?? 0, date });
      navigation.goBack();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardScreen>
      <LargeTitleHeader onBack={() => navigation.goBack()} title="Novo recebimento" />
      <ScrollView contentContainerStyle={{ gap: theme.spacing.md, padding: theme.spacing.md }}>
        <QuantityInput
          label="Quantidade de baldes"
          required
          value={quantity}
          onChangeText={setQuantity}
        />
        <DateInput
          label="Data do recebimento"
          required
          value={date}
          onPress={() => setDatePickerVisible(true)}
          onClear={() => setDate('')}
        />
        {datePickerVisible && Platform.OS !== 'web' ? (
          <DateTimePicker value={parseDate(date)} mode="date" onChange={handleDateChange} />
        ) : null}
        {Platform.OS === 'web' ? (
          <Input label="Data (AAAA-MM-DD)" required value={date} onChangeText={setDate} />
        ) : null}
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          Valor total calculado: {hidden ? '••••' : formatCurrency(calculatedValue)}
        </Text>
        <FormError message={error} />
        <SecondaryButton fullWidth onPress={() => navigation.goBack()}>
          Cancelar
        </SecondaryButton>
        <PrimaryButton fullWidth loading={saving} onPress={() => void save()}>
          Registrar recebimento
        </PrimaryButton>
      </ScrollView>
    </KeyboardScreen>
  );
}
