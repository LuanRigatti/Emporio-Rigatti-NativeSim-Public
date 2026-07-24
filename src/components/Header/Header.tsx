import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewProps } from 'react-native';

import { colors, spacing, typography } from '@/theme';

export type HeaderProps = ViewProps & {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: ReactNode;
};

export function Header({ title, subtitle, onBack, rightAction, style, ...props }: HeaderProps) {
  return (
    <View style={[styles.container, style]} {...props}>
      {onBack ? (
        <Pressable
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          hitSlop={spacing.sm}
          onPress={onBack}
          style={styles.backButton}
        >
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
      ) : null}
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightAction ? <View style={styles.action}>{rightAction}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  content: {
    flex: 1,
  },
  title: {
    ...typography.heading2,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.subheadline,
    color: colors.text.secondary,
    marginTop: 2,
  },
  backButton: {
    width: 32,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 36,
    lineHeight: 36,
    color: colors.brand.primary,
    fontWeight: '300',
  },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
