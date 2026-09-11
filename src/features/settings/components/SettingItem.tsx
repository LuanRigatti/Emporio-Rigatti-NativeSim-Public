import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';

import SettingsIcon from './SettingsIcon';
import type { SettingsIconProps } from './SettingsIcon.types';

export type SettingItemProps = {
  title: string;
  description?: string;
  disabled?: boolean;
  systemName: SettingsIconProps['systemName'];
  fallbackIcon: SettingsIconProps['fallbackIcon'];
  isLast?: boolean;
  leadingInset?: number;
  onPress?: () => void;
  trailingInset?: number;
};

export function SettingItem({
  description,
  disabled = false,
  fallbackIcon,
  onPress,
  leadingInset,
  systemName,
  title,
  trailingInset = 8,
}: SettingItemProps) {
  const { theme } = useAppTheme();
  const handlePress = onPress && !disabled
    ? () => {
        triggerLightImpactHaptic();
        onPress();
      }
    : undefined;

  const content = (
    <>
      <View style={styles.iconSlot}>
        <SettingsIcon
          color={theme.colors.textPrimary}
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
      <View
        style={[styles.trailingIcon, { marginRight: trailingInset, width: theme.sizes.iconSmall }]}
      >
        <SettingsIcon
          color={theme.colors.textTertiary}
          fallbackIcon="chevron-forward"
          size={theme.sizes.iconSmall}
          systemName="chevron.right"
        />
      </View>
    </>
  );

  return (
    <Pressable
      accessibilityHint={onPress ? undefined : 'Disponível futuramente'}
      accessibilityLabel={description ? `${title}, ${description}` : title}
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress || disabled}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.row,
        {
          marginHorizontal: -theme.spacing.xs,
          minHeight: theme.sizes.touchTargetMinimum + theme.spacing.xs,
          opacity: pressed ? theme.opacities.pressed : 1,
          paddingLeft: leadingInset ?? theme.spacing.md,
          paddingRight: trailingInset,
          width: '100%',
        },
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingVertical: 12 },
  iconSlot: { alignItems: 'center', justifyContent: 'center', width: 34 },
  content: { flex: 1, gap: 2 },
  trailingIcon: {
    alignItems: 'flex-end',
    flexShrink: 0,
    justifyContent: 'center',
  },
});
