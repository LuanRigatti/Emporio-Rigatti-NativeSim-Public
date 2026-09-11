import NativeGlassIconButton from '../NativeGlassIconButton';
import type { NativeGlassBackButtonProps } from './NativeGlassBackButton.types';
import { getLiquidGlassTint, useAppTheme } from '@/theme';

export default function NativeGlassBackButton({
  accessibilityLabel = 'Voltar',
  ...props
}: NativeGlassBackButtonProps) {
  const { resolvedMode } = useAppTheme();

  return (
    <NativeGlassIconButton
      accessibilityLabel={accessibilityLabel}
      fallbackIcon="chevron-back"
      glassTint={getLiquidGlassTint(resolvedMode)}
      interactiveGlass
      systemImage="chevron.left"
      {...props}
    />
  );
}
