import { BottomSheet, Group, Host } from '@expo/ui/swift-ui';
import {
  presentationBackground,
  presentationBackgroundInteraction as setPresentationBackgroundInteraction,
  presentationDetents,
  presentationDragIndicator,
} from '@expo/ui/swift-ui/modifiers';

import type { NativeSheetProps } from '@/types/native-ui';

export default function NativeSheetSwiftUI({
  children,
  detents,
  onVisibleChange,
  presentationBackgroundInteraction: backgroundInteraction = 'enabled',
  presentationBackgroundColor,
  visible,
}: NativeSheetProps) {
  const sheetDetents = detents ?? [{ fraction: 0.48 }, 'large'];
  const presentationModifiers = [
    presentationDetents([...sheetDetents]),
    presentationDragIndicator('visible'),
    setPresentationBackgroundInteraction(backgroundInteraction),
    ...(presentationBackgroundColor ? [presentationBackground(presentationBackgroundColor)] : []),
  ];

  return (
    <Host matchContents>
      <BottomSheet isPresented={visible} onIsPresentedChange={onVisibleChange}>
        <Group modifiers={presentationModifiers}>{children}</Group>
      </BottomSheet>
    </Host>
  );
}
