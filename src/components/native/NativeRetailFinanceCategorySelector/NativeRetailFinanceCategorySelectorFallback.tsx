import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { GlassSurface } from '@/components/premium';
import { useAppTheme } from '@/theme';

import type { NativeRetailFinanceCategorySelectorProps } from './NativeRetailFinanceCategorySelector.types';

export default function NativeRetailFinanceCategorySelectorFallback({
  accessibilityLabel,
  items,
  onChange,
  selectedKey,
  style,
}: NativeRetailFinanceCategorySelectorProps) {
  const { theme } = useAppTheme();

  return (
    <GlassSurface
      accessibilityLabel={accessibilityLabel}
      style={[styles.surface, { borderRadius: theme.radius.pill }, style]}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { gap: theme.spacing.xs }]}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {items.map((item) => {
          const selected = item.key === selectedKey;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={item.key}
              onPress={() => onChange(item.key)}
              style={({ pressed }) => [
                styles.item,
                {
                  backgroundColor: selected ? theme.colors.surfaceElevated : 'transparent',
                  borderRadius: theme.radius.pill,
                  minHeight: theme.sizes.touchTargetMinimum,
                  opacity: pressed ? theme.opacities.pressed : 1,
                  paddingHorizontal: theme.spacing.md,
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
            </Pressable>
          );
        })}
      </ScrollView>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', flexDirection: 'row', padding: 4 },
  item: { alignItems: 'center', justifyContent: 'center' },
  surface: { alignSelf: 'stretch', overflow: 'hidden' },
});
