import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';
import type { NativeMenuProps } from '@/types/native-ui';

export default function NativeMenuWeb({
  accessibilityLabel,
  actions,
  children,
  title,
}: NativeMenuProps) {
  const { theme } = useAppTheme();
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ expanded: visible }}
        onPress={() => setVisible((current) => !current)}
      >
        {children}
      </Pressable>
      {visible ? (
        <View
          accessibilityViewIsModal
          style={[
            styles.menu,
            theme.shadows.elevated,
            {
              backgroundColor: theme.colors.surfaceElevated,
              borderColor: theme.colors.separator,
              borderRadius: theme.radius.lg,
              padding: theme.spacing.xs,
            },
          ]}
        >
          {title ? (
            <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
              {title}
            </Text>
          ) : null}
          {actions.map((action) => (
            <Pressable
              accessibilityLabel={action.title}
              accessibilityRole="menuitem"
              accessibilityState={{ disabled: action.disabled }}
              disabled={action.disabled}
              key={action.id}
              onPress={() => {
                action.onPress();
                setVisible(false);
              }}
              style={({ pressed }) => [
                styles.item,
                {
                  borderRadius: theme.radius.md,
                  minHeight: theme.sizes.touchTargetMinimum,
                  opacity: action.disabled ? theme.opacities.disabled : 1,
                  paddingHorizontal: theme.spacing.sm,
                },
                pressed ? { backgroundColor: theme.colors.backgroundSecondary } : undefined,
              ]}
            >
              <Text
                style={[
                  theme.typography.body,
                  { color: action.destructive ? theme.colors.danger : theme.colors.textPrimary },
                ]}
              >
                {action.title}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative' },
  menu: { minWidth: 220, position: 'absolute', right: 0, top: '100%', zIndex: 2 },
  item: { justifyContent: 'center' },
});
