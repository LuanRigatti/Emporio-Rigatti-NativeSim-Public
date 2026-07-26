import { DateTimePicker, Host } from '@expo/ui/swift-ui';

import type { NativeDatePickerProps } from '@/types/native-ui';

export default function NativeDatePickerSwiftUI({ mode, onChange, value }: NativeDatePickerProps) {
  return (
    <Host matchContents>
      <DateTimePicker
        displayedComponents={mode === 'date' ? 'date' : 'hourAndMinute'}
        initialDate={value.toISOString()}
        onDateSelected={onChange}
        variant="automatic"
      />
    </Host>
  );
}
