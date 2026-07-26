import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';
import type { NativeListItem, NativeListProps } from '@/types/native-ui';

export default function NativeListExpo({
  accessibilityLabel,
  items,
  onItemPress,
  style,
}: NativeListProps) {
  const { theme } = useAppTheme();

  return (
    <FlatList<NativeListItem>
      accessibilityLabel={accessibilityLabel}
      data={[...items]}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: item.disabled }}
          disabled={item.disabled}
          onPress={() => onItemPress?.(item)}
          style={({ pressed }) => [
            styles.row,
            {
              borderBottomColor: theme.colors.separator,
              borderBottomWidth: StyleSheet.hairlineWidth,
              opacity: item.disabled ? theme.opacities.disabled : 1,
              paddingVertical: theme.spacing.md,
            },
            pressed ? { backgroundColor: theme.colors.backgroundSecondary } : undefined,
          ]}
        >
          <View style={styles.content}>
            <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
              {item.title}
            </Text>
            {item.subtitle ? (
              <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
                {item.subtitle}
              </Text>
            ) : null}
          </View>
        </Pressable>
      )}
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 52 },
  content: { gap: 4 },
});
