import type { ReactNode } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme';

import { GlassCard } from './GlassCard';

export type StatCardProps = {
  label: string;
  value: string;
  subtitle?: string;
  accessory?: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function StatCard({ accessory, label, onPress, style, subtitle, value }: StatCardProps) {
  const { theme } = useAppTheme();

  return (
    <GlassCard onPress={onPress} style={style}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[theme.typography.subheadline, { color: theme.colors.textSecondary }]}>
          {label}
        </Text>
        {accessory}
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
      {subtitle ? (
        <Text
          style={[
            theme.typography.footnote,
            { color: theme.colors.textTertiary, marginTop: theme.spacing.xs },
          ]}
        >
          {subtitle}
        </Text>
      ) : null}
    </GlassCard>
  );
}
