import { DatePicker, Host } from '@expo/ui/swift-ui';
import { datePickerStyle } from '@expo/ui/swift-ui/modifiers';

import type { NativeDatePickerProps } from '@/types/native-ui';

export default function NativeDatePickerSwiftUI({
  mode,
  onChange,
  style,
  value,
}: NativeDatePickerProps) {
  return (
    <Host matchContents>
      <DatePicker
        displayedComponents={[mode === 'date' ? 'date' : 'hourAndMinute']}
        modifiers={style ? [datePickerStyle(style)] : undefined}
        onDateChange={onChange}
        selection={value}
      />
    </Host>
  );
}
