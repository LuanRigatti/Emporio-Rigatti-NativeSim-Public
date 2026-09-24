import {
  findHoldTileIndex,
  getComposerDockTarget,
  getHoldReleaseSelection,
  getHoldTileCenterX,
  getHoldTrayMetrics,
  getRecentHoldMenuPhotos,
} from '@/features/home/components/chatgpt-attachments/composer/hold-menu';
import {
  COMPOSER,
  COMPOSER_STRIP_HEIGHT,
} from '@/features/home/components/chatgpt-attachments/constants';

jest.mock('react-native-reanimated', () => ({
  Easing: { out: (value: unknown) => value, poly: () => (value: unknown) => value, quad: {} },
  Extrapolation: { CLAMP: 'clamp' },
  interpolate: (value: number, input: number[], output: number[]) => {
    const progress = (value - input[0]) / (input[input.length - 1] - input[0]);
    return output[0] + (output[output.length - 1] - output[0]) * progress;
  },
}));

describe('Pesquisa recent-photo hold menu', () => {
  const photos = Array.from({ length: 6 }, (_, index) => ({
    id: `recent-${index}`,
    kind: 'photo' as const,
  }));

  it('uses at most four recent photos and skips ones already attached', () => {
    expect(getRecentHoldMenuPhotos(photos, [])).toEqual(photos.slice(0, 4));
    expect(getRecentHoldMenuPhotos(photos, ['recent-1'])).toEqual([
      photos[0],
      photos[2],
      photos[3],
      photos[4],
    ]);
  });

  it('keeps the selected photo available only while its docking animation is pending', () => {
    expect(getRecentHoldMenuPhotos(photos, ['recent-1'], ['recent-1'])).toContain(photos[1]);
    expect(getRecentHoldMenuPhotos(photos, ['recent-1'], [])).not.toContain(photos[1]);
  });

  it('updates hover while dragging across tray tiles and clears it outside', () => {
    const tray = getHoldTrayMetrics(4, 390, 620);
    const firstCenter = getHoldTileCenterX(0, tray);
    const thirdCenter = getHoldTileCenterX(2, tray);

    expect(findHoldTileIndex(firstCenter, tray.centerY, 4, tray)).toBe(0);
    expect(findHoldTileIndex(thirdCenter, tray.centerY, 4, tray)).toBe(2);
    expect(findHoldTileIndex(thirdCenter, tray.centerY + tray.size / 2 + 19, 4, tray)).toBe(-1);
    expect(findHoldTileIndex(-100, tray.centerY, 4, tray)).toBe(-1);
  });

  it('selects only the currently hovered photo on a successful hold release', () => {
    expect(getHoldReleaseSelection(true, 2)).toBe(2);
    expect(getHoldReleaseSelection(true, -1)).toBe(-1);
    expect(getHoldReleaseSelection(false, 2)).toBe(-1);
  });

  it('docks into the real composer thumbnail strip, accounting for its animated height', () => {
    const collapsed = getComposerDockTarget(0, 390, 700, 0);
    const expanded = getComposerDockTarget(0, 390, 700, 1);

    expect(collapsed.x).toBe(COMPOSER.stripPaddingTop + 12 + COMPOSER.thumbSize / 2);
    expect(expanded.x).toBe(collapsed.x);
    expect(collapsed.y - expanded.y).toBe(COMPOSER_STRIP_HEIGHT);
    expect(getComposerDockTarget(1, 390, 700, 1).x).toBe(
      expanded.x + COMPOSER.thumbSize + COMPOSER.thumbGap,
    );
  });
});
