import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useAppTheme } from '@/theme';

export type HomeModeTitleProps = {
  accessibilityLabel: string;
  label: string;
  onPress: () => void;
};

export default function HomeModeTitleFallback({
  accessibilityLabel,
  label,
  onPress,
}: HomeModeTitleProps) {
  const { reduceMotionEnabled, theme } = useAppTheme();
  const pressedScale = reduceMotionEnabled
    ? theme.animations.reducedMotion.scale
    : theme.animations.scale.pressed;

  return (
    <Pressable
      accessibilityHint="Abre o seletor de modo"
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          marginLeft: -(theme.spacing.xxs * 2),
          transform: [{ scale: pressed ? pressedScale : 1 }],
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={[theme.typography.largeTitle, styles.title, { color: theme.colors.textPrimary }]}
      >
        {label}
      </Text>
      <Ionicons color={theme.colors.textSecondary} name="chevron-expand-outline" size={16} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  title: { fontFamily: 'System', fontSize: 36, fontWeight: '700' },
});
