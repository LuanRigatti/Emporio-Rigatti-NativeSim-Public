import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';

import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';

import { AnimatedPressable } from './AnimatedPressable';
import { GlassSurface } from './GlassSurface';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type FloatingActionProps = {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
};

export function FloatingAction({
  icon,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: FloatingActionProps) {
  const { theme } = useAppTheme();

  return (
    <GlassSurface
      style={[
        styles.surface,
        {
          borderRadius: theme.radius.pill,
          minHeight: theme.sizes.touchTargetMinimum,
          minWidth: theme.sizes.touchTargetMinimum,
        },
      ]}
    >
      <AnimatedPressable
        onPress={() => {
          triggerLightImpactHaptic();
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={styles.button}
      >
        <Ionicons name={icon} size={theme.sizes.iconMedium} color={theme.colors.textPrimary} />
      </AnimatedPressable>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  surface: { overflow: 'hidden' },
  button: { alignItems: 'center', justifyContent: 'center', minHeight: '100%', minWidth: '100%' },
});
