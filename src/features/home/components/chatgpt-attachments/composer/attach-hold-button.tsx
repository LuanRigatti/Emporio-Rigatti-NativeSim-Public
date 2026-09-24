import { Image } from 'expo-image';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type {
  GestureStateChangeEvent,
  GestureUpdateEvent,
  PanGestureHandlerEventPayload,
} from 'react-native-gesture-handler';
import { useAppTheme } from '@/theme';
import { AttachmentIcon } from '../AttachmentIcon';
import { COMPOSER } from '../constants';
import type { LibraryPhoto } from '../photos/use-photo-library';
import {
  HOLD_MENU_ANIMATION,
  HOLD_MENU_DOCK,
  HOLD_MENU_GESTURE,
  HOLD_MENU_LAYOUT,
} from './hold-menu.constants';
import { createComposerPlusGesture } from './plus-gesture';
import { findHoldTileIndex, getHoldReleaseSelection, getHoldTrayMetrics } from './hold-menu';
import { PhotoHoldMenu } from './photo-hold-menu';

interface AttachHoldButtonProps {
  photos: readonly LibraryPhoto[];
  attachmentCount: number;
  holdEnabled: boolean;
  plusOut: SharedValue<number>;
  composerBottom: SharedValue<number>;
  strip: SharedValue<number>;
  screenWidth: number;
  onPress: () => void;
  onPhotoSelect: (photo: LibraryPhoto) => void;
  onDockSettled: (photoId: string) => void;
}

const BUTTON_RADIUS = COMPOSER.plusHit / 2;
const DOCK_TIMING = {
  duration: HOLD_MENU_DOCK.duration,
  easing: Easing.bezier(0.22, 1, 0.36, 1),
};

