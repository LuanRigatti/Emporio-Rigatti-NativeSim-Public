import { BottomSheet } from '@/components/premium';
import type { NativeSheetProps } from '@/types/native-ui';

export default function NativeSheetExpo({
  accessibilityLabel,
  children,
  onVisibleChange,
  title,
  visible,
}: NativeSheetProps) {
  return (
    <BottomSheet
      accessibilityLabel={accessibilityLabel}
      onClose={() => onVisibleChange(false)}
      title={title}
      visible={visible}
    >
      {children}
    </BottomSheet>
  );
}
