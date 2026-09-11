import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

export type SettingsSectionProps = {
  title?: string;
  children: ReactNode;
};

export function SettingsSection({ children, title }: SettingsSectionProps) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.container}>
      {title ? (
        <Text
          style={[theme.typography.caption, styles.title, { color: theme.colors.textSecondary }]}
        >
          {title.toUpperCase()}
        </Text>
      ) : null}
      <View style={[styles.items, { gap: theme.spacing.sm, paddingHorizontal: theme.spacing.sm }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  items: { width: '100%' },
  title: { letterSpacing: 0.7, paddingHorizontal: 4 },
});
