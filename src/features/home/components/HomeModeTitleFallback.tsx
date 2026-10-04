import { Pressable, StyleSheet, Text } from 'react-native';

import { useAppTheme } from '@/theme';

export type HomeModeTitleProps = {
  accessibilityLabel: string;
  compact?: boolean;
  label: string;
  onPress: () => void;
};

export default function HomeModeTitleFallback({
  accessibilityLabel,
  compact = false,
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
        style={[
          compact ? theme.typography.headline : theme.typography.largeTitle,
          styles.title,
          compact ? styles.compactTitle : undefined,
          { color: theme.colors.textPrimary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  title: { fontFamily: 'System', fontSize: 36, fontWeight: '700' },
  compactTitle: { fontSize: 17, fontWeight: '600' },
});
