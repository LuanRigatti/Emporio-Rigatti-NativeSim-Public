import type { NativeButtonHaptic } from '@/types/native-ui';

export type NativeChipVariant = 'glass' | 'primary' | 'glassProminent';

export type NativeChipProps = {
  label: string;
  selected?: boolean;
  icon?: string;
  fallbackIcon?: string;
  variant?: NativeChipVariant;
  haptic?: NativeButtonHaptic;
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
};
