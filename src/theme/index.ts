import { animations } from './animations';
import { borders } from './borders';
import { colors } from './colors';
import { fonts } from './fonts';
import { lightTheme } from './lightTheme';
import { layout } from './layout';
import { opacities } from './opacities';
import { radius } from './radius';
import { shadows } from './shadows';
import { sizes } from './sizes';
import { spacing } from './spacing';
import { typography } from './typography';

export {
  animations,
  borders,
  colors,
  fonts,
  layout,
  opacities,
  radius,
  shadows,
  sizes,
  spacing,
  typography,
};
export { darkTheme } from './darkTheme';
export { icons } from './icons';
export { lightTheme } from './lightTheme';
export { ThemeProvider } from './ThemeProvider';
export { useAppTheme } from './useAppTheme';
export type { ThemeColors } from './colors';
export type { IconName, IconTokens } from './icons';
export type { Layout } from './layout';
export type { Opacities } from './opacities';
export type { AppTheme, ResolvedThemeMode, ThemeContextValue, ThemeMode } from './types';

// Compatibility alias for non-react consumers; rendered components should use useAppTheme.
export const theme = lightTheme;

export type { Animations } from './animations';
export type { Borders } from './borders';
export type { Colors } from './colors';
export type { Fonts } from './fonts';
export type { Radius } from './radius';
export type { Shadows } from './shadows';
export type { Sizes } from './sizes';
export type { Spacing } from './spacing';
export type { Typography } from './typography';
