import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

export type PremiumSectionProps = {
  title: string;
  children: ReactNode;
  trailing?: ReactNode;
};

export function PremiumSection({ title, children, trailing }: PremiumSectionProps) {
  const { theme } = useAppTheme();

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={styles.header}>
        <Text style={[theme.typography.title3, { color: theme.colors.textPrimary }]}>{title}</Text>
        {trailing}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
