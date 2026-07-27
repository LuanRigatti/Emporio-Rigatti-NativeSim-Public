import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme';

import type { DeliveryStatus } from '../data/historyMocks';

export type DeliveryStatusIndicatorProps = {
  status: DeliveryStatus;
};

export function DeliveryStatusIndicator({ status }: DeliveryStatusIndicatorProps) {
  const { theme } = useAppTheme();
  const color = {
    concluída: theme.colors.success,
    pendente: theme.colors.warning,
  }[status];

  return <View style={[styles.indicator, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  indicator: { borderRadius: 3, marginVertical: 3, width: 3 },
});
