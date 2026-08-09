import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { NativeSwipeActionsListProps } from './NativeSwipeActionsList.types';

export default function NativeSwipeActionsList({
  items,
  colors,
  isSelectionMode = false,
  selectedIds,
  onItemPress,
}: NativeSwipeActionsListProps) {
  return (
    <View>
      {items.map((item) => (
        <Pressable
          key={item.id}
          disabled={!isSelectionMode && !onItemPress}
          onPress={() => onItemPress?.(item.id)}
          style={styles.row}
        >
          <Text style={[styles.overline, { color: colors.textSecondary }]}>{item.overline}</Text>
          <View style={styles.summary}>
            <View style={styles.leading}>
              {isSelectionMode ? (
                <View
                  style={[
                    styles.selectionIndicator,
                    {
                      backgroundColor: selectedIds?.has(item.id)
                        ? colors.selectionSurface
                        : 'transparent',
                      borderColor: colors.border,
                    },
                  ]}
                >
                  {selectedIds?.has(item.id) ? (
                    <Text style={{ color: colors.selectionContent }}>✓</Text>
                  ) : null}
                </View>
              ) : null}
              <View>
                <Text
                  style={[
                    styles.title,
                    { color: colors.textPrimary, fontWeight: item.titleBold ? '700' : '400' },
                  ]}
                >
                  {item.title}
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {item.subtitle}
                </Text>
              </View>
            </View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{item.trailingText}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 8 },
  overline: { fontSize: 12, lineHeight: 16 },
  summary: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  leading: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  title: { fontSize: 17, lineHeight: 22 },
  subtitle: { fontSize: 13, lineHeight: 18 },
  selectionIndicator: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
});
