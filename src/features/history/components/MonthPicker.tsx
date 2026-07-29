import { NativeDropdown } from '@/components/native';
import { useAppTheme } from '@/theme';

import { HISTORY_MONTH_NAMES } from '../utils/historyDateUtils';

export type MonthPickerProps = {
  month: number;
  onChange: (month: number) => void;
};

export function MonthPicker({ month, onChange }: MonthPickerProps) {
  const { theme } = useAppTheme();

  return (
    <NativeDropdown
      accessibilityLabel={`Mês selecionado: ${HISTORY_MONTH_NAMES[month - 1]}`}
      items={HISTORY_MONTH_NAMES.map((label, index) => ({ label, value: index + 1 }))}
      label={HISTORY_MONTH_NAMES[month - 1]}
      onValueChange={onChange}
      selectedValue={month}
      color={theme.colors.textPrimary}
      variant="glass"
    />
  );
}
