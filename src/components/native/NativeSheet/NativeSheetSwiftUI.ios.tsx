import { BottomSheet, Host } from '@expo/ui/swift-ui';

import type { NativeSheetProps } from '@/types/native-ui';

export default function NativeSheetSwiftUI({
  children,
  onVisibleChange,
  visible,
}: NativeSheetProps) {
  return (
    <Host style={{ flex: 1 }}>
      <BottomSheet isPresented={visible} onIsPresentedChange={onVisibleChange}>
        {children}
      </BottomSheet>
    </Host>
  );
}
