import { Host, Toggle } from '@expo/ui/swift-ui';
import { frame, toggleStyle } from '@expo/ui/swift-ui/modifiers';

import type { NativeToggleProps } from '@/types/native-ui';

export default function NativeToggleSwiftUI({ label, onValueChange, value }: NativeToggleProps) {
  return (
    <Host style={{ minHeight: 44, width: '100%' }}>
      <Toggle
        isOn={value}
        label={label}
        modifiers={[toggleStyle('switch'), frame({ maxWidth: Infinity, alignment: 'leading' })]}
        onIsOnChange={onValueChange}
      />
    </Host>
  );
}
