import { Pressable, StyleSheet } from 'react-native';

import { Avatar } from '@/components/feedback';
import { GlassSurface } from '@/components/premium';
import type { NativeAvatarButtonProps } from '@/types/native-ui';
import { useAppTheme } from '@/theme';
import { triggerNativeButtonHaptic } from '@/utils/haptics';

export default function NativeAvatarButtonFallback({
  accessibilityHint,
  accessibilityLabel,
  avatarSize = 'medium',
  containerSize,
  disabled = false,
  haptic = 'light',
  imageUri,
  name,
  onPress,
  style,
}: NativeAvatarButtonProps) {
  const { theme } = useAppTheme();
  const resolvedSize = containerSize ?? theme.sizes.touchTargetMinimum;

  return (
    <GlassSurface
      interactive={!disabled}
      style={[
        styles.surface,
        {
          borderRadius: resolvedSize / 2,
          height: resolvedSize,
          opacity: disabled ? theme.opacities.disabled : 1,
          width: resolvedSize,
        },
        style,
      ]}
    >
      <Pressable
        accessibilityHint={accessibilityHint}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => {
          triggerNativeButtonHaptic(haptic);
          onPress();
        }}
        style={({ pressed }) => [styles.button, { opacity: pressed ? theme.opacities.pressed : 1 }]}
      >
        <Avatar imageUri={imageUri ?? undefined} name={name} size={avatarSize} />
      </Pressable>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  surface: { overflow: 'hidden' },
  button: { alignItems: 'center', flex: 1, justifyContent: 'center' },
});
