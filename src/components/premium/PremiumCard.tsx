import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme';

import { AnimatedPressable, type AnimatedPressableProps } from './AnimatedPressable';

export type PremiumCardProps = {
  children: ReactNode;
  onPress?: AnimatedPressableProps['onPress'];
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function PremiumCard({ children, onPress, style, accessibilityLabel }: PremiumCardProps) {
  const { theme } = useAppTheme();
  const cardStyle = [
    styles.card,
    {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.separator,
      borderRadius: theme.radius.card,
      padding: theme.spacing.lg,
    },
    style,
  ];

  if (onPress) {
    return (
      <AnimatedPressable
        onPress={onPress}
        style={cardStyle}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </AnimatedPressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 0 },
});
