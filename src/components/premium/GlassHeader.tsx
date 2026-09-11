import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme';

import { GlassSurface } from './GlassSurface';

export type GlassHeaderProps = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function GlassHeader({ title, subtitle, leading, trailing, style }: GlassHeaderProps) {
  const { theme } = useAppTheme();

  return (
    <GlassSurface
      style={[
        styles.surface,
        { borderRadius: theme.radius.pill, paddingHorizontal: theme.spacing.xs },
        style,
      ]}
    >
      <View style={[styles.container, { paddingVertical: theme.spacing.sm }]}>
        <View style={[styles.side, { minWidth: theme.sizes.touchTargetMinimum }]}>{leading}</View>
        <View style={styles.titleContainer}>
          <Text
            style={[theme.typography.headline, { color: theme.colors.textPrimary }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[theme.typography.subheadline, { color: theme.colors.textSecondary }]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={[styles.side, { minWidth: theme.sizes.touchTargetMinimum }]}>{trailing}</View>
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  surface: { alignSelf: 'stretch' },
  container: { flexDirection: 'row', alignItems: 'center' },
  side: { alignItems: 'center' },
  titleContainer: { flex: 1, alignItems: 'center' },
});
