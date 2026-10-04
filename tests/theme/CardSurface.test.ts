import {
  darkModeCardSurface,
  darkModeInsetSurface,
  getCardSurfaceColor,
  getInsetSurfaceColor,
} from '@/theme/colors';

describe('card surface theme contract', () => {
  it('uses the canonical dark card surface without changing the light surface', () => {
    expect(darkModeCardSurface).toBe('#0C0C0E');
    expect(getCardSurfaceColor('dark', '#FEFFFF')).toBe('#0C0C0E');
    expect(getCardSurfaceColor('light', '#FEFFFF')).toBe('#FEFFFF');
    expect(darkModeInsetSurface).toBe('#19191A');
    expect(getInsetSurfaceColor('dark', '#FEFFFF')).toBe('#19191A');
    expect(getInsetSurfaceColor('light', '#FEFFFF')).toBe('#FEFFFF');
  });
});
