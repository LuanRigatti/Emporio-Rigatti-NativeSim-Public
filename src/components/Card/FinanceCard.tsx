import { StyleSheet, Text } from 'react-native';

import { colors, spacing, typography } from '@/theme';

import { Card, type CardProps } from './Card';

export type FinanceCardProps = Omit<CardProps, 'children'> & {
  label: string;
  value: string;
  trend?: string;
  trendPositive?: boolean;
};

export function FinanceCard({
  label,
  value,
  trend,
  trendPositive = true,
  ...props
}: FinanceCardProps) {
  return (
    <Card {...props}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {trend ? (
        <Text style={[styles.trend, trendPositive ? styles.positive : styles.negative]}>
          {trend}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typography.subheadline,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  value: {
    ...typography.heading2,
    color: colors.text.primary,
  },
  trend: {
    ...typography.footnote,
    marginTop: spacing.xs,
  },
  positive: {
    color: colors.feedback.positive,
  },
  negative: {
    color: colors.feedback.negative,
  },
});
