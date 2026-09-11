import { useState } from 'react';
import { Text, View } from 'react-native';

import { ListItem, SegmentedControl } from '@/components';
import { formatFinancialPeriodLabel } from '@/services/finance';
import type { FinancialPeriodSelection } from '@/types/data';
import { useAppTheme } from '@/theme';

import { FinancePeriodPicker } from './FinancePeriodPicker';

type Props = {
  selection: FinancialPeriodSelection;
  availableYears: readonly string[];
  onChange: (selection: FinancialPeriodSelection) => void;
};

type QuickPeriod = 'day' | 'month' | 'all';

function currentMonth(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function today(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function FinancePeriodControl({ selection, availableYears, onChange }: Props) {
  const { theme } = useAppTheme();
  const [visible, setVisible] = useState(false);
  const quickValue: QuickPeriod =
    selection.kind === 'day' ? 'day' : selection.kind === 'all' ? 'all' : 'month';
  const label =
    selection.kind === 'month'
      ? 'Mês selecionado'
      : selection.kind === 'year'
        ? 'Ano selecionado'
        : selection.kind === 'range'
          ? 'Intervalo selecionado'
          : selection.kind === 'week'
            ? 'Semana selecionada'
            : selection.kind === 'day'
              ? 'Hoje'
              : 'Todo o histórico';

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <SegmentedControl
        options={[
          { value: 'day' as const, label: 'Hoje' },
          { value: 'month' as const, label: 'Mês' },
          { value: 'all' as const, label: 'Tudo' },
        ]}
        value={quickValue}
        onChange={(value) => {
          if (value === 'day') onChange({ kind: 'day', date: today() });
          else if (value === 'all') onChange({ kind: 'all' });
          else {
            onChange(
              selection.kind === 'month' ? selection : { kind: 'month', month: currentMonth() },
            );
            setVisible(true);
          }
        }}
      />
      <ListItem
        onPress={() => setVisible(true)}
        subtitle={`${label} · escolha mês, ano, semana ou intervalo personalizado`}
        title={formatFinancialPeriodLabel(selection)}
        trailing={
          <Text style={[theme.typography.body, { color: theme.colors.primary }]}>Alterar</Text>
        }
      />
      <FinancePeriodPicker
        availableYears={availableYears}
        key={`${selection.kind}-${visible ? 'open' : 'closed'}`}
        onApply={onChange}
        onClose={() => setVisible(false)}
        selection={selection}
        visible={visible}
      />
    </View>
  );
}
