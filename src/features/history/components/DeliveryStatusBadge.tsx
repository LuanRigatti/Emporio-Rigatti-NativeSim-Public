import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/premium';
import { useAppTheme } from '@/theme';

import type { DeliveryStatus } from '../data/historyMocks';

export type DeliveryStatusBadgeProps = {
  status: DeliveryStatus;
  onPress: () => void;
};

function statusLabel(status: DeliveryStatus): string {
  return status === 'pendente' ? 'Pendente' : 'Entregue';
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
          borderRadius: theme.radius.md,
          gap: theme.spacing.xxs,
          opacity: 1,
          paddingHorizontal: theme.spacing.xxs + 2,
          paddingVertical: 2,
        },
      ]}
      >
        <View
        style={[
          styles.dot,
          { backgroundColor: statusColors.foreground, borderRadius: theme.radius.pill },
        ]}
      />
      <Text style={[theme.typography.caption, { color: statusColors.foreground }]}>
        {statusLabel(status)}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row' },
  dot: { height: 6, width: 6 },
});
