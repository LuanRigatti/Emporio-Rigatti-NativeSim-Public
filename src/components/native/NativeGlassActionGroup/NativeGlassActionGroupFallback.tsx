import { StyleSheet, View } from 'react-native';

import NativeGlassIconButton from '../NativeGlassIconButton/NativeGlassIconButton';
import type { NativeGlassActionGroupProps } from './NativeGlassActionGroup.types';

export default function NativeGlassActionGroupFallback({
  color,
  disabled,
  leadingAccessibilityLabel,
  leadingFallbackIcon,
  leadingSystemImage,
  onLeadingPress,
  onTrailingPress,
  size,
  trailingAccessibilityLabel,
  trailingFallbackIcon,
  trailingSystemImage,
}: NativeGlassActionGroupProps) {
  return (
    <View style={styles.group}>
      <NativeGlassIconButton
        accessibilityLabel={leadingAccessibilityLabel}
        color={color}
        disabled={disabled}
        fallbackIcon={leadingFallbackIcon}
        interactiveGlass
        onPress={onLeadingPress}
        size={size}
        systemImage={leadingSystemImage}
      />
      <NativeGlassIconButton
        accessibilityLabel={trailingAccessibilityLabel}
        color={color}
        disabled={disabled}
        fallbackIcon={trailingFallbackIcon}
        interactiveGlass
        onPress={onTrailingPress}
        size={size}
        systemImage={trailingSystemImage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', gap: 8 },
});
