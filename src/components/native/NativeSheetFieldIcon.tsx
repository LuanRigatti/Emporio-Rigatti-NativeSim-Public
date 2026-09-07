import { Circle, Image, ZStack } from '@expo/ui/swift-ui';
import { frame, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useAppTheme } from '@/theme';

const NATIVE_SHEET_ICON_SIZE = 54;
const NATIVE_SHEET_SYMBOL_SIZE = 21;

export default function NativeSheetFieldIcon({ systemImage }: { systemImage: SFSymbol }) {
  const { resolvedMode, theme } = useAppTheme();
  const surface = resolvedMode === 'dark' ? '#2C2C2E' : '#F2F2F7';

  return (
    <ZStack
      alignment="center"
      modifiers={[frame({ width: NATIVE_SHEET_ICON_SIZE, height: NATIVE_SHEET_ICON_SIZE })]}
    >
      <Circle
        modifiers={[
          frame({ width: NATIVE_SHEET_ICON_SIZE, height: NATIVE_SHEET_ICON_SIZE }),
          foregroundStyle(surface),
        ]}
      />
      <Image
        color={theme.colors.textPrimary}
        size={NATIVE_SHEET_SYMBOL_SIZE}
        systemName={systemImage}
      />
    </ZStack>
  );
}
