import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

import { Card, type CardProps } from './Card';

export type InfoCardVariant = 'info' | 'success' | 'warning' | 'neutral';

export type InfoCardProps = Omit<CardProps, 'children'> & {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  variant?: InfoCardVariant;
};

const variantStyles: Record<InfoCardVariant, { surface: string; accent: string }> = {
  info: {
    surface: colors.feedback.infoSurface,
    accent: colors.feedback.info,
  },
  success: {
    surface: colors.feedback.positiveSurface,
    accent: colors.feedback.positive,
  },
  warning: {
    surface: colors.feedback.warningSurface,
    accent: colors.feedback.warning,
  },
  neutral: {
    surface: colors.background.muted,
    accent: colors.text.secondary,
  },
};

export function InfoCard({
  title,
  description,
  icon,
  action,
  variant = 'info',
  ...props
}: InfoCardProps) {
  const palette = variantStyles[variant];

  return (
    <Card {...props} style={[styles.card, props.style]}>
      <View style={[styles.iconContainer, { backgroundColor: palette.surface }]}>
        {icon ? icon : <View style={[styles.iconFallback, { backgroundColor: palette.accent }]} />}
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
        {action ? <View style={styles.action}>{action}</View> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFallback: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
  },
  content: {
    flex: 1,
  },
  title: {
    ...typography.bodyEmphasized,
    color: colors.text.primary,
  },
  description: {
    ...typography.subheadline,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
  action: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
});
