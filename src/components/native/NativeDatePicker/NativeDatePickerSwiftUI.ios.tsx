import { DatePicker, Host } from '@expo/ui/swift-ui';
import { datePickerStyle } from '@expo/ui/swift-ui/modifiers';

import type { NativeDatePickerProps } from '@/types/native-ui';
import { roundedFont } from '../nativeTypography';

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
        modifiers={[roundedFont({}), ...(style ? [datePickerStyle(style)] : [])]}
        onDateChange={onChange}
        selection={value}
      />
    </Host>
  );
}
