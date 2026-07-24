import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { borders, colors, radius, spacing, typography } from '@/theme';

export type BottomNavigationItem<TKey extends string = string> = {
  key: TKey;
  label: string;
  icon?: ReactNode;
};

export type BottomNavigationProps<TKey extends string = string> = {
  items: BottomNavigationItem<TKey>[];
  activeKey: TKey;
  onChange: (key: TKey) => void;
};

export function BottomNavigation<TKey extends string>({
  items,
  activeKey,
  onChange,
}: BottomNavigationProps<TKey>) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing.xs) }]}>
      {items.map((item) => {
        const active = item.key === activeKey;

        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            key={item.key}
            onPress={() => onChange(item.key)}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            {item.icon ? <View style={styles.icon}>{item.icon}</View> : null}
            <Text style={[styles.label, active ? styles.activeLabel : styles.inactiveLabel]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.background.surface,
    borderTopWidth: borders.width.hairline,
    borderStyle: borders.style,
    borderTopColor: colors.border.subtle,
    paddingTop: spacing.xs,
  },
  item: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    marginHorizontal: spacing.xxs,
  },
  pressed: {
    backgroundColor: colors.background.muted,
  },
  icon: {
    marginBottom: 2,
  },
  label: {
    ...typography.caption,
  },
  activeLabel: {
    color: colors.brand.primary,
  },
  inactiveLabel: {
    color: colors.text.tertiary,
  },
});
