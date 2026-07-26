import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme';

import { GlassCard } from './GlassCard';

export type PremiumMetricCardProps = {
  label: string;
  value: string;
  detail?: string;
  trend?: string;
  icon?: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function MetricCard({
  detail,
  icon,
  label,
  onPress,
  style,
  trend,
  value,
}: PremiumMetricCardProps) {
  const { theme } = useAppTheme();

  return (
    <GlassCard onPress={onPress} style={style}>
      <View style={[styles.header, { gap: theme.spacing.sm }]}>
        <Text style={[theme.typography.subheadline, { color: theme.colors.textSecondary }]}>
          {label}
        </Text>
        {icon}
      </View>
      <Text
        allowFontScaling
        style={[
          theme.typography.metricMedium,
          { color: theme.colors.textPrimary, marginTop: theme.spacing.xs },
        ]}
      >
        {value}
      </Text>
      {trend || detail ? (
        <View style={[styles.footer, { gap: theme.spacing.xs, marginTop: theme.spacing.xs }]}>
          {trend ? (
            <Text style={[theme.typography.footnote, { color: theme.colors.success }]}>
              {trend}
            </Text>
          ) : null}
          {detail ? (
            <Text style={[theme.typography.footnote, { color: theme.colors.textTertiary }]}>
              {detail}
            </Text>
          ) : null}
        </View>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  footer: { flexDirection: 'row' },
});
