import { Button, Host } from '@expo/ui/swift-ui';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { NativeButtonProps } from '@/types/native-ui';

export default function NativeButtonSwiftUI({
  disabled,
  destructive,
  label,
  onPress,
  systemImage,
}: NativeButtonProps) {
  return (
    <Host matchContents>
      <Button
        disabled={disabled}
        onPress={onPress}
        role={destructive ? 'destructive' : 'default'}
        systemImage={systemImage as SFSymbol | undefined}
        variant="glass"
      >
        {label}
      </Button>
    </Host>
  );
}
