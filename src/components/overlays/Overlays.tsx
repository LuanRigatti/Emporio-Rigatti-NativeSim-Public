import type { ReactNode } from 'react';
import { Animated, Modal, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';

import { useAppTheme } from '@/theme';

import { DestructiveButton, PrimaryButton, SecondaryButton } from '../buttons';
import type { ActionOption, CommonAccessibilityProps, ViewComponentStyle } from '../types';

export type AppModalProps = CommonAccessibilityProps & {
  visible: boolean;
  title?: string;
  onRequestClose: () => void;
  onDismiss?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  style?: ViewComponentStyle;
};

export function AppModal({
  visible,
  title,
  onRequestClose,
  onDismiss,
  children,
  footer,
  accessibilityLabel,
  style,
}: AppModalProps) {
  const { theme } = useAppTheme();
  return (
    <Modal
      accessibilityLabel={accessibilityLabel ?? title}
      animationType="fade"
      onDismiss={onDismiss}
      onRequestClose={onRequestClose}
      transparent
      visible={visible}
    >
      <View
        style={[
          styles.modalBackdrop,
          { backgroundColor: theme.colors.overlay, padding: theme.spacing.lg },
        ]}
      >
        <View
          accessibilityViewIsModal
          style={[
            styles.modalCard,
            {
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.xl,
              maxWidth: theme.layout.contentMaxWidth,
              padding: theme.spacing.lg,
            },
            theme.shadows.elevated,
            style,
          ]}
        >
          <View style={styles.modalHeader}>
            {title ? (
              <Text style={[theme.typography.title3, { color: theme.colors.textPrimary }]}>
                {title}
              </Text>
            ) : (
              <View />
            )}
            <Pressable
              accessibilityLabel="Fechar"
              accessibilityRole="button"
              onPress={onRequestClose}
              style={[
                styles.closeButton,
                {
                  minHeight: theme.sizes.touchTargetMinimum,
                  minWidth: theme.sizes.touchTargetMinimum,
                },
              ]}
            >
              <Ionicons
                color={theme.colors.textSecondary}
                name="close"
                size={theme.sizes.iconMedium}
              />
            </Pressable>
          </View>
          <View style={{ marginTop: theme.spacing.md }}>{children}</View>
          {footer ? <View style={{ marginTop: theme.spacing.lg }}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

export type BottomSheetProps = CommonAccessibilityProps & {
  visible: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  style?: ViewComponentStyle;
};

export function BottomSheet({
  visible,
  title,
  onClose,
  children,
  footer,
  accessibilityLabel,
  style,
}: BottomSheetProps) {
  const { theme, reduceMotionEnabled } = useAppTheme();
  const [translateY] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      translateY.setValue(0);
    }
  }, [translateY, visible]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 8,
        onPanResponderMove: (_, gesture) => translateY.setValue(Math.max(0, gesture.dy)),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 80) {
            onClose();
          } else {
            if (reduceMotionEnabled) {
              translateY.setValue(0);
            } else {
              Animated.spring(translateY, { toValue: 0, useNativeDriver: false }).start();
            }
          }
        },
      }),
    [onClose, reduceMotionEnabled, translateY],
  );

  return (
    <Modal
      accessibilityLabel={accessibilityLabel ?? title}
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={[styles.sheetBackdrop, { backgroundColor: theme.colors.overlay }]}>
        <Animated.View
          accessibilityViewIsModal
          {...panResponder.panHandlers}
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surfaceElevated,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              minHeight: theme.sizes.bottomSheetMinimumHeight,
              padding: theme.spacing.lg,
              transform: [{ translateY }],
            },
            style,
          ]}
        >
          <View
            style={[
              styles.dragIndicator,
              {
                backgroundColor: theme.colors.borderStrong,
                borderRadius: theme.radius.pill,
                height: theme.sizes.dragIndicatorHeight,
                width: theme.sizes.dragIndicatorWidth,
              },
            ]}
          />
          {title ? (
            <Text
              style={[
                theme.typography.title3,
                { color: theme.colors.textPrimary, marginTop: theme.spacing.md },
              ]}
            >
              {title}
            </Text>
          ) : null}
          <View style={{ marginTop: theme.spacing.md }}>{children}</View>
          {footer ? <View style={{ marginTop: theme.spacing.lg }}>{footer}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

export type ConfirmationDialogProps = CommonAccessibilityProps & {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmationDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
  accessibilityLabel,
}: ConfirmationDialogProps) {
  const { theme } = useAppTheme();
  return (
    <AppModal
      accessibilityLabel={accessibilityLabel ?? title}
      onRequestClose={onCancel}
      title={title}
      visible={visible}
    >
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{message}</Text>
      <View style={[styles.dialogActions, { marginTop: theme.spacing.lg }]}>
        <SecondaryButton fullWidth onPress={onCancel}>
          {cancelLabel}
        </SecondaryButton>
        {destructive ? (
          <DestructiveButton
            fullWidth
            loading={loading}
            onPress={onConfirm}
            style={{ marginTop: theme.spacing.sm }}
          >
            {confirmLabel}
          </DestructiveButton>
        ) : (
          <PrimaryButton
            fullWidth
            loading={loading}
            onPress={onConfirm}
            style={{ marginTop: theme.spacing.sm }}
          >
            {confirmLabel}
          </PrimaryButton>
        )}
      </View>
    </AppModal>
  );
}

export type ActionSheetProps = CommonAccessibilityProps & {
  visible: boolean;
  title?: string;
  options: readonly ActionOption[];
  onClose: () => void;
};

export function ActionSheet({
  visible,
  title,
  options,
  onClose,
  accessibilityLabel,
}: ActionSheetProps) {
  const { theme } = useAppTheme();
  return (
    <BottomSheet
      accessibilityLabel={accessibilityLabel ?? title}
      onClose={onClose}
      title={title}
      visible={visible}
    >
      <View style={{ gap: theme.spacing.xs }}>
        {options.map((option) => (
          <Pressable
            accessibilityLabel={option.label}
            accessibilityRole="button"
            accessibilityState={{ disabled: option.disabled }}
            disabled={option.disabled}
            key={option.key}
            onPress={() => {
              option.onPress();
              onClose();
            }}
            style={({ pressed }) => [
              {
                alignItems: 'center',
                flexDirection: 'row',
                minHeight: theme.sizes.touchTargetMinimum,
                opacity: option.disabled ? theme.opacities.disabled : 1,
                paddingHorizontal: theme.spacing.sm,
              },
              pressed ? { backgroundColor: theme.colors.backgroundSecondary } : undefined,
            ]}
          >
            {option.icon}
            <Text
              style={[
                theme.typography.body,
                {
                  color: option.destructive ? theme.colors.danger : theme.colors.textPrimary,
                  marginLeft: option.icon ? theme.spacing.sm : 0,
                },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  modalCard: { width: '100%' },
  modalHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  closeButton: { alignItems: 'center', justifyContent: 'center' },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { width: '100%' },
  dragIndicator: { alignSelf: 'center' },
  dialogActions: { width: '100%' },
});
