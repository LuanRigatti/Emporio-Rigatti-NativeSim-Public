import { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/premium';
import { useAppTheme } from '@/theme';
import { triggerSelectionHaptic } from '@/utils/haptics';

import type { DeliveryActionsAnchorRect } from './DeliveryActionsPopover';
import HistorySymbolIcon from './HistorySymbolIcon';

export type DeliveryLocationActionsProps = {
  address?: string;
  neighborhood?: string;
  latitude?: number;
  longitude?: number;
  distance?: string;
  customerName: string;
  expanded: boolean;
  onOpen: (anchorRect: DeliveryActionsAnchorRect) => void;
};

export function DeliveryLocationActions({
  customerName,
  expanded,
  onOpen,
}: DeliveryLocationActionsProps) {
  const { theme } = useAppTheme();
  const buttonRef = useRef<View>(null);

  const handlePress = () => {
    triggerSelectionHaptic();
    buttonRef.current?.measureInWindow((x, y, width, height) => {
      onOpen({ height, width, x, y });
    });
  };

  return (
    <GlassSurface
      interactive
      style={[
        styles.controlSurface,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.separator,
          borderRadius: theme.radius.pill,
          height: 32,
          width: 32,
        },
      ]}
    >
      <Pressable
        accessibilityHint={expanded ? 'Fecha o menu de ações' : 'Abre o menu de ações'}
        accessibilityLabel={`Ações da entrega de ${customerName}`}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        hitSlop={8}
        onPress={handlePress}
        ref={buttonRef}
        style={({ pressed }) => [styles.button, { opacity: pressed ? theme.opacities.pressed : 1 }]}
      >
        <HistorySymbolIcon
          color={theme.colors.textPrimary}
          fallbackIcon="ellipsis-horizontal"
          size={theme.sizes.iconSmall}
          systemName="ellipsis"
        />
      </Pressable>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  controlSurface: { overflow: 'hidden' },
  button: {
    alignItems: 'center',
    flex: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
});
