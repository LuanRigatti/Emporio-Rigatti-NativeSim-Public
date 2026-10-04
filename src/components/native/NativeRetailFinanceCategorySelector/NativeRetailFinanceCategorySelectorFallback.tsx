import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '@/components/premium';
import { useAppTheme } from '@/theme';

import type { NativeRetailFinanceCategorySelectorProps } from './NativeRetailFinanceCategorySelector.types';

export default function NativeRetailFinanceCategorySelectorFallback({
  accessibilityLabel,
  contentLeadingPadding,
  contentTrailingPadding,
  fillAvailableWidth,
  items,
  itemHorizontalPadding,
  itemSpacing,
  onChange,
  scrollable = true,
  selectedKey,
  style,
}: NativeRetailFinanceCategorySelectorProps) {
  const { theme } = useAppTheme();
  const contentStyle = [
    styles.content,
    {
      flexGrow: fillAvailableWidth ? 1 : undefined,
      gap: fillAvailableWidth ? 0 : (itemSpacing ?? theme.spacing.xs),
      paddingLeft: fillAvailableWidth
        ? (contentLeadingPadding ?? contentTrailingPadding ?? 4)
        : (contentLeadingPadding ?? 4),
      paddingRight: fillAvailableWidth
        ? (contentTrailingPadding ?? 4)
        : (contentTrailingPadding ?? 4),
    },
  ];
  const options = items.map((item) => {
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
            flex: fillAvailableWidth ? 1 : undefined,
            minHeight: theme.sizes.touchTargetMinimum,
            opacity: pressed ? theme.opacities.pressed : 1,
            paddingHorizontal: itemHorizontalPadding ?? theme.spacing.md,
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
  });

  return (
    <GlassSurface
      accessibilityLabel={accessibilityLabel}
      style={[styles.surface, { borderRadius: theme.radius.pill }, style]}
    >
      {scrollable ? (
        <ScrollView
          contentContainerStyle={contentStyle}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {options}
        </ScrollView>
      ) : (
        <View style={contentStyle}>{options}</View>
      )}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', flexDirection: 'row', padding: 4 },
  item: { alignItems: 'center', justifyContent: 'center' },
  surface: { alignSelf: 'stretch', overflow: 'hidden' },
});
