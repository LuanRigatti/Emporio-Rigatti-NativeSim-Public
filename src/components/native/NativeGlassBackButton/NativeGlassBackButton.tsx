import NativeGlassIconButton from '../NativeGlassIconButton';
import type { NativeGlassBackButtonProps } from './NativeGlassBackButton.types';
import { lightModeLiquidGlassTint, useAppTheme } from '@/theme';

export default function NativeGlassBackButton({
  accessibilityLabel = 'Voltar',
  ...props
}: NativeGlassBackButtonProps) {
  const { resolvedMode } = useAppTheme();

  return (
    <NativeGlassIconButton
      accessibilityLabel={accessibilityLabel}
      fallbackIcon="chevron-back"
      glassTint={resolvedMode === 'light' ? lightModeLiquidGlassTint : undefined}
      interactiveGlass
      systemImage="chevron.left"
      {...props}
    />
  );
}
