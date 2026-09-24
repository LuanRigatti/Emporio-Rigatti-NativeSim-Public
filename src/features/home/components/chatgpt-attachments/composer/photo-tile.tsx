import { GaussianBlurView } from 'expo-backdrop';
import { Image } from 'expo-image';
import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { COMPOSER } from '../constants';
import type { LibraryPhoto } from '../photos/use-photo-library';
import { HOLD_MENU_ANIMATION, HOLD_MENU_LAYOUT, HOLD_MENU_PALETTE } from './hold-menu.constants';
import {
  getComposerDockTarget,
  getHoldBlurMix,
  getHoldSpreadPeak,
  getHoldTileCenterX,
  getHoldTrayMetrics,
} from './hold-menu';

interface HoldMenuDock {
  pendingCard: SharedValue<number>;
  dockProgress: SharedValue<number>;
}

interface PhotoTileProps {
  photo: LibraryPhoto;
  index: number;
  count: number;
  windowWidth: number;
  anchorX: SharedValue<number>;
  anchorY: SharedValue<number>;
  open: SharedValue<number>;
  isOpen: SharedValue<boolean>;
  hovered: SharedValue<number>;
  dockingIndex: SharedValue<number>;
  dock: HoldMenuDock;
  composerBottom: SharedValue<number>;
  strip: SharedValue<number>;
  resolvedMode: 'light' | 'dark';
}

