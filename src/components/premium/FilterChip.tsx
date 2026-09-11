import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme';
import { triggerSelectionHaptic } from '@/utils/haptics';

import { AnimatedPressable } from './AnimatedPressable';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type FilterChipProps = {
  label: string;
  selected?: boolean;
  icon?: IconName;
  onPress: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function FilterChip({
  accessibilityLabel,
  icon,
  label,
  onPress,
  selected = false,
  style,
}: FilterChipProps) {
  const { theme } = useAppTheme();
  const foreground = selected ? theme.colors.textInverse : theme.colors.textPrimary;

  return (
    <AnimatedPressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        triggerSelectionHaptic();
        onPress();
      }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.colors.primary : theme.colors.surfaceMuted,
          borderColor: selected ? theme.colors.primary : theme.colors.separator,
          borderRadius: theme.radius.pill,
          minHeight: theme.sizes.touchTargetMinimum,
          paddingHorizontal: theme.spacing.md,
          gap: theme.spacing.xs,
        },
        style,
      ]}
    >
      {icon ? <Ionicons color={foreground} name={icon} size={theme.sizes.iconSmall} /> : null}
      <Text style={[theme.typography.subheadline, { color: foreground }]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
