import { DatePicker, Host } from '@expo/ui/swift-ui';
import { datePickerStyle } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet } from 'react-native';

import type { NativeDatePickerProps } from '@/types/native-ui';
import { roundedFont } from '../nativeTypography';

export default function NativeDatePickerSwiftUI({
  mode,
  onChange,
  style,
  value,
}: NativeDatePickerProps) {
  const isCompact = style === 'compact';
  const isGraphical = style === 'graphical';

  return (
    <Host
      ignoreSafeArea={isGraphical ? 'keyboard' : undefined}
      matchContents={isCompact || isGraphical ? false : true}
      style={isCompact ? styles.compactHost : isGraphical ? styles.graphicalHost : undefined}
    >
      <DatePicker
        displayedComponents={[mode === 'date' ? 'date' : 'hourAndMinute']}
        modifiers={[roundedFont({}), ...(style ? [datePickerStyle(style)] : [])]}
        onDateChange={onChange}
        selection={value}
      />
    </Host>
  );
}

const styles = StyleSheet.create({
  compactHost: {
    height: '100%',
    width: '100%',
  },
  graphicalHost: {
    flex: 1,
    width: '100%',
  },
});