export const AttachHoldButton = memo(function AttachHoldButton({
  photos,
  attachmentCount,
  holdEnabled,
  plusOut,
  composerBottom,
  strip,
  screenWidth,
  onPress,
  onPhotoSelect,
  onDockSettled,
}: AttachHoldButtonProps) {
  const { theme } = useAppTheme();
  const tiles = useMemo(() => photos.slice(0, HOLD_MENU_LAYOUT.maxTiles), [photos]);
  const [isMenuMounted, setIsMenuMounted] = useState(false);
  const [bandAnchorY, setBandAnchorY] = useState(0);
  const anchorX = useSharedValue(0);
  const anchorY = useSharedValue(0);
  const open = useSharedValue(0);
  const isOpen = useSharedValue(false);
  const isTouching = useSharedValue(false);
  const hovered = useSharedValue(-1);
  const dockingIndex = useSharedValue(-1);
  const pendingCard = useSharedValue(-1);
  const dockProgress = useSharedValue(0);
  const dock = useMemo(() => ({ pendingCard, dockProgress }), [dockProgress, pendingCard]);

  useEffect(() => {
    if (tiles.length) void Image.prefetch(tiles.map((photo) => photo.id));
  }, [tiles]);

  const mountMenu = useCallback((anchor: number) => {
    setBandAnchorY(anchor);
    setIsMenuMounted(true);
  }, []);
  const unmountMenu = useCallback(() => setIsMenuMounted(false), []);
  const handleTap = useCallback(() => onPress(), [onPress]);
  const handleSelect = useCallback(
    (index: number) => {
      const photo = tiles[index];
      if (photo) onPhotoSelect(photo);
    },
    [onPhotoSelect, tiles],
  );

  const unmountWhenIdle = useCallback(() => {
    'worklet';
    const isDocking = dockingIndex.get() >= 0 && pendingCard.get() >= 0;
    if (!isTouching.get() && open.get() < HOLD_MENU_ANIMATION.settled && !isDocking) {
      scheduleOnRN(unmountMenu);
    }
  }, [dockingIndex, isTouching, open, pendingCard, unmountMenu]);
  const unmountWhenSettled = useCallback(
    (finished?: boolean) => {
      'worklet';
      if (finished) unmountWhenIdle();
    },
    [unmountWhenIdle],
  );
  const closeMenu = useCallback(() => {
    'worklet';
    isOpen.set(false);
    hovered.set(-1);
    open.set(withSpring(0, HOLD_MENU_ANIMATION.closeSpring, unmountWhenSettled));
  }, [hovered, isOpen, open, unmountWhenSettled]);
  const selectTile = useCallback(
    (index: number) => {
      'worklet';
      const photoId = tiles[index]?.id;
      if (!photoId) {
        closeMenu();
        return;
      }

      dockingIndex.set(index);
      pendingCard.set(attachmentCount);
      dockProgress.set(
        withTiming(1, DOCK_TIMING, (finished) => {
          'worklet';
          if (finished) {
            pendingCard.set(-1);
            scheduleOnRN(onDockSettled, photoId);
            unmountWhenIdle();
          }
        }),
      );
      scheduleOnRN(handleSelect, index);
      closeMenu();
    },
    [
      attachmentCount,
      closeMenu,
      dockProgress,
      dockingIndex,
      handleSelect,
      onDockSettled,
      pendingCard,
      tiles,
      unmountWhenIdle,
    ],
  );

  const onHoldBegin = useCallback(
    (event: GestureStateChangeEvent<PanGestureHandlerEventPayload>) => {
      'worklet';
      anchorX.set(event.absoluteX - event.x + BUTTON_RADIUS);
      anchorY.set(event.absoluteY - event.y + BUTTON_RADIUS);
      dockingIndex.set(-1);
      dockProgress.set(0);
      pendingCard.set(-1);
      hovered.set(-1);
      isTouching.set(true);
      scheduleOnRN(mountMenu, anchorY.get());
    },
    [anchorX, anchorY, dockProgress, dockingIndex, hovered, isTouching, mountMenu, pendingCard],
  );
  const onHoldStart = useCallback(
    (_event: GestureStateChangeEvent<PanGestureHandlerEventPayload>) => {
      'worklet';
      isOpen.set(true);
      open.set(withSpring(1, HOLD_MENU_ANIMATION.openSpring));
    },
    [isOpen, open],
  );
  const onHoldUpdate = useCallback(
    (event: GestureUpdateEvent<PanGestureHandlerEventPayload>) => {
      'worklet';
      const tray = getHoldTrayMetrics(tiles.length, screenWidth, anchorY.get());
      const next = findHoldTileIndex(event.absoluteX, event.absoluteY, tiles.length, tray);
      if (next !== hovered.get()) hovered.set(next);
    },
    [anchorY, hovered, screenWidth, tiles.length],
  );
  const onHoldFinalize = useCallback(
    (_event: GestureStateChangeEvent<PanGestureHandlerEventPayload>, success: boolean) => {
      'worklet';
      isTouching.set(false);
      if (!isOpen.get() || !success) {
        closeMenu();
        return;
      }
      const selected = getHoldReleaseSelection(isOpen.get(), hovered.get());
      if (selected >= 0) selectTile(selected);
      else closeMenu();
    },
    [closeMenu, hovered, isOpen, isTouching, selectTile],
  );

  const gesture = useMemo(
    () =>
      createComposerPlusGesture({
        holdEnabled: holdEnabled && tiles.length > 0,
        onTap: handleTap,
        onHoldBegin,
        onHoldStart,
        onHoldUpdate,
        onHoldFinalize,
      }),
    [handleTap, holdEnabled, onHoldBegin, onHoldFinalize, onHoldStart, onHoldUpdate, tiles.length],
  );
  const plusStyle = useAnimatedStyle(() => ({
    opacity:
      interpolate(plusOut.get(), [0, 0.75], [1, 0], Extrapolation.CLAMP) *
      (open.get() > HOLD_MENU_ANIMATION.settled ? 0 : 1),
    transform: [{ translateX: plusOut.get() * COMPOSER.plusSlide }],
  }));

  return (
    <>
      <GestureDetector gesture={gesture}>
        <Animated.View
          accessible
          accessibilityRole="button"
          accessibilityLabel="Adicionar anexo"
          accessibilityHint="Toque para abrir os anexos. Segure para escolher uma foto recente."
          hitSlop={HOLD_MENU_GESTURE.buttonHitSlop}
          onAccessibilityTap={handleTap}
          collapsable={false}
          style={styles.button}
          testID="composer-plus-button"
        >
          <Animated.View style={plusStyle}>
            <AttachmentIcon name="plus" size={COMPOSER.plusSize} color={theme.colors.textPrimary} />
          </Animated.View>
        </Animated.View>
      </GestureDetector>
      <PhotoHoldMenu
        visible={isMenuMounted}
        bandAnchorY={bandAnchorY}
        photos={tiles}
        anchorX={anchorX}
        anchorY={anchorY}
        open={open}
        isOpen={isOpen}
        hovered={hovered}
        dockingIndex={dockingIndex}
        dock={dock}
        composerBottom={composerBottom}
        strip={strip}
      />
    </>
  );
});

const styles = StyleSheet.create({
  button: {
    width: COMPOSER.plusHit,
    height: COMPOSER.plusHit,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
