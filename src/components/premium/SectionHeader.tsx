import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme';
import { triggerSelectionHaptic } from '@/utils/haptics';

export type PremiumSectionHeaderProps = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function SectionHeader({
  actionLabel,
  onActionPress,
  style,
  subtitle,
  title,
  trailing,
}: PremiumSectionHeaderProps) {
  const { theme } = useAppTheme();

  return (
    <View style={[styles.container, style]}>
      <View style={styles.content}>
        <Text
          allowFontScaling
          style={[theme.typography.title3, { color: theme.colors.textPrimary }]}
        >
          {title}
        </Text>
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
      {actionLabel && onActionPress ? (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          onPress={() => {
            triggerSelectionHaptic();
            onActionPress();
          }}
          style={{ minHeight: theme.sizes.touchTargetMinimum, justifyContent: 'center' }}
        >
          <Text style={[theme.typography.subheadline, { color: theme.colors.primary }]}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : (
        trailing
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  content: { flex: 1 },
});
