import { StyleSheet, View } from 'react-native';

import { AnimatedPressable } from '@/components/premium';
import { useAppTheme } from '@/theme';

import type { DeliveryStatus } from '../data/historyMocks';

export type DeliveryStatusBadgeProps = {
  status: DeliveryStatus;
  onPress: () => void;
};

function statusLabel(status: DeliveryStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function DeliveryStatusBadge({ onPress, status }: DeliveryStatusBadgeProps) {
  const { theme } = useAppTheme();
  const statusColors = {
    concluída: { background: theme.colors.successSurface, foreground: theme.colors.success },
    pendente: { background: theme.colors.warningSurface, foreground: theme.colors.warning },
  }[status];

  return (
    <AnimatedPressable
      accessibilityLabel={`Status: ${statusLabel(status)}`}
      accessibilityHint="Toque para alternar entre pendente e concluída"
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.badge,
        {
          backgroundColor: statusColors.background,
          borderRadius: theme.radius.pill,
          gap: theme.spacing.xxs,
          height: theme.sizes.avatarSmall - theme.spacing.xs,
          justifyContent: 'center',
          opacity: 1,
          padding: 0,
          width: theme.sizes.avatarSmall - theme.spacing.xs,
        },
      ]}
    >
      <View
        style={[
          styles.dot,
          { backgroundColor: statusColors.foreground, borderRadius: theme.radius.pill },
        ]}
      />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row' },
  dot: { height: 8, width: 8 },
});
