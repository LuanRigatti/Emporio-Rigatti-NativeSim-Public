import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';

import { useAppTheme } from '@/theme';

import type {
  CommonAccessibilityProps,
  FeedbackTone,
  StatusLabel,
  ViewComponentStyle,
} from '../types';
import { PrimaryButton } from '../buttons';

export type LoadingProps = {
  size?: 'small' | 'large';
  label?: string;
  tone?: FeedbackTone;
  style?: ViewComponentStyle;
};

export type AvatarProps = {
  name: string;
  imageUri?: string;
  size?: 'small' | 'medium' | 'large';
  style?: ViewComponentStyle;
};

export function Avatar({ name, imageUri, size = 'medium', style }: AvatarProps) {
  const { theme } = useAppTheme();
  const dimensions = {
    small: theme.sizes.avatarSmall,
    medium: theme.sizes.avatarMedium,
    large: theme.sizes.avatarLarge,
  }[size];
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();

  return (
    <View
      accessibilityLabel={name}
      accessibilityRole="image"
      style={[
        styles.avatar,
        {
          backgroundColor: theme.colors.brand,
          borderRadius: theme.radius.pill,
          height: dimensions,
          width: dimensions,
        },
        style,
      ]}
    >
      {imageUri ? (
        <Image
          accessibilityLabel={name}
          source={{ uri: imageUri }}
          style={{ borderRadius: theme.radius.pill, height: dimensions, width: dimensions }}
        />
      ) : (
        <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
          {initials}
        </Text>
      )}
    </View>
  );
}

export function Loading({ size = 'small', label, tone = 'info', style }: LoadingProps) {
  const { theme } = useAppTheme();
  const color = theme.colors[tone];

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="progressbar"
      style={[styles.loading, style]}
    >
      <ActivityIndicator color={color} size={size} />
      {label ? (
        <Text style={[theme.typography.footnote, { color, marginLeft: theme.spacing.xs }]}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

export type LoadingOverlayProps = LoadingProps & { visible: boolean };

export function LoadingOverlay({ visible, label = 'Carregando', ...props }: LoadingOverlayProps) {
  const { theme } = useAppTheme();
  if (!visible) return null;

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.overlay, { backgroundColor: theme.colors.overlay }]}
    >
      <View
        style={[
          styles.overlayContent,
          {
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.lg,
            padding: theme.spacing.xl,
          },
        ]}
      >
        <Loading {...props} label={label} size="large" />
      </View>
    </View>
  );
}

export type SkeletonProps = {
  width?: ViewStyleWidth;
  height?: ViewStyleHeight;
  radius?: keyof ReturnType<typeof useAppTheme>['theme']['radius'];
  animated?: boolean;
  style?: ViewComponentStyle;
};

type ViewStyleWidth = number | `${number}%`;
type ViewStyleHeight = number | `${number}%`;

export function Skeleton({
  width = '100%',
  height = 20,
  radius = 'sm',
  animated = true,
  style,
}: SkeletonProps) {
  const { theme, reduceMotionEnabled } = useAppTheme();
  const [opacity] = useState(() => new Animated.Value(theme.opacities.skeleton));

  useEffect(() => {
    if (!animated || reduceMotionEnabled) {
      opacity.setValue(theme.opacities.skeleton);
      return undefined;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          duration: theme.animations.duration.slow,
          toValue: theme.opacities.tertiary,
          useNativeDriver: false,
        }),
        Animated.timing(opacity, {
          duration: theme.animations.duration.slow,
          toValue: theme.opacities.skeleton,
          useNativeDriver: false,
        }),
      ]),
    );
    animation.start();

    return () => animation.stop();
  }, [
    animated,
    opacity,
    reduceMotionEnabled,
    theme.animations.duration.slow,
    theme.opacities.skeleton,
    theme.opacities.tertiary,
  ]);

  return (
    <Animated.View
      accessibilityLabel="Carregando"
      accessibilityRole="progressbar"
      style={[
        {
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: theme.radius[radius],
          height,
          opacity,
          width,
        },
        style,
      ]}
    />
  );
}

export type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  actionLabel?: string;
  onActionPress?: () => void;
  style?: ViewComponentStyle;
};

export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  onActionPress,
  style,
}: EmptyStateProps) {
  const { theme } = useAppTheme();
  return (
    <View
      accessibilityLabel={description ? `${title}. ${description}` : title}
      style={[styles.state, { padding: theme.spacing.xxl }, style]}
    >
      {icon ? <View style={{ marginBottom: theme.spacing.md }}>{icon}</View> : null}
      <Text
        style={[theme.typography.title3, { color: theme.colors.textPrimary, textAlign: 'center' }]}
      >
        {title}
      </Text>
      {description ? (
        <Text
          style={[
            theme.typography.body,
            { color: theme.colors.textSecondary, marginTop: theme.spacing.xs, textAlign: 'center' },
          ]}
        >
          {description}
        </Text>
      ) : null}
      {actionLabel ? (
        <PrimaryButton
          accessibilityLabel={actionLabel}
          onPress={onActionPress}
          style={{ marginTop: theme.spacing.lg }}
        >
          {actionLabel}
        </PrimaryButton>
      ) : null}
    </View>
  );
}

export type ErrorStateProps = Omit<EmptyStateProps, 'actionLabel' | 'onActionPress'> & {
  retryLabel?: string;
  onRetry?: () => void;
};

