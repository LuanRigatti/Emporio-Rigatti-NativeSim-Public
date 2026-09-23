import { darkModeCardSurface, getCardSurfaceColor } from '@/theme/colors';

describe('card surface theme contract', () => {
  it('uses the canonical dark card surface without changing the light surface', () => {
    expect(darkModeCardSurface).toBe('#19191A');
    expect(getCardSurfaceColor('dark', '#FEFFFF')).toBe('#19191A');
    expect(getCardSurfaceColor('light', '#FEFFFF')).toBe('#FEFFFF');
  });
});
