import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme';

export type PremiumMetricTone = 'default' | 'positive' | 'negative' | 'warning';

export type PremiumMetricProps = {
  label: string;
  value: string;
  detail?: string;
  trend?: string;
  tone?: PremiumMetricTone;
  accessory?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function PremiumMetric({
  label,
  value,
  detail,
  trend,
  tone = 'default',
  accessory,
  style,
}: PremiumMetricProps) {
  const { theme } = useAppTheme();
  const toneColor = {
    default: theme.colors.textPrimary,
    positive: theme.colors.success,
    negative: theme.colors.danger,
    warning: theme.colors.warning,
  }[tone];

  return (
    <View style={[styles.container, { gap: theme.spacing.xs }, style]}>
      <View style={styles.header}>
        <Text style={[theme.typography.subheadline, { color: theme.colors.textSecondary }]}>
          {label}
        </Text>
        {accessory}
      </View>
      <Text style={[theme.typography.metricMedium, { color: toneColor }]}>{value}</Text>
      {trend || detail ? (
        <View style={[styles.footer, { gap: theme.spacing.xs }]}>
          {trend ? (
            <Text style={[theme.typography.footnote, { color: toneColor }]}>{trend}</Text>
          ) : null}
          {detail ? (
            <Text style={[theme.typography.footnote, { color: theme.colors.textTertiary }]}>
              {detail}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footer: { flexDirection: 'row', alignItems: 'center' },
});
