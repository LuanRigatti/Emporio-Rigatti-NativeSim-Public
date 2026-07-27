import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';

import { GlassSurface } from '@/components/premium';
import { useAppTheme } from '@/theme';
import type { NativeGlassIconButtonProps } from '@/types/native-ui';

export default function NativeGlassIconButtonFallback({
  accessibilityLabel,
  color,
  containerSize,
  disabled = false,
  fallbackIcon,
  onPress,
  size,
  style,
}: NativeGlassIconButtonProps) {
  const { theme } = useAppTheme();
  const iconColor = color ?? theme.colors.textPrimary;
  const iconSize = size ?? theme.sizes.iconMedium;
  const surfaceSize = containerSize ?? theme.sizes.touchTargetMinimum;

  return (
    <GlassSurface
      interactive={!disabled}
      style={[
        styles.surface,
        {
          borderRadius: theme.radius.pill,
          height: surfaceSize,
          opacity: disabled ? theme.opacities.disabled : 1,
          width: surfaceSize,
        },
        style,
      ]}
    >
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [styles.button, { opacity: pressed ? theme.opacities.pressed : 1 }]}
      >
        <Ionicons color={iconColor} name={fallbackIcon} size={iconSize} />
      </Pressable>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  surface: { overflow: 'hidden' },
  button: { alignItems: 'center', flex: 1, justifyContent: 'center' },
});
