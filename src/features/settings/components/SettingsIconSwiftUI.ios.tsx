import { Host, Image } from '@expo/ui/swift-ui';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { SettingsIconProps } from './SettingsIcon.types';

export default function SettingsIconSwiftUI({ color, size, systemName }: SettingsIconProps) {
  return (
    <Host matchContents>
      <Image color={color} size={size} systemName={systemName as SFSymbol} />
    </Host>
  );
}
