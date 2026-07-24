import type { ReactNode } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';

import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';

import type { CommonAccessibilityProps, ViewComponentStyle } from '../types';

export type ListItemProps = CommonAccessibilityProps & {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewComponentStyle;
};

export function ListItem({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  disabled = false,
  style,
  accessibilityLabel,
  accessibilityHint,
}: ListItemProps) {
  const { theme } = useAppTheme();
  const content = (
    <View
      style={[
        styles.item,
        {
          minHeight: theme.sizes.touchTargetMinimum,
          paddingVertical: theme.spacing.sm,
          opacity: disabled ? theme.opacities.disabled : 1,
        },
        style,
      ]}
    >
      {leading ? <View style={{ marginRight: theme.spacing.sm }}>{leading}</View> : null}
      <View style={styles.content}>
        <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>{title}</Text>
        {subtitle ? (
          <Text
            style={[
              theme.typography.footnote,
              { color: theme.colors.textSecondary, marginTop: theme.spacing.xxs },
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={{ marginLeft: theme.spacing.sm }}>{trailing}</View> : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        triggerLightImpactHaptic();
        onPress();
      }}
      style={({ pressed }) => [
        pressed && !disabled ? { backgroundColor: theme.colors.backgroundSecondary } : undefined,
      ]}
    >
      {content}
    </Pressable>
  );
}

export type SelectableListItemProps = Omit<ListItemProps, 'onPress'> & {
  selected: boolean;
  onSelect: () => void;
};

export function SelectableListItem({
  selected,
  onSelect,
  trailing,
  ...props
}: SelectableListItemProps) {
  const { theme } = useAppTheme();
  return (
    <ListItem
      {...props}
      onPress={onSelect}
      trailing={
        trailing ?? (
          <Ionicons
            color={selected ? theme.colors.primary : theme.colors.textTertiary}
            name={selected ? 'checkmark-circle' : 'ellipse-outline'}
            size={theme.sizes.iconMedium}
          />
        )
      }
    />
  );
}

export type SwipeDirection = 'left' | 'right';

export type SwipeActionProps = {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'danger';
  icon?: ReactNode;
};

export function SwipeAction({ label, onPress, tone = 'primary', icon }: SwipeActionProps) {
  const { theme } = useAppTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.swipeAction,
        {
          backgroundColor: tone === 'danger' ? theme.colors.danger : theme.colors.primary,
          minHeight: theme.sizes.touchTargetMinimum,
          minWidth: theme.sizes.touchTargetMinimum,
          opacity: pressed ? theme.opacities.pressed : 1,
          paddingHorizontal: theme.spacing.sm,
        },
      ]}
    >
      {icon}
      <Text style={[theme.typography.caption, { color: theme.colors.textInverse }]}>{label}</Text>
    </Pressable>
  );
}

export type SwipeableListItemProps = {
  children: ReactNode;
  leftActions?: ReactNode;
  rightActions?: ReactNode;
  onSwipe?: (direction: SwipeDirection) => void;
  style?: ViewComponentStyle;
};

export function SwipeableListItem({
  children,
  leftActions,
  rightActions,
  onSwipe,
  style,
}: SwipeableListItemProps) {
  const { reduceMotionEnabled } = useAppTheme();
  const [translateX] = useState(() => new Animated.Value(0));
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 8,
        onPanResponderMove: (_, gesture) => translateX.setValue(gesture.dx),
        onPanResponderRelease: (_, gesture) => {
          if (onSwipe && Math.abs(gesture.dx) > 48) {
            onSwipe(gesture.dx > 0 ? 'right' : 'left');
          }
          if (reduceMotionEnabled) {
            translateX.setValue(0);
          } else {
            Animated.spring(translateX, { toValue: 0, useNativeDriver: false }).start();
          }
        },
      }),
    [onSwipe, reduceMotionEnabled, translateX],
  );

  return (
    <View style={[styles.swipeContainer, style]}>
      {leftActions ? <View style={styles.actionLayer}>{leftActions}</View> : null}
      {rightActions ? (
        <View style={[styles.actionLayer, styles.rightActions]}>{rightActions}</View>
      ) : null}
      <Animated.View {...panResponder.panHandlers} style={{ transform: [{ translateX }] }}>
        {children}
      </Animated.View>
    </View>
  );
}

export type ListGroup = { key: string; title?: string; items: readonly ReactNode[] };

export type GroupedListProps = { sections: readonly ListGroup[]; style?: ViewComponentStyle };

export function GroupedList({ sections, style }: GroupedListProps) {
  const { theme } = useAppTheme();
  return (
    <View style={style}>
      {sections.map((section) => (
        <View key={section.key} style={{ marginBottom: theme.spacing.section }}>
          {section.title ? (
            <Text
              style={[
                theme.typography.title3,
                { color: theme.colors.textPrimary, marginBottom: theme.spacing.xs },
              ]}
            >
              {section.title}
            </Text>
          ) : null}
          {section.items.map((item, index) => (
            <View key={`${section.key}-${index}`}>{item}</View>
          ))}
        </View>
      ))}
    </View>
  );
}

export type ListSeparatorProps = { inset?: boolean };

export function ListSeparator({ inset = false }: ListSeparatorProps) {
  const { theme } = useAppTheme();
  return (
    <View
      style={{
        backgroundColor: theme.colors.separator,
        height: StyleSheet.hairlineWidth,
        marginLeft: inset ? theme.spacing.md : 0,
      }}
    />
  );
}

const styles = StyleSheet.create({
  item: { alignItems: 'center', flexDirection: 'row' },
  content: { flex: 1 },
  swipeContainer: { overflow: 'hidden' },
  actionLayer: { bottom: 0, flexDirection: 'row', left: 0, position: 'absolute', right: 0, top: 0 },
  rightActions: { justifyContent: 'flex-end' },
  swipeAction: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
});
