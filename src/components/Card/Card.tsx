import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { borders, colors, radius, shadows, spacing } from '@/theme';

export type CardProps = ViewProps & {
  children: ReactNode;
  elevated?: boolean;
};

export function Card({ children, elevated = false, style, ...props }: CardProps) {
  return (
    <View style={[styles.base, elevated ? shadows.elevated : shadows.card, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.background.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: borders.width.hairline,
    borderStyle: borders.style,
    borderColor: colors.border.subtle,
  },
});
