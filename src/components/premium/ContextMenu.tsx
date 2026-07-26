import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';

import { useAppTheme } from '@/theme';
import { triggerSelectionHaptic } from '@/utils/haptics';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type ContextMenuItem = {
  key: string;
  label: string;
  onPress: () => void;
  icon?: IconName;
  destructive?: boolean;
  disabled?: boolean;
};

export type ContextMenuProps = {
  visible: boolean;
  items: readonly ContextMenuItem[];
  onClose: () => void;
  title?: string;
  anchor?: ReactNode;
  accessibilityLabel?: string;
};

export function ContextMenu({
  accessibilityLabel,
  anchor,
  items,
  onClose,
  title,
  visible,
}: ContextMenuProps) {
  const { theme } = useAppTheme();

  return (
    <Modal
      accessibilityLabel={accessibilityLabel ?? title}
      animationType="none"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={[styles.backdrop, { padding: theme.spacing.xl }]}>
        <Pressable
          accessibilityLabel="Fechar menu"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        {anchor}
        <Animated.View
          accessibilityViewIsModal
          entering={FadeIn.duration(theme.animations.duration.fast)}
          exiting={FadeOut.duration(theme.animations.duration.fast)}
          style={[
            styles.menu,
            theme.shadows.elevated,
            {
              backgroundColor: theme.colors.surfaceElevated,
              borderColor: theme.colors.separator,
              borderRadius: theme.radius.lg,
              maxWidth: theme.layout.contentMaxWidth,
              padding: theme.spacing.xs,
            },
          ]}
        >
          {title ? (
            <Text
              style={[
                theme.typography.footnote,
                { color: theme.colors.textSecondary, padding: theme.spacing.sm },
              ]}
            >
              {title}
            </Text>
          ) : null}
          {items.map((item) => (
            <Animated.View
              entering={ZoomIn.duration(theme.animations.duration.fast)}
              key={item.key}
              exiting={ZoomOut.duration(theme.animations.duration.fast)}
            >
              <Pressable
                accessibilityLabel={item.label}
                accessibilityRole="button"
                accessibilityState={{ disabled: item.disabled }}
                disabled={item.disabled}
                onPress={() => {
                  triggerSelectionHaptic();
                  item.onPress();
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.item,
                  {
                    borderRadius: theme.radius.md,
                    minHeight: theme.sizes.touchTargetMinimum,
                    opacity: item.disabled ? theme.opacities.disabled : 1,
                    paddingHorizontal: theme.spacing.sm,
                  },
                  pressed ? { backgroundColor: theme.colors.backgroundSecondary } : undefined,
                ]}
              >
                {item.icon ? (
                  <Ionicons
                    color={item.destructive ? theme.colors.danger : theme.colors.textSecondary}
                    name={item.icon}
                    size={theme.sizes.iconMedium}
                  />
                ) : null}
                <Text
                  style={[
                    theme.typography.body,
                    {
                      color: item.destructive ? theme.colors.danger : theme.colors.textPrimary,
                      marginLeft: item.icon ? theme.spacing.sm : 0,
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            </Animated.View>
          ))}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  menu: { borderWidth: 1, width: '100%' },
  item: { alignItems: 'center', flexDirection: 'row' },
});
