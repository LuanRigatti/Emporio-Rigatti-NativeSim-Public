import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';

import { GlassSurface } from './GlassSurface';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type FloatingButtonProps = {
  icon?: IconName;
  label?: string;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

export function FloatingButton({
  accessibilityHint,
  accessibilityLabel,
  icon = 'add',
  label,
  onPress,
  style,
}: FloatingButtonProps) {
  const { theme } = useAppTheme();

  return (
    <GlassSurface
      interactive
      style={[
        styles.surface,
        {
          borderRadius: theme.radius.pill,
          minHeight: theme.sizes.touchTargetMinimum,
          minWidth: theme.sizes.touchTargetMinimum,
          paddingHorizontal: label ? theme.spacing.md : 0,
        },
        style,
      ]}
    >
      <Pressable
        accessibilityHint={accessibilityHint}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        onPress={() => {
          triggerLightImpactHaptic();
          onPress();
        }}
        style={({ pressed }) => [
          styles.button,
          {
            gap: theme.spacing.xs,
            minHeight: theme.sizes.touchTargetMinimum,
            opacity: pressed ? theme.opacities.pressed : 1,
          },
        ]}
      >
        <Ionicons color={theme.colors.textPrimary} name={icon} size={theme.sizes.iconMedium} />
        {label ? (
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
            {label}
          </Text>
        ) : null}
      </Pressable>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  surface: { alignSelf: 'flex-start', overflow: 'hidden' },
  button: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
});
