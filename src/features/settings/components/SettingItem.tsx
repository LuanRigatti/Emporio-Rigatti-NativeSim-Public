import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

import SettingsIcon from './SettingsIcon';
import type { SettingsIconProps } from './SettingsIcon.types';

export type SettingItemProps = {
  title: string;
  description?: string;
  systemName: SettingsIconProps['systemName'];
  fallbackIcon: SettingsIconProps['fallbackIcon'];
  isLast?: boolean;
  onPress?: () => void;
};

export function SettingItem({
  description,
  fallbackIcon,
  isLast = false,
  onPress,
  systemName,
  title,
}: SettingItemProps) {
  const { theme } = useAppTheme();
  const content = (
    <>
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderRadius: theme.radius.md,
            height: 34,
            width: 34,
          },
        ]}
      >
        <SettingsIcon
          color={theme.colors.textSecondary}
          fallbackIcon={fallbackIcon}
          size={theme.sizes.iconSmall}
          systemName={systemName}
        />
      </View>
      <View style={styles.content}>
        <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>{title}</Text>
        {description ? (
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            {description}
          </Text>
        ) : null}
      </View>
      <SettingsIcon
        color={theme.colors.textTertiary}
        fallbackIcon="chevron-forward"
        size={theme.sizes.iconSmall}
        systemName="chevron.right"
      />
    </>
  );

  return (
    <Pressable
      accessibilityHint={onPress ? undefined : 'Disponível futuramente'}
      accessibilityLabel={description ? `${title}, ${description}` : title}
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: theme.colors.separator,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
          minHeight: theme.sizes.touchTargetMinimum + theme.spacing.xs,
          opacity: pressed ? theme.opacities.pressed : 1,
        },
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingVertical: 10 },
  iconContainer: { alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, gap: 2 },
});
