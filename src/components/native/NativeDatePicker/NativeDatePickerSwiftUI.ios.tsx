import { DatePicker, Host } from '@expo/ui/swift-ui';

import type { NativeDatePickerProps } from '@/types/native-ui';

export default function NativeDatePickerSwiftUI({ mode, onChange, value }: NativeDatePickerProps) {
  return (
    <Host matchContents>
      <DatePicker
        displayedComponents={[mode === 'date' ? 'date' : 'hourAndMinute']}
        onDateChange={onChange}
        selection={value}
      />
    </Host>
  );
}
