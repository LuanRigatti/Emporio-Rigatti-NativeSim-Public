import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useAppTheme } from '@/theme';

import type { TextComponentStyle, ViewComponentStyle } from '../types';

export type ScreenProps = {
  children: ReactNode;
  style?: ViewComponentStyle;
};

export function Screen({ children, style }: ScreenProps) {
  const { theme } = useAppTheme();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.background }, style]}>
      {children}
    </SafeAreaView>
  );
}

export type ScrollScreenProps = ScreenProps & {
  contentContainerStyle?: ViewComponentStyle;
  refreshing?: boolean;
  onRefresh?: () => void;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
};

export function ScrollScreen({
  children,
  style,
  contentContainerStyle,
  refreshing = false,
  onRefresh,
  keyboardShouldPersistTaps = 'handled',
}: ScrollScreenProps) {
  const { theme } = useAppTheme();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.background }, style]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              colors={[theme.colors.primary]}
              onRefresh={onRefresh}
              refreshing={refreshing}
              tintColor={theme.colors.primary}
            />
          ) : undefined
        }
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export type KeyboardScreenProps = ScreenProps & {
  keyboardVerticalOffset?: number;
};

export function KeyboardScreen({
  children,
  style,
  keyboardVerticalOffset = 0,
}: KeyboardScreenProps) {
  const { theme } = useAppTheme();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.background }, style]}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', default: 'height' })}
        keyboardVerticalOffset={keyboardVerticalOffset}
        style={styles.screen}
      >
        {children}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export type AppHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
  style?: ViewComponentStyle;
  titleStyle?: TextComponentStyle;
};

export function AppHeader({
  title,
  subtitle,
  onBack,
  leftAction,
  rightAction,
  style,
  titleStyle,
}: AppHeaderProps) {
  const { theme } = useAppTheme();
  const { colors, typography, spacing, sizes } = theme;

  return (
    <View
      style={[
        styles.header,
        { paddingHorizontal: spacing.md, minHeight: sizes.touchTargetMinimum },
        style,
      ]}
    >
      <View style={[styles.headerSide, { minWidth: sizes.touchTargetMinimum }]}>
        {onBack ? (
          <Pressable
            accessibilityLabel="Voltar"
            accessibilityRole="button"
            onPress={onBack}
            style={[
              styles.headerButton,
              { minHeight: sizes.touchTargetMinimum, minWidth: sizes.touchTargetMinimum },
            ]}
          >
            <Ionicons color={colors.primary} name="arrow-back" size={sizes.iconMedium} />
          </Pressable>
        ) : null}
        {leftAction}
      </View>
      <View style={[styles.headerTitleContainer, { paddingHorizontal: spacing.xs }]}>
        <Text
          numberOfLines={1}
          style={[typography.headline, { color: colors.textPrimary }, titleStyle]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[typography.footnote, { color: colors.textSecondary, marginTop: spacing.xxs }]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={[styles.headerSide, { minWidth: sizes.touchTargetMinimum }]}>{rightAction}</View>
    </View>
  );
}

export type LargeTitleHeaderProps = Omit<AppHeaderProps, 'onBack'> & {
  onBack?: () => void;
};

export function LargeTitleHeader(props: LargeTitleHeaderProps) {
  const { theme } = useAppTheme();
  const { colors, typography, spacing, sizes } = theme;

  return (
    <View style={[styles.largeHeader, { paddingHorizontal: spacing.md }]}>
      <View style={[styles.largeHeaderTop, { minHeight: sizes.touchTargetMinimum }]}>
        <View style={[styles.headerSide, { minWidth: sizes.touchTargetMinimum }]}>
          {props.onBack ? (
            <Pressable
              accessibilityLabel="Voltar"
              accessibilityRole="button"
              onPress={props.onBack}
              style={[
                styles.headerButton,
                { minHeight: sizes.touchTargetMinimum, minWidth: sizes.touchTargetMinimum },
              ]}
            >
              <Ionicons color={colors.primary} name="arrow-back" size={sizes.iconMedium} />
            </Pressable>
          ) : null}
          {props.leftAction}
        </View>
        <View style={[styles.headerSide, { minWidth: sizes.touchTargetMinimum }]}>
          {props.rightAction}
        </View>
      </View>
      <Text style={[typography.largeTitle, { color: colors.textPrimary, marginTop: spacing.sm }]}>
        {props.title}
      </Text>
      {props.subtitle ? (
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xs }]}>
          {props.subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export type SectionProps = {
  children: ReactNode;
  title?: string;
  style?: ViewComponentStyle;
};

export function Section({ children, title, style }: SectionProps) {
  const { theme } = useAppTheme();

  return (
    <View style={[{ marginBottom: theme.layout.sectionSpacing }, style]}>
      {title ? <SectionHeader title={title} /> : null}
      <View style={{ gap: theme.spacing.md }}>{children}</View>
    </View>
  );
}

export type SectionHeaderProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  style?: ViewComponentStyle;
};

export function SectionHeader({
  title,
  description,
  actionLabel,
  onActionPress,
  style,
}: SectionHeaderProps) {
  const { theme } = useAppTheme();
  const { colors, typography, spacing, sizes } = theme;

  return (
    <View style={[styles.sectionHeader, { marginBottom: spacing.sm }, style]}>
      <View style={styles.sectionTitle}>
        <Text style={[typography.title3, { color: colors.textPrimary }]}>{title}</Text>
        {description ? (
          <Text
            style={[
              typography.subheadline,
              { color: colors.textSecondary, marginTop: spacing.xxs },
            ]}
          >
            {description}
          </Text>
        ) : null}
      </View>
      {actionLabel ? (
        <Pressable
          accessibilityRole="button"
          onPress={onActionPress}
          style={{ minHeight: sizes.touchTargetMinimum, justifyContent: 'center' }}
        >
          <Text style={[typography.subheadline, { color: colors.primary }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export type DividerProps = {
  inset?: boolean;
  orientation?: 'horizontal' | 'vertical';
};

export function Divider({ inset = false, orientation = 'horizontal' }: DividerProps) {
  const { theme } = useAppTheme();
  const isHorizontal = orientation === 'horizontal';

  return (
    <View
      style={[
        isHorizontal ? styles.dividerHorizontal : styles.dividerVertical,
        {
          backgroundColor: theme.colors.separator,
          marginLeft: inset && isHorizontal ? theme.spacing.md : 0,
        },
      ]}
    />
  );
}

export type SpacerProps = {
  size?: keyof typeof import('@/theme').spacing;
};

export function Spacer({ size = 'md' }: SpacerProps) {
  const { theme } = useAppTheme();
  return <View style={{ height: theme.spacing[size] }} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headerSide: { alignItems: 'center', flexDirection: 'row' },
  largeHeaderTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headerButton: { alignItems: 'center', justifyContent: 'center' },
  headerTitleContainer: { alignItems: 'center', flex: 1 },
  largeHeader: {},
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { flex: 1 },
  dividerHorizontal: { height: StyleSheet.hairlineWidth, width: '100%' },
  dividerVertical: { height: '100%', width: StyleSheet.hairlineWidth },
});
