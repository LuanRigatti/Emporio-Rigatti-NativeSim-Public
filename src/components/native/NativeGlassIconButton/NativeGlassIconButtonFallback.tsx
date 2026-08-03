import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text } from 'react-native';

import { GlassSurface } from '@/components/premium';
import { useAppTheme } from '@/theme';
import type { NativeGlassIconButtonProps } from '@/types/native-ui';

export default function NativeGlassIconButtonFallback({
  accessibilityLabel,
  color,
  containerSize,
  containerWidth,
  disabled = false,
  fallbackIcon,
  label,
  onPress,
  size,
  shape = 'circle',
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
          width: containerWidth ?? surfaceSize,
          ...(shape === 'circle' ? { borderRadius: surfaceSize / 2 } : {}),
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
        {label ? (
          <Text style={[styles.label, { color: iconColor }]}>{label}</Text>
        ) : fallbackIcon ? (
          <Ionicons color={iconColor} name={fallbackIcon} size={iconSize} />
        ) : null}
      </Pressable>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  surface: { overflow: 'hidden' },
  button: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  label: { fontSize: 17, fontWeight: '600' },
});
