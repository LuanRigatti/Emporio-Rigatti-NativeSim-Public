import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, Text } from 'react-native';

import {
  CurrencyInput,
  DateInput,
  FormError,
  Input,
  KeyboardScreen,
  LargeTitleHeader,
  PrimaryButton,
  QuantityInput,
  SecondaryButton,
  SegmentedControl,
} from '@/components';
import { useExpenses } from '@/hooks/useExpenses';
import type { FinanceStackParamList } from '@/navigation/types';
import { EXPENSE_CUTOFFS } from '@/services/expenses';
import type { DailyExpenseDraft } from '@/types/data';
import { normalizeLegacyDate, normalizeMoney } from '@/utils/data';
import { useAppTheme } from '@/theme';

type Props = NativeStackScreenProps<FinanceStackParamList, 'DailyExpenseForm'>;

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

export function DailyExpenseForm({ navigation, route }: Props) {
  const { theme } = useAppTheme();
  const initialDate = route.params?.date ?? todayIso();
  const { snapshot, loading, saveDailyExpense } = useExpenses({ period: 'day', date: initialDate });
  const [date, setDate] = useState(initialDate);
  const [estar, setEstar] = useState('0');
  const [km, setKm] = useState('0');
  const [fuelPrice, setFuelPrice] = useState('0');
  const [legacyFuel, setLegacyFuel] = useState('0');
  const [fuelType, setFuelType] = useState<'etanol' | 'gasolina'>('gasolina');
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const existing = useMemo(() => {
    const normalized = normalizeLegacyDate(date) ?? date;
    return snapshot?.gastosDiarios[normalized];
  }, [date, snapshot]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!existing) return;
      setEstar(String(existing.estar ?? 0));
      setKm(String(existing.km ?? 0));
      setFuelPrice(String(existing.precoGasolina ?? 0));
      setLegacyFuel(String(existing.gasolina ?? 0));
      if (existing.tipoCombustivel === 'etanol') setFuelType('etanol');
      if (existing.tipoCombustivel === 'gasolina') setFuelType('gasolina');
    }, 0);
    return () => clearTimeout(timer);
  }, [existing]);

  const isCurrentFuelModel = date >= EXPENSE_CUTOFFS.currentFuelModel;

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setDatePickerVisible(Platform.OS !== 'ios' && event.type !== 'dismissed');
    if (selectedDate) setDate(formatDate(selectedDate));
  };

  const save = async () => {
    setSaving(true);
    setError(undefined);
    try {
      const draft: DailyExpenseDraft = {
        date,
        estar: normalizeMoney(estar) ?? 0,
        km: normalizeMoney(km) ?? 0,
        fuelPrice: normalizeMoney(fuelPrice) ?? 0,
        fuelType: isCurrentFuelModel ? fuelType : undefined,
        legacyFuelCost: isCurrentFuelModel ? undefined : (normalizeMoney(legacyFuel) ?? 0),
      };
      await saveDailyExpense(draft);
      navigation.goBack();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar o gasto.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardScreen>
      <LargeTitleHeader onBack={() => navigation.goBack()} title="Dados do dia" />
      <ScrollView contentContainerStyle={{ gap: theme.spacing.md, padding: theme.spacing.md }}>
        <DateInput
          label="Data"
          required
          value={date}
          onPress={() => setDatePickerVisible(true)}
          onClear={() => setDate('')}
        />
        {datePickerVisible && Platform.OS !== 'web' ? (
          <DateTimePicker value={parseDate(date)} mode="date" onChange={handleDateChange} />
        ) : null}
        {Platform.OS === 'web' ? (
          <Input label="Data (AAAA-MM-DD)" value={date} onChangeText={setDate} />
        ) : null}
        <CurrencyInput label="Estar" value={estar} onChangeText={setEstar} />
        {isCurrentFuelModel ? (
          <>
            <QuantityInput label="Quilometragem" value={km} onChangeText={setKm} />
            <CurrencyInput label="Preço por litro" value={fuelPrice} onChangeText={setFuelPrice} />
            <SegmentedControl
              options={[
                { value: 'etanol' as const, label: 'Etanol' },
                { value: 'gasolina' as const, label: 'Gasolina' },
              ]}
              value={fuelType}
              onChange={setFuelType}
            />
            <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
              O custo atual usa quilometragem, preço e média histórica do tipo selecionado.
            </Text>
          </>
        ) : (
          <CurrencyInput
            label="Combustível legado"
            value={legacyFuel}
            onChangeText={setLegacyFuel}
            helperText="Até 30/04/2026, o Ionic utiliza o campo gasolina como custo diário."
          />
        )}
        {loading ? (
          <Text style={{ color: theme.colors.textSecondary }}>Carregando registro...</Text>
        ) : null}
        <FormError message={error} />
        <SecondaryButton fullWidth onPress={() => navigation.goBack()}>
          Cancelar
        </SecondaryButton>
        <PrimaryButton fullWidth loading={saving} onPress={() => void save()}>
          Salvar gasto
        </PrimaryButton>
      </ScrollView>
    </KeyboardScreen>
  );
}
