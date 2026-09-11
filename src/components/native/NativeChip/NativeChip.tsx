import { NativeButton } from '../NativeButton';
import type { NativeChipProps } from './NativeChip.types';

export default function NativeChip({
  accessibilityLabel,
  disabled,
  fallbackIcon,
  haptic = 'selection',
  icon,
  label,
  onPress,
  selected = false,
  variant,
}: NativeChipProps) {
  const resolvedVariant = variant ?? (selected ? 'primary' : 'glass');

  return (
    <NativeButton
      accessibilityLabel={accessibilityLabel ?? `Filtro ${label}`}
      accessibilityValue={selected ? 'Selecionado' : 'Não selecionado'}
      disabled={disabled}
      fallbackIcon={fallbackIcon}
      haptic={haptic}
      label={label}
      onPress={onPress}
      systemImage={icon}
      variant={resolvedVariant === 'glassProminent' ? 'primary' : resolvedVariant}
    />
  );
}
