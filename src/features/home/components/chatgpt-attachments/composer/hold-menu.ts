import { Extrapolation, interpolate } from 'react-native-reanimated';
import { COMPOSER, COMPOSER_STRIP_HEIGHT, GUTTER } from '../constants';
import { HOLD_MENU_LAYOUT } from './hold-menu.constants';
import type { LibraryPhoto } from '../photos/use-photo-library';

export interface HoldTrayMetrics {
  size: number;
  startX: number;
  centerY: number;
}

export function getRecentHoldMenuPhotos(
  recentPhotos: readonly LibraryPhoto[],
  attachedIds: readonly string[],
  dockingPhotoIds: readonly string[] = [],
) {
  const attached = new Set(attachedIds);
  const docking = new Set(dockingPhotoIds);
  return recentPhotos
    .filter((photo) => !attached.has(photo.id) || docking.has(photo.id))
    .slice(0, HOLD_MENU_LAYOUT.maxTiles);
}

export function getHoldTrayMetrics(
  count: number,
  windowWidth: number,
  anchorY: number,
): HoldTrayMetrics {
  'worklet';
  const gaps = HOLD_MENU_LAYOUT.tileGap * (count - 1);
  const available = windowWidth - HOLD_MENU_LAYOUT.trayInset * 2 - gaps;
  const size = Math.min(available / count, HOLD_MENU_LAYOUT.maxTileSize);
  const rowWidth = size * count + gaps;

  return {
    size,
    startX: (windowWidth - rowWidth) / 2,
    centerY: anchorY - COMPOSER.rowHeight / 2 - HOLD_MENU_LAYOUT.trayOffset - size / 2,
  };
}

export function getHoldTileCenterX(index: number, tray: HoldTrayMetrics) {
  'worklet';
  return tray.startX + tray.size / 2 + index * (tray.size + HOLD_MENU_LAYOUT.tileGap);
}

export function findHoldTileIndex(x: number, y: number, count: number, tray: HoldTrayMetrics) {
  'worklet';
  if (Math.abs(y - tray.centerY) > tray.size / 2 + HOLD_MENU_LAYOUT.hoverSlopY) return -1;

  const halfSpan = (tray.size + HOLD_MENU_LAYOUT.tileGap) / 2;
  for (let index = 0; index < count; index += 1) {
    if (Math.abs(x - getHoldTileCenterX(index, tray)) <= halfSpan) return index;
  }
  return -1;
}

export function getHoldSpreadPeak(move: number) {
  'worklet';
  const spread = Math.min(Math.max(move, 0), 1);
  return 4 * spread * (1 - spread);
}

export function getHoldBlurMix(depth: number, move: number, lift: number, isOpen: boolean) {
  'worklet';
  const motion = depth * HOLD_MENU_LAYOUT.trailBlur * getHoldSpreadPeak(move);
  const closing = isOpen ? 0 : interpolate(lift, [0.1, 0.7], [1, 0], Extrapolation.CLAMP);
  return Math.max(motion, closing);
}

/** Dock coordinates adapted to the existing scrolling thumbnail strip in the Emporio composer. */
export function getComposerDockTarget(
  slot: number,
  screenWidth: number,
  composerBottom: number,
  stripProgress: number,
) {
  'worklet';
  const composerTop = composerBottom - COMPOSER.rowHeight - stripProgress * COMPOSER_STRIP_HEIGHT;
  const step = COMPOSER.thumbSize + COMPOSER.thumbGap;
  const lastVisible = screenWidth - GUTTER - COMPOSER.stripPaddingTop - COMPOSER.thumbSize;
  const left = Math.min(GUTTER + COMPOSER.stripPaddingTop + slot * step, lastVisible);

  return {
    x: left + COMPOSER.thumbSize / 2,
    y: composerTop + COMPOSER.stripPaddingTop + COMPOSER.thumbSize / 2,
  };
}

export function getHoldReleaseSelection(isOpen: boolean, hoveredIndex: number) {
  'worklet';
  return isOpen && hoveredIndex >= 0 ? hoveredIndex : -1;
}
