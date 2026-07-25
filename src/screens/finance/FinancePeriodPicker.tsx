import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import {
  BottomSheet,
  FormError,
  Input,
  ListItem,
  PrimaryButton,
  SecondaryButton,
} from '@/components';
import type { FinancialPeriodSelection } from '@/types/data';
import { useAppTheme } from '@/theme';

type PickerKind = FinancialPeriodSelection['kind'];

type Props = {
  visible: boolean;
  selection: FinancialPeriodSelection;
  availableYears: readonly string[];
  onClose: () => void;
  onApply: (selection: FinancialPeriodSelection) => void;
};

const monthNames = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const kinds: readonly { value: PickerKind; label: string }[] = [
  { value: 'day', label: 'Hoje' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
  { value: 'year', label: 'Ano' },
  { value: 'all', label: 'Tudo' },
  { value: 'range', label: 'Personalizado' },
];

function todayIso(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate(),
  ).padStart(2, '0')}`;
}

function selectionParts(selection: FinancialPeriodSelection) {
  const today = todayIso();
  if (selection.kind === 'month') {
    const [year, month] = selection.month.split('-');
    return {
      kind: selection.kind,
      date: today,
      month: month ?? today.slice(5, 7),
      year: year ?? today.slice(0, 4),
      start: today,
      end: today,
    };
  }
  if (selection.kind === 'year') {
    return {
      kind: selection.kind,
      date: today,
      month: today.slice(5, 7),
      year: selection.year,
      start: today,
      end: today,
    };
  }
  if (selection.kind === 'range') {
    return {
      kind: selection.kind,
      date: today,
      month: today.slice(5, 7),
      year: today.slice(0, 4),
      start: selection.start,
      end: selection.end,
    };
  }
  if (selection.kind === 'day' || selection.kind === 'week') {
    return {
      kind: selection.kind,
      date: selection.date,
      month: selection.date.slice(5, 7),
      year: selection.date.slice(0, 4),
      start: selection.date,
      end: selection.date,
    };
  }
  return {
    kind: selection.kind,
    date: today,
    month: today.slice(5, 7),
    year: today.slice(0, 4),
    start: today,
    end: today,
  };
}

function validIsoDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime())
  );
}

export function FinancePeriodPicker({
  visible,
  selection,
  availableYears,
  onClose,
  onApply,
}: Props) {
  const { theme } = useAppTheme();
  const initial = useMemo(() => selectionParts(selection), [selection]);
  const [kind, setKind] = useState<PickerKind>(initial.kind);
  const [date, setDate] = useState(initial.date);
  const [month, setMonth] = useState(initial.month);
  const [year, setYear] = useState(initial.year);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [error, setError] = useState<string | undefined>();

  const years = useMemo(() => {
    const values = [String(new Date().getFullYear()), ...availableYears, year];
    return values
      .filter((item, index) => values.indexOf(item) === index)
      .sort((left, right) => right.localeCompare(left));
  }, [availableYears, year]);

  const apply = () => {
    if ((kind === 'day' || kind === 'week') && !validIsoDate(date)) {
      setError('Informe uma data válida no formato AAAA-MM-DD.');
      return;
    }
    if (kind === 'range' && (!validIsoDate(start) || !validIsoDate(end) || start > end)) {
      setError('Informe um intervalo válido, com início antes do fim.');
      return;
    }
    const next: FinancialPeriodSelection =
      kind === 'day' || kind === 'week'
        ? { kind, date }
        : kind === 'month'
          ? { kind, month: `${year}-${month}` }
          : kind === 'year'
            ? { kind, year }
            : kind === 'range'
              ? { kind, start, end }
              : { kind: 'all' };
    onApply(next);
    onClose();
  };

  return (
    <BottomSheet onClose={onClose} title="Selecionar período" visible={visible}>
      <ScrollView
        contentContainerStyle={{ gap: theme.spacing.sm }}
        showsVerticalScrollIndicator={false}
      >
        {kinds.map((option) => (
          <ListItem
            key={option.value}
            onPress={() => {
              setKind(option.value);
              setError(undefined);
            }}
            title={option.label}
            trailing={
              <Text
                style={[
                  theme.typography.headline,
                  {
                    color: kind === option.value ? theme.colors.primary : theme.colors.textTertiary,
                  },
                ]}
              >
                {kind === option.value ? '✓' : ''}
              </Text>
            }
          />
        ))}

        {kind === 'month' ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
              Ano
            </Text>
            <View style={{ gap: theme.spacing.xs }}>
              {years.map((option) => (
                <ListItem
                  key={option}
                  onPress={() => setYear(option)}
                  title={option}
                  trailing={
                    <Text
                      style={[
                        theme.typography.body,
                        {
                          color: option === year ? theme.colors.primary : theme.colors.textTertiary,
                        },
                      ]}
                    >
                      {option === year ? '✓' : ''}
                    </Text>
                  }
                />
              ))}
            </View>
            <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
              Mês
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
              {monthNames.map((label, index) => {
                const value = String(index + 1).padStart(2, '0');
                const selected = value === month;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${label} ${year}`}
                    key={value}
                    onPress={() => setMonth(value)}
                    style={({ pressed }) => ({
                      alignItems: 'center',
                      backgroundColor: selected ? theme.colors.brand : theme.colors.surface,
                      borderColor: selected ? theme.colors.primary : theme.colors.borderStrong,
                      borderRadius: theme.radius.md,
                      borderWidth: theme.borders.width.thin,
                      minHeight: theme.sizes.touchTargetMinimum,
                      opacity: pressed ? theme.opacities.pressed : 1,
                      paddingHorizontal: theme.spacing.sm,
                      paddingVertical: theme.spacing.xs,
                      width: '31%',
                    })}
                  >
                    <Text
                      style={[
                        theme.typography.caption,
                        { color: selected ? theme.colors.primary : theme.colors.textSecondary },
                      ]}
                    >
                      {label.slice(0, 3)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {kind === 'year' ? (
          <View style={{ gap: theme.spacing.xs }}>
            <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
              Ano
            </Text>
            {years.map((option) => (
              <ListItem
                key={option}
                onPress={() => setYear(option)}
                title={option}
                trailing={
                  <Text
                    style={[
                      theme.typography.body,
                      { color: option === year ? theme.colors.primary : theme.colors.textTertiary },
                    ]}
                  >
                    {option === year ? '✓' : ''}
                  </Text>
                }
              />
            ))}
          </View>
        ) : null}

        {kind === 'day' || kind === 'week' ? (
          <Input
            label={kind === 'day' ? 'Data' : 'Data de referência'}
            value={date}
            onChangeText={setDate}
            placeholder="AAAA-MM-DD"
            autoCapitalize="none"
          />
        ) : null}

        {kind === 'range' ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Input
              label="Início"
              value={start}
              onChangeText={setStart}
              placeholder="AAAA-MM-DD"
              autoCapitalize="none"
            />
            <Input
              label="Fim"
              value={end}
              onChangeText={setEnd}
              placeholder="AAAA-MM-DD"
              autoCapitalize="none"
            />
          </View>
        ) : null}

        <FormError message={error} />
        <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
          <PrimaryButton fullWidth label="Aplicar período" onPress={apply} />
          <SecondaryButton fullWidth label="Cancelar" onPress={onClose} />
        </View>
      </ScrollView>
    </BottomSheet>
  );
}
