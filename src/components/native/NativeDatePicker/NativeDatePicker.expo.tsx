import DateTimePicker from '@react-native-community/datetimepicker';

import type { NativeDatePickerProps } from '@/types/native-ui';

export default function NativeDatePickerExpo({
  accessibilityLabel,
  maximumDate,
  minimumDate,
  mode,
  onChange,
  value,
}: NativeDatePickerProps) {
  return (
    <DateTimePicker
      accessibilityLabel={accessibilityLabel}
      maximumDate={maximumDate}
      minimumDate={minimumDate}
      mode={mode}
      onChange={(_, nextValue) => {
        if (nextValue) {
          onChange(nextValue);
        }
      }}
      value={value}
    />
  );
}
