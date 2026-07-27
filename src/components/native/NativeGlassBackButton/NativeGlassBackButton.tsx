import NativeGlassIconButton from '../NativeGlassIconButton';
import type { NativeGlassBackButtonProps } from './NativeGlassBackButton.types';

export default function NativeGlassBackButton({
  accessibilityLabel = 'Voltar',
  ...props
}: NativeGlassBackButtonProps) {
  return (
    <NativeGlassIconButton
      accessibilityLabel={accessibilityLabel}
      fallbackIcon="chevron-back"
      systemImage="chevron.left"
      {...props}
    />
  );
}
