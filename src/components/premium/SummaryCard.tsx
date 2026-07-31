import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme';

import { PremiumCard } from './PremiumCard';

export type SummaryCardRow = {
  label: string;
  value: string;
};

export type SummaryCardProps = {
  title: string;
  rows: readonly SummaryCardRow[];
  style?: StyleProp<ViewStyle>;
};

export function SummaryCard({ rows, style, title }: SummaryCardProps) {
  const { theme } = useAppTheme();

  return (
    <PremiumCard style={[styles.card, { borderRadius: theme.radius.xl + theme.spacing.sm }, style]}>
      <Text style={[theme.typography.caption, { color: theme.colors.textPrimary }]}>{title}</Text>
      <View style={[styles.rows, { gap: theme.spacing.sm }]}>
        {rows.map((row) => (
          <View key={row.label} style={styles.row}>
            <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
              {row.label}
            </Text>
            <Text
              style={[
                theme.typography.subheadline,
                {
                  color: theme.colors.textPrimary,
                  fontWeight: theme.typography.fontWeight.semibold,
                },
              ]}
            >
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: 16, padding: 20 },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  rows: { flexDirection: 'column' },
});
