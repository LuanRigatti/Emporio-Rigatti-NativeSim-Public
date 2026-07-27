import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/premium';
import { useAppTheme } from '@/theme';
import { triggerSelectionHaptic } from '@/utils/haptics';

import HistorySymbolIcon from './HistorySymbolIcon';

export type DeliveryActionsAnchorRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DeliveryActionsPopoverProps = {
  visible: boolean;
  anchorRect: DeliveryActionsAnchorRect;
  onClose: () => void;
  onOpenWaze: () => void;
  onOpenAppleMaps: () => void;
};

const MENU_WIDTH = 208;
const MENU_HEIGHT = 104;
const SCREEN_MARGIN = 12;

export function DeliveryActionsPopover({
  anchorRect,
  onClose,
  onOpenAppleMaps,
  onOpenWaze,
  visible,
}: DeliveryActionsPopoverProps) {
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { reduceMotionEnabled, theme } = useAppTheme();

  if (!visible) return null;

  const maxLeft = Math.max(SCREEN_MARGIN, screenWidth - MENU_WIDTH - SCREEN_MARGIN);
  const left = Math.min(
    maxLeft,
    Math.max(SCREEN_MARGIN, anchorRect.x + anchorRect.width - MENU_WIDTH),
  );
  const bottomLimit = screenHeight - insets.bottom - SCREEN_MARGIN;
  const canOpenBelow =
    anchorRect.y + anchorRect.height + MENU_HEIGHT + SCREEN_MARGIN <= bottomLimit;
  const preferredTop = canOpenBelow
    ? anchorRect.y + anchorRect.height + SCREEN_MARGIN
    : anchorRect.y - MENU_HEIGHT - SCREEN_MARGIN;
  const top = Math.max(
    insets.top + SCREEN_MARGIN,
    Math.min(preferredTop, bottomLimit - MENU_HEIGHT),
  );

  const transitionDuration = reduceMotionEnabled
    ? theme.animations.duration.instant
    : theme.animations.duration.fast;

  return (
    <Modal animationType="none" onRequestClose={onClose} transparent visible>
      <View pointerEvents="box-none" style={styles.modalRoot}>
        <Pressable
          accessibilityLabel="Fechar menu de ações"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          entering={ZoomIn.duration(transitionDuration)}
          exiting={ZoomOut.duration(transitionDuration)}
          style={[styles.menuAnchor, { left, top, width: MENU_WIDTH }]}
        >
          <GlassSurface
            interactive
            style={[
              styles.menu,
              theme.shadows.elevated,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.separator,
                borderRadius: theme.radius.lg,
                padding: theme.spacing.xxs,
              },
            ]}
          >
            <Pressable
              accessibilityHint="Ação mock, sem abrir aplicativo externo"
              accessibilityLabel="Abrir no Waze"
              accessibilityRole="button"
              onPress={() => {
                triggerSelectionHaptic();
                onOpenWaze();
              }}
              style={({ pressed }) => [
                styles.menuItem,
                {
                  backgroundColor: pressed ? theme.colors.glassBorder : 'transparent',
                  borderRadius: theme.radius.md,
                },
              ]}
            >
              <HistorySymbolIcon
                color={theme.colors.textSecondary}
                fallbackIcon="navigate-outline"
                size={theme.sizes.iconSmall}
                systemName="car.fill"
              />
              <Text style={[theme.typography.callout, { color: theme.colors.textPrimary }]}>
                Abrir no Waze
              </Text>
            </Pressable>
            <Pressable
              accessibilityHint="Ação mock, sem abrir aplicativo externo"
              accessibilityLabel="Abrir no Apple Maps"
              accessibilityRole="button"
              onPress={() => {
                triggerSelectionHaptic();
                onOpenAppleMaps();
              }}
              style={({ pressed }) => [
                styles.menuItem,
                {
                  backgroundColor: pressed ? theme.colors.glassBorder : 'transparent',
                  borderRadius: theme.radius.md,
                },
              ]}
            >
              <HistorySymbolIcon
                color={theme.colors.textSecondary}
                fallbackIcon="map-outline"
                size={theme.sizes.iconSmall}
                systemName="map.fill"
              />
              <Text style={[theme.typography.callout, { color: theme.colors.textPrimary }]}>
                Abrir no Apple Maps
              </Text>
            </Pressable>
          </GlassSurface>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1 },
  menuAnchor: { position: 'absolute' },
  menu: { overflow: 'hidden', width: '100%' },
  menuItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 12,
  },
});
