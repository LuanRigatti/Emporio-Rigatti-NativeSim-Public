import { StyleSheet, Text } from 'react-native';

import { colors, spacing, typography } from '@/theme';

import { Card, type CardProps } from './Card';

export type StatsCardProps = Omit<CardProps, 'children'> & {
  label: string;
  value: string;
  caption?: string;
};

export function StatsCard({ label, value, caption, ...props }: StatsCardProps) {
  return (
    <Card {...props}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typography.footnote,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  value: {
    ...typography.heading2,
    color: colors.text.primary,
  },
  caption: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
});
