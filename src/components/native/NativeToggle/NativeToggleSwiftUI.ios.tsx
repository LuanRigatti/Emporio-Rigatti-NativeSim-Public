import { Host, Toggle } from '@expo/ui/swift-ui';
import { toggleStyle } from '@expo/ui/swift-ui/modifiers';

import type { NativeToggleProps } from '@/types/native-ui';

export default function NativeToggleSwiftUI({ label, onValueChange, value }: NativeToggleProps) {
  return (
    <Host matchContents>
      <Toggle
        isOn={value}
        label={label}
        modifiers={[toggleStyle('switch')]}
        onIsOnChange={onValueChange}
      />
    </Host>
  );
}
