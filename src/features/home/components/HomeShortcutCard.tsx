import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PremiumCard } from '@/components/premium';
import { getCardSurfaceColor, useAppTheme } from '@/theme';

type HomeShortcutCardProps = {
  accessibilityLabel?: string;
  icon: ReactNode;
  label: string;
  onPress?: () => void;
  trailing?: ReactNode;
  value?: string;
};

export default function HomeShortcutCard({
  accessibilityLabel,
  icon,
  label,
  onPress,
  trailing,
  value,
}: HomeShortcutCardProps) {
  const { resolvedMode, theme } = useAppTheme();

  return (
    <PremiumCard
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: getCardSurfaceColor(resolvedMode, theme.colors.surface),
          borderRadius: theme.radius.xl + theme.spacing.md,
          padding: theme.spacing.lg,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: theme.colors.background }]}>{icon}</View>
        <View
          style={[
            styles.copy,
            {
              gap: theme.spacing.xxs,
              marginLeft: theme.spacing.sm,
              marginRight: theme.spacing.sm,
            },
          ]}
        >
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
            {label}
          </Text>
          {value === undefined ? null : (
            <Text
              numberOfLines={1}
              style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}
            >
              {value}
            </Text>
          )}
        </View>
        {trailing}
      </View>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%' },
  copy: { flex: 1 },
  icon: {
    alignItems: 'center',
    borderRadius: 27,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  row: { alignItems: 'center', flexDirection: 'row', minHeight: 54, width: '100%' },
});