export const PhotoTile = memo(function PhotoTile({
  photo,
  index,
  count,
  windowWidth,
  anchorX,
  anchorY,
  open,
  isOpen,
  hovered,
  dockingIndex,
  dock,
  composerBottom,
  strip,
  resolvedMode,
}: PhotoTileProps) {
  const { pendingCard, dockProgress } = dock;
  const palette = HOLD_MENU_PALETTE[resolvedMode];
  const lift = useSharedValue(0);
  const move = useSharedValue(0);
  const hover = useSharedValue(0);
  const depth = count > 1 ? index / (count - 1) : 0;

  useAnimatedReaction(
    () => isOpen.get(),
    (current, previous) => {
      if (current === previous || (!current && previous === null)) return;
      if (current) {
        lift.set(0);
        move.set(0);
        lift.set(withSpring(1, HOLD_MENU_ANIMATION.tileLiftSpring));
        move.set(
          withDelay(
            HOLD_MENU_ANIMATION.spreadDelay + index * HOLD_MENU_ANIMATION.openStagger,
            withSpring(1, HOLD_MENU_ANIMATION.tileMoveSpring),
          ),
        );
        return;
      }
      if (dockingIndex.get() >= 0) return;

      move.set(
        withDelay(
          (count - 1 - index) * HOLD_MENU_ANIMATION.closeStagger,
          withSpring(0, HOLD_MENU_ANIMATION.tileCloseSpring),
        ),
      );
      lift.set(
        withDelay(
          HOLD_MENU_ANIMATION.collapseDelay,
          withSpring(0, HOLD_MENU_ANIMATION.tileCloseSpring),
        ),
      );
    },
  );

  useAnimatedReaction(
    () => hovered.get() === index,
    (isHovered, wasHovered) => {
      if (isHovered !== wasHovered) {
        hover.set(withSpring(isHovered ? 1 : 0, HOLD_MENU_ANIMATION.hoverSpring));
      }
    },
  );

  const size = getHoldTrayMetrics(count, windowWidth, 0).size;
  const tileStyle = useAnimatedStyle(() => {
    const tray = getHoldTrayMetrics(count, windowWidth, anchorY.get());
    const spread = Math.min(Math.max(move.get(), 0), 1);
    const stackX = anchorX.get() + index * HOLD_MENU_LAYOUT.stackOffset;
    const arc = HOLD_MENU_LAYOUT.trailArc * depth * getHoldSpreadPeak(move.get());
    const centerX = stackX + (getHoldTileCenterX(index, tray) - stackX) * move.get();
    const centerY =
      anchorY.get() +
      (tray.centerY - anchorY.get()) * lift.get() -
      index * HOLD_MENU_LAYOUT.stackOffset * (1 - spread) -
      arc;
    const scale =
      (HOLD_MENU_LAYOUT.startScale +
        (HOLD_MENU_LAYOUT.stackScale - HOLD_MENU_LAYOUT.startScale) * lift.get() +
        (1 - HOLD_MENU_LAYOUT.stackScale) * move.get()) *
      (1 + (HOLD_MENU_LAYOUT.hoverScale - 1) * hover.get());
    const rotation =
      (HOLD_MENU_LAYOUT.startRotation + index * HOLD_MENU_LAYOUT.rotationStep) * (1 - spread);
    const trailFade = 1 - HOLD_MENU_LAYOUT.trailFade * depth * getHoldSpreadPeak(move.get());

    if (dockingIndex.get() === index) {
      const slot = pendingCard.get();
      const progress = dockProgress.get();
      const target = getComposerDockTarget(
        Math.max(slot, 0),
        windowWidth,
        composerBottom.get(),
        strip.get(),
      );
      const targetScale = COMPOSER.thumbSize / tray.size;

      return {
        opacity: slot < 0 ? 0 : 1,
        transform: [
          { translateX: interpolate(progress, [0, 1], [centerX, target.x]) - tray.size / 2 },
          { translateY: interpolate(progress, [0, 1], [centerY, target.y]) - tray.size / 2 },
          { rotate: `${interpolate(progress, [0, 1], [rotation, 0])}deg` },
          { scale: interpolate(progress, [0, 1], [scale, targetScale]) },
        ],
      };
    }

    if (dockingIndex.get() >= 0) {
      const settle = interpolate(
        open.get(),
        [0, 1],
        [HOLD_MENU_LAYOUT.dismissScale, 1],
        Extrapolation.CLAMP,
      );
      return {
        opacity: trailFade * interpolate(open.get(), [0.25, 1], [0, 1], Extrapolation.CLAMP),
        transform: [
          { translateX: centerX - tray.size / 2 },
          { translateY: centerY - tray.size / 2 },
          { rotate: `${rotation}deg` },
          { scale: scale * settle },
        ],
      };
    }

    const liftFade = interpolate(lift.get(), [0, 0.25], [0, 1], Extrapolation.CLAMP);
    return {
      opacity:
        trailFade *
        (isOpen.get()
          ? Math.min(liftFade, interpolate(open.get(), [0, 0.3], [0, 1], Extrapolation.CLAMP))
          : liftFade),
      transform: [
        { translateX: centerX - tray.size / 2 },
        { translateY: centerY - tray.size / 2 },
        { rotate: `${rotation}deg` },
        { scale },
      ],
    };
  });

  const blurStyle = useAnimatedStyle(() => ({
    opacity: getHoldBlurMix(depth, move.get(), lift.get(), isOpen.get()),
  }));
  const sharpStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      getHoldBlurMix(depth, move.get(), lift.get(), isOpen.get()),
      [0, 1],
      [1, 0.15],
      Extrapolation.CLAMP,
    ),
    borderRadius:
      dockingIndex.get() === index
        ? interpolate(
            dockProgress.get(),
            [0, 1],
            [HOLD_MENU_LAYOUT.tileRadius, COMPOSER.thumbRadius],
          )
        : HOLD_MENU_LAYOUT.tileRadius,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.tile, { width: size, height: size }, tileStyle]}
      testID={`hold-menu-photo-${index}`}
    >
      <Animated.View
        style={[
          styles.photo,
          { backgroundColor: palette.tileBackground, borderColor: palette.tileBorder },
          sharpStyle,
        ]}
      >
        <Image
          source={photo.id}
          recyclingKey={photo.id}
          contentFit="cover"
          cachePolicy="memory-disk"
          priority="high"
          transition={0}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, blurStyle]}>
        <GaussianBlurView
          blurRadius={HOLD_MENU_LAYOUT.tileBlurRadius}
          style={StyleSheet.absoluteFill}
        >
          <Image
            source={photo.id}
            recyclingKey={photo.id}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={0}
            style={[StyleSheet.absoluteFill, styles.blurredPhoto]}
          />
        </GaussianBlurView>
      </Animated.View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  tile: { position: 'absolute', top: 0, left: 0 },
  photo: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    borderRadius: HOLD_MENU_LAYOUT.tileRadius,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
  },
  blurredPhoto: {
    borderRadius: HOLD_MENU_LAYOUT.tileRadius,
    borderCurve: 'continuous',
  },
});
