import { BottomSheet, Group, Host } from '@expo/ui/swift-ui';
import { presentationDetents, presentationDragIndicator } from '@expo/ui/swift-ui/modifiers';

import type { NativeSheetProps } from '@/types/native-ui';

export default function NativeSheetSwiftUI({
  children,
  onVisibleChange,
  visible,
}: NativeSheetProps) {
  return (
    <Host matchContents>
      <BottomSheet isPresented={visible} onIsPresentedChange={onVisibleChange}>
        <Group
          modifiers={[
            presentationDetents([{ fraction: 0.48 }, 'large']),
            presentationDragIndicator('visible'),
          ]}
        >
          {children}
        </Group>
      </BottomSheet>
    </Host>
  );
}
