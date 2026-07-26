import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

import { AnimatedPressable } from './AnimatedPressable';
import { GlassSurface } from './GlassSurface';

export type GlassSegmentedItem = {
  key: string;
  label: string;
};

export type GlassSegmentedControlProps = {
  items: readonly GlassSegmentedItem[];
  selectedKey: string;
  onChange: (key: string) => void;
  accessibilityLabel?: string;
};

export function GlassSegmentedControl({
  items,
  selectedKey,
  onChange,
  accessibilityLabel,
}: GlassSegmentedControlProps) {
  const { theme } = useAppTheme();

  return (
    <GlassSurface
      style={[styles.container, { borderRadius: theme.radius.pill }]}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.row, { padding: theme.spacing.xxs, gap: theme.spacing.xxs }]}>
        {items.map((item) => {
          const selected = item.key === selectedKey;

          return (
            <AnimatedPressable
              key={item.key}
              onPress={() => onChange(item.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[
                styles.segment,
                {
                  borderRadius: theme.radius.pill,
                  minHeight: theme.sizes.touchTargetMinimum,
                  paddingHorizontal: theme.spacing.md,
                  backgroundColor: selected ? theme.colors.surfaceElevated : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  theme.typography.subheadline,
                  { color: selected ? theme.colors.textPrimary : theme.colors.textSecondary },
                ]}
              >
                {item.label}
              </Text>
            </AnimatedPressable>
          );
        })}
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: 'stretch' },
  row: { flexDirection: 'row' },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
