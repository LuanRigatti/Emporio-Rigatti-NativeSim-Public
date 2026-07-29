import { NativeDropdown } from '@/components/native';
import { useAppTheme } from '@/theme';

import { getAvailableHistoryYears } from '../utils/historyDateUtils';

export type YearPickerProps = {
  year: number;
  onChange: (year: number) => void;
};

export function YearPicker({ onChange, year }: YearPickerProps) {
  const { theme } = useAppTheme();

  return (
    <NativeDropdown
      accessibilityLabel={`Ano selecionado: ${year}`}
      items={getAvailableHistoryYears().map((value) => ({ label: String(value), value }))}
      label={String(year)}
      onValueChange={onChange}
      selectedValue={year}
      color={theme.colors.textPrimary}
      variant="glass"
    />
  );
}