export function ErrorState({
  retryLabel = 'Tentar novamente',
  onRetry,
  ...props
}: ErrorStateProps) {
  const { theme } = useAppTheme();
  return (
    <EmptyState
      {...props}
      actionLabel={retryLabel}
      onActionPress={onRetry}
      style={[
        { borderColor: theme.colors.danger, borderWidth: 1, borderRadius: theme.radius.lg },
        props.style,
      ]}
    />
  );
}

export type InlineErrorProps = { message?: string; style?: ViewComponentStyle };

export function InlineError({ message, style }: InlineErrorProps) {
  const { theme } = useAppTheme();
  if (!message) return null;
  return (
    <Text
      accessibilityLiveRegion="assertive"
      accessibilityRole="alert"
      style={[
        theme.typography.footnote,
        { color: theme.colors.danger, marginTop: theme.spacing.xs },
        style,
      ]}
    >
      {message}
    </Text>
  );
}

export type ToastProps = CommonAccessibilityProps & {
  visible: boolean;
  message: string;
  tone?: FeedbackTone;
  duration?: number;
  onDismiss?: () => void;
};

export function Toast({
  visible,
  message,
  tone = 'info',
  duration,
  onDismiss,
  accessibilityLabel,
  accessibilityHint,
}: ToastProps) {
  const { theme } = useAppTheme();

  useEffect(() => {
    if (!visible || !onDismiss) return undefined;
    const timer = setTimeout(onDismiss, duration ?? theme.animations.duration.slow * 6);
    return () => clearTimeout(timer);
  }, [duration, onDismiss, theme.animations.duration.slow, visible]);

  if (!visible) return null;
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? message}
      accessibilityRole="alert"
      onPress={onDismiss}
      style={[
        styles.toast,
        {
          backgroundColor: theme.colors[tone],
          borderRadius: theme.radius.md,
          bottom: theme.layout.tabBarHeight + theme.spacing.md,
          left: theme.spacing.md,
          padding: theme.spacing.sm,
          right: theme.spacing.md,
        },
      ]}
    >
      <Text style={[theme.typography.callout, { color: theme.colors.textInverse }]}>{message}</Text>
    </Pressable>
  );
}

export type BadgeProps = {
  label: string;
  tone?: FeedbackTone | 'neutral';
  icon?: ReactNode;
  labelStyle?: StyleProp<TextStyle>;
  style?: ViewComponentStyle;
};

export function Badge({ label, tone = 'neutral', icon, labelStyle, style }: BadgeProps) {
  const { theme } = useAppTheme();
  const color = tone === 'neutral' ? theme.colors.textSecondary : theme.colors[tone];
  const backgroundColor =
    tone === 'neutral' ? theme.colors.backgroundSecondary : theme.colors[`${tone}Surface` as const];
  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="text"
      style={[
        styles.badge,
        {
          backgroundColor,
          borderRadius: theme.radius.pill,
          paddingHorizontal: theme.spacing.xs,
          paddingVertical: theme.spacing.xxs,
        },
        style,
      ]}
    >
      {icon ? (
        <View accessibilityElementsHidden style={{ marginRight: theme.spacing.xxs }}>
          {icon}
        </View>
      ) : null}
      <Text style={[theme.typography.caption, { color }, labelStyle]}>{label}</Text>
    </View>
  );
}

export type StatusChipProps = { status: StatusLabel; label?: string; style?: ViewComponentStyle };

export function StatusChip({ status, label = status, style }: StatusChipProps) {
  const { theme } = useAppTheme();
  const tone: Record<StatusLabel, FeedbackTone> = {
    Pago: 'success',
    'Não Pago': 'warning',
    Entregue: 'success',
    Pendente: 'warning',
    Emitido: 'info',
    'A emitir': 'danger',
  };
  const icon =
    status === 'Pago'
      ? theme.icons.status.paid
      : status === 'Não Pago'
        ? theme.icons.status.unpaid
        : status === 'Entregue'
          ? theme.icons.status.delivered
          : status === 'Pendente'
            ? theme.icons.status.pending
            : status === 'Emitido'
              ? theme.icons.status.issued
              : theme.icons.status.toIssue;

  return (
    <Badge
      icon={
        <Ionicons color={theme.colors[tone[status]]} name={icon} size={theme.sizes.iconSmall} />
      }
      label={label}
      style={style}
      tone={tone[status]}
    />
  );
}

export type ProgressBarProps = {
  progress?: number;
  label?: string;
  indeterminate?: boolean;
  tone?: FeedbackTone;
  style?: ViewComponentStyle;
};

export function ProgressBar({
  progress = 0,
  label,
  indeterminate = false,
  tone = 'info',
  style,
}: ProgressBarProps) {
  const { theme } = useAppTheme();
  const boundedProgress = Math.max(0, Math.min(1, progress));
  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="progressbar"
      accessibilityValue={indeterminate ? undefined : { min: 0, max: 1, now: boundedProgress }}
      style={style}
    >
      {label ? (
        <Text
          style={[
            theme.typography.footnote,
            { color: theme.colors.textSecondary, marginBottom: theme.spacing.xs },
          ]}
        >
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.progressTrack,
          {
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: theme.radius.pill,
            height: theme.sizes.progressBarHeight,
          },
        ]}
      >
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: theme.colors[tone],
              borderRadius: theme.radius.pill,
              width: indeterminate ? '35%' : `${boundedProgress * 100}%`,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  loading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  overlay: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 10,
  },
  overlayContent: { alignItems: 'center' },
  state: { alignItems: 'center', justifyContent: 'center' },
  toast: { position: 'absolute', zIndex: 20 },
  badge: { alignSelf: 'flex-start' },
  progressTrack: { overflow: 'hidden', width: '100%' },
  progressFill: { height: '100%' },
});
