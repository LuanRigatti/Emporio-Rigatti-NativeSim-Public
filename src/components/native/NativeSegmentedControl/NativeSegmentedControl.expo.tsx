import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';
import type { NativeSegmentedControlProps } from '@/types/native-ui';

export default function NativeSegmentedControlExpo({
  accessibilityLabel,
  onSelectedIndexChange,
  options,
  selectedIndex,
}: NativeSegmentedControlProps) {
  const { theme } = useAppTheme();

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tablist"
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderRadius: theme.radius.pill,
          padding: theme.spacing.xxs,
        },
      ]}
    >
      {options.map((option, index) => {
        const selected = index === selectedIndex;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={option}
            onPress={() => onSelectedIndexChange(index)}
            style={({ pressed }) => [
              styles.item,
              {
                backgroundColor: selected ? theme.colors.surfaceElevated : 'transparent',
                borderRadius: theme.radius.pill,
                opacity: pressed ? theme.opacities.pressed : 1,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
              },
            ]}
          >
            <Text
              style={[
                theme.typography.subheadline,
                { color: selected ? theme.colors.textPrimary : theme.colors.textSecondary },
              ]}
            >
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row' },
  item: { alignItems: 'center', flex: 1, justifyContent: 'center' },
});
