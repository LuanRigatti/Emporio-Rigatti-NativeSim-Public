import { Host, Switch } from '@expo/ui/swift-ui';

import type { NativeToggleProps } from '@/types/native-ui';

export default function NativeToggleSwiftUI({ label, onValueChange, value }: NativeToggleProps) {
  return (
    <Host matchContents>
      <Switch label={label} onValueChange={onValueChange} value={value} variant="switch" />
    </Host>
  );
}
