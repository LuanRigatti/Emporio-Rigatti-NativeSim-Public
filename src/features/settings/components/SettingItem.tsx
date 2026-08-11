import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/premium';
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
  onPress,
  systemName,
  title,
}: SettingItemProps) {
  const { theme } = useAppTheme();
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
      <View style={[styles.trailingIcon, { width: theme.sizes.iconSmall }]}>
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
    <GlassCard
      style={{
        borderRadius: theme.radius.xl + theme.spacing.xs,
        marginHorizontal: -theme.spacing.xs,
        padding: 0,
      }}
    >
      <Pressable
        accessibilityHint={onPress ? undefined : 'Disponível futuramente'}
        accessibilityLabel={description ? `${title}, ${description}` : title}
        accessibilityRole={onPress ? 'button' : undefined}
        disabled={!onPress}
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          {
            minHeight: theme.sizes.touchTargetMinimum + theme.spacing.xs,
            opacity: pressed ? theme.opacities.pressed : 1,
            paddingLeft: theme.spacing.md,
            paddingRight: theme.spacing.xs,
          },
        ]}
      >
        {content}
      </Pressable>
    </GlassCard>
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
    marginRight: 8,
  },
});
