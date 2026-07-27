import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/premium';
import { useAppTheme } from '@/theme';
import { triggerSelectionHaptic } from '@/utils/haptics';

export type PeriodPickerItem = {
  value: number;
  label: string;
};

export type PeriodPickerAnchorRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PeriodPickerMenuProps = {
  visible: boolean;
  items: readonly PeriodPickerItem[];
  selectedValue: number;
  anchorRect: PeriodPickerAnchorRect;
  onClose: () => void;
  onSelect: (value: number) => void;
};

const MENU_WIDTH = 184;
const MENU_MAX_HEIGHT = 320;
const ITEM_HEIGHT = 44;
const SCREEN_MARGIN = 12;

export function PeriodPickerMenu({
  anchorRect,
  items,
  onClose,
  onSelect,
  selectedValue,
  visible,
}: PeriodPickerMenuProps) {
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { reduceMotionEnabled, theme } = useAppTheme();

  if (!visible) return null;

  const menuHeight = Math.min(MENU_MAX_HEIGHT, items.length * ITEM_HEIGHT + theme.spacing.xxs * 2);
  const maxLeft = Math.max(SCREEN_MARGIN, screenWidth - MENU_WIDTH - SCREEN_MARGIN);
  const left = Math.min(
    maxLeft,
    Math.max(SCREEN_MARGIN, anchorRect.x + anchorRect.width - MENU_WIDTH),
  );
  const bottomLimit = screenHeight - insets.bottom - SCREEN_MARGIN;
  const canOpenBelow = anchorRect.y + anchorRect.height + menuHeight + SCREEN_MARGIN <= bottomLimit;
  const preferredTop = canOpenBelow
    ? anchorRect.y + anchorRect.height + SCREEN_MARGIN
    : anchorRect.y - menuHeight - SCREEN_MARGIN;
  const top = Math.max(
    insets.top + SCREEN_MARGIN,
    Math.min(preferredTop, bottomLimit - menuHeight),
  );
  const transitionDuration = reduceMotionEnabled
    ? theme.animations.duration.instant
    : theme.animations.duration.fast;

  return (
    <Modal animationType="none" onRequestClose={onClose} transparent visible>
      <View pointerEvents="box-none" style={styles.modalRoot}>
        <Pressable
          accessibilityLabel="Fechar seletor de período"
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
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              {items.map((item) => {
                const selected = item.value === selectedValue;
                return (
                  <Pressable
                    accessibilityLabel={item.label}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={item.value}
                    onPress={() => {
                      triggerSelectionHaptic();
                      onSelect(item.value);
                    }}
                    style={({ pressed }) => [
                      styles.item,
                      {
                        backgroundColor: selected
                          ? theme.colors.backgroundSecondary
                          : pressed
                            ? theme.colors.glassBorder
                            : 'transparent',
                        borderRadius: theme.radius.md,
                      },
                    ]}
                  >
                    <Text style={[theme.typography.callout, { color: theme.colors.textPrimary }]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </GlassSurface>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1 },
  menuAnchor: { position: 'absolute' },
  menu: { maxHeight: MENU_MAX_HEIGHT, overflow: 'hidden', width: '100%' },
  item: { justifyContent: 'center', minHeight: ITEM_HEIGHT, paddingHorizontal: 12 },
});
