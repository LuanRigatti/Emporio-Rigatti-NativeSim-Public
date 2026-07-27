import { Host, Image } from '@expo/ui/swift-ui';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { HistorySymbolIconProps } from './HistorySymbolIcon.types';

export default function HistorySymbolIconSwiftUI({
  color,
  size,
  systemName,
}: HistorySymbolIconProps) {
  return (
    <Host matchContents>
      <Image color={color} size={size} systemName={systemName as SFSymbol} />
    </Host>
  );
}
