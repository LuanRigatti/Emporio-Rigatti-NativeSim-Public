import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { colors, spacing, typography } from '@/theme';

export type SectionTitleProps = ViewProps & {
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export function SectionTitle({ title, subtitle, action, style, ...props }: SectionTitleProps) {
  return (
    <View style={[styles.container, style]} {...props}>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  content: {
    flex: 1,
  },
  title: {
    ...typography.heading3,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.subheadline,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
