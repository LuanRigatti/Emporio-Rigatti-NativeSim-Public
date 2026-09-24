import { memo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { OverKeyboardView } from 'react-native-keyboard-controller';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useAppTheme } from '@/theme';
import { AttachmentIcon } from '../AttachmentIcon';
import { COMPOSER } from '../constants';
import type { LibraryPhoto } from '../photos/use-photo-library';
import { HOLD_MENU_ANIMATION, HOLD_MENU_LAYOUT } from './hold-menu.constants';
import { getHoldTrayMetrics } from './hold-menu';
import { HoldMenuBackdrop } from './hold-menu-backdrop';
import { PhotoTile } from './photo-tile';

interface HoldMenuDock {
  pendingCard: SharedValue<number>;
  dockProgress: SharedValue<number>;
}

interface PhotoHoldMenuProps {
  visible: boolean;
  bandAnchorY: number;
  photos: readonly LibraryPhoto[];
  anchorX: SharedValue<number>;
  anchorY: SharedValue<number>;
  open: SharedValue<number>;
  isOpen: SharedValue<boolean>;
  hovered: SharedValue<number>;
  dockingIndex: SharedValue<number>;
  dock: HoldMenuDock;
  composerBottom: SharedValue<number>;
  strip: SharedValue<number>;
}

export const PhotoHoldMenu = memo(function PhotoHoldMenu({
  visible,
  bandAnchorY,
  photos,
  anchorX,
  anchorY,
  open,
  isOpen,
  hovered,
  dockingIndex,
  dock,
  composerBottom,
  strip,
}: PhotoHoldMenuProps) {
  const { width: windowWidth } = useWindowDimensions();
  const { resolvedMode, theme } = useAppTheme();
  const tileCount = photos.length;
  const tileSize = tileCount ? getHoldTrayMetrics(tileCount, windowWidth, 0).size : 0;
  const fadeHeight = HOLD_MENU_LAYOUT.bandFade + tileSize / 2;
  const holdHeight = tileSize / 2 + HOLD_MENU_LAYOUT.trayOffset + COMPOSER.rowHeight;
  const bandTop =
    bandAnchorY -
    COMPOSER.rowHeight / 2 -
    HOLD_MENU_LAYOUT.trayOffset -
    tileSize -
    HOLD_MENU_LAYOUT.bandFade;

  const bandStyle = useAnimatedStyle(() => ({
    opacity: interpolate(open.get(), [0.15, 1], [0, 1], Extrapolation.CLAMP),
  }));
  const iconStyle = useAnimatedStyle(() => ({
    opacity: open.get() > HOLD_MENU_ANIMATION.settled ? 1 : 0,
    transform: [
      { translateX: anchorX.get() - HOLD_MENU_LAYOUT.iconSize / 2 },
      { translateY: anchorY.get() - HOLD_MENU_LAYOUT.iconSize / 2 },
      { rotate: `${open.get() * HOLD_MENU_LAYOUT.iconRotation}deg` },
    ],
  }));

  return (
    <OverKeyboardView visible={visible}>
      <View pointerEvents="none" style={styles.root} testID="photo-hold-menu">
        <View style={styles.content}>
          <Animated.View style={[styles.band, { top: bandTop }, bandStyle]}>
            <HoldMenuBackdrop fadeHeight={fadeHeight} holdHeight={holdHeight} />
          </Animated.View>
          {photos
            .map((photo, index) => (
              <PhotoTile
                key={photo.id}
                photo={photo}
                index={index}
                count={tileCount}
                windowWidth={windowWidth}
                anchorX={anchorX}
                anchorY={anchorY}
                open={open}
                isOpen={isOpen}
                hovered={hovered}
                dockingIndex={dockingIndex}
                dock={dock}
                composerBottom={composerBottom}
                strip={strip}
                resolvedMode={resolvedMode}
              />
            ))
            .reverse()}
          <Animated.View style={[styles.icon, iconStyle]}>
            <AttachmentIcon
              name="plus"
              size={HOLD_MENU_LAYOUT.iconSize}
              color={theme.colors.textPrimary}
            />
          </Animated.View>
        </View>
      </View>
    </OverKeyboardView>
  );
});

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill },
  content: { ...StyleSheet.absoluteFill, pointerEvents: 'none' },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  icon: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
