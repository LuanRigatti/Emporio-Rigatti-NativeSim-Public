import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '@/components/premium';
import { useAppTheme } from '@/theme';

export type SettingsSectionProps = {
  title?: string;
  children: ReactNode;
};

export function SettingsSection({ children, title }: SettingsSectionProps) {
  const { resolvedMode, theme } = useAppTheme();

  return (
    <View style={styles.container}>
      {title ? (
        <Text
          style={[theme.typography.caption, styles.title, { color: theme.colors.textSecondary }]}
        >
          {title.toUpperCase()}
        </Text>
      ) : null}
      <View
        style={[
          { borderRadius: theme.radius.xl + theme.spacing.xs },
          resolvedMode === 'dark' ? theme.shadows.none : theme.shadows.card,
        ]}
      >
        <GlassSurface
          glassEffectStyle="none"
          style={[
            styles.surface,
            {
              backgroundColor: resolvedMode === 'dark' ? '#131417' : theme.colors.glassSurface,
              borderWidth: 0,
              borderRadius: theme.radius.xl + theme.spacing.xs,
              paddingHorizontal: theme.spacing.md,
            },
          ]}
        >
          {children}
        </GlassSurface>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  title: { letterSpacing: 0.7, paddingHorizontal: 4 },
  surface: { overflow: 'hidden' },
});
