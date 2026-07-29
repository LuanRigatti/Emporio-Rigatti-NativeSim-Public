import { StyleSheet, View } from 'react-native';

import { NativeGlassMenu, type NativeMenuAction } from '@/components/native';
import { useAppTheme } from '@/theme';

import HistorySymbolIcon from './HistorySymbolIcon';

export type DeliveryLocationActionsProps = {
  customerName: string;
  onOpenWaze: () => void;
  onOpenAppleMaps: () => void;
};

export function DeliveryLocationActions({
  customerName,
  onOpenAppleMaps,
  onOpenWaze,
}: DeliveryLocationActionsProps) {
  const { theme } = useAppTheme();
  const actions: readonly NativeMenuAction[] = [
    {
      id: 'waze',
      title: 'Abrir no Waze',
      systemImage: 'car.fill',
      onPress: onOpenWaze,
    },
    {
      id: 'apple-maps',
      title: 'Abrir no Apple Maps',
      systemImage: 'map.fill',
      onPress: onOpenAppleMaps,
    },
  ];

  return (
    <NativeGlassMenu
      accessibilityLabel={`Ações da entrega de ${customerName}`}
      actions={actions}
      color={theme.colors.textPrimary}
      containerSize={32}
      fallbackIcon="ellipsis-horizontal"
      size={theme.sizes.iconSmall}
      style={styles.menu}
      systemImage="ellipsis"
      trigger={
        <View style={styles.trigger}>
          <HistorySymbolIcon
            color={theme.colors.textPrimary}
            fallbackIcon="ellipsis-horizontal"
            size={theme.sizes.iconSmall}
            systemName="ellipsis"
          />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  menu: { height: 32, width: 32 },
  trigger: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
});
