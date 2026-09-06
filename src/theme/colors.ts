export type ThemeColors = {
  background: string;
  backgroundSecondary: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  contrastSurface: string;
  contrastContent: string;
  selectionSurface: string;
  selectionContent: string;
  textDisabled: string;
  separator: string;
  borderStrong: string;
  focus: string;
  primary: string;
  primaryPressed: string;
  secondary: string;
  brand: string;
  brandStrong: string;
  success: string;
  successSurface: string;
  warning: string;
  warningSurface: string;
  danger: string;
  dangerSurface: string;
  info: string;
  infoSurface: string;
  glassSurface: string;
  glassBorder: string;
  paid: string;
  unpaid: string;
  delivered: string;
  pending: string;
  revenue: string;
  profit: string;
  expense: string;
  overlay: string;
};

export const previousLightColors: ThemeColors = {
  background: '#FAFAFF',
  backgroundSecondary: '#EEF2F7',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#EEF2F7',
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textTertiary: '#6B7280',
  textInverse: '#FFFFFF',
  contrastSurface: '#000000',
  contrastContent: '#FFFFFF',
  selectionSurface: '#000000',
  selectionContent: '#FFFFFF',
  textDisabled: '#9CA3AF',
  separator: '#E5E7EB',
  borderStrong: '#D1D5DB',
  focus: '#006EDB',
  primary: '#006EDB',
  primaryPressed: '#005BBB',
  secondary: '#5E5CE6',
  brand: '#CFEDE3',
  brandStrong: '#76BFAE',
  success: '#117A52',
  successSurface: '#EAF8EE',
  warning: '#8A4B08',
  warningSurface: '#FFF5E5',
  danger: '#B42318',
  dangerSurface: '#FFEBEA',
  info: '#006EDB',
  infoSurface: '#EAF4FF',
  glassSurface: 'rgba(255, 255, 255, 0.78)',
  glassBorder: 'rgba(17, 24, 39, 0.10)',
  paid: '#117A52',
  unpaid: '#8A4B08',
  delivered: '#117A52',
  pending: '#8A4B08',
  revenue: '#117A52',
  profit: '#0B6B61',
  expense: '#B42318',
  overlay: 'rgba(17, 24, 39, 0.42)',
};

export const lightModeTestPalette = {
  background: '#FAF8F7',
  surface: '#FEFFFF',
} as const;

export const GLASS_LIGHT_TINT_OPACITY = 0.6 as const;
export const lightModeLiquidGlassTint = `rgba(255, 255, 255, ${GLASS_LIGHT_TINT_OPACITY})` as const;
export const SEARCH_BAR_LIGHT_TINT_OPACITY = 0.1 as const;
export const searchBarLightModeLiquidGlassTint =
  `rgba(255, 255, 255, ${SEARCH_BAR_LIGHT_TINT_OPACITY})` as const;

export const lightColors: ThemeColors = {
  ...previousLightColors,
  background: lightModeTestPalette.background,
  surface: lightModeTestPalette.surface,
  surfaceElevated: lightModeTestPalette.surface,
  surfaceMuted: lightModeTestPalette.surface,
};

export const darkColors: ThemeColors = {
  background: '#000000',
  backgroundSecondary: '#0F0F0F',
  surface: '#131417',
  surfaceElevated: '#131417',
  surfaceMuted: '#1F1F1F',
  textPrimary: '#F5F7FA',
  textSecondary: '#B8C0CC',
  textTertiary: '#8E98A8',
  textInverse: '#111827',
  contrastSurface: '#FFFFFF',
  contrastContent: '#000000',
  selectionSurface: '#000000',
  selectionContent: '#FFFFFF',
  textDisabled: '#667085',
  separator: '#303030',
  borderStrong: '#404040',
  focus: '#64B5FF',
  primary: '#64B5FF',
  primaryPressed: '#8AC7FF',
  secondary: '#A99CFF',
  brand: '#CFEDE3',
  brandStrong: '#9DDBC9',
  success: '#30D158',
  successSurface: '#173B29',
  warning: '#FFB340',
  warningSurface: '#47351A',
  danger: '#FF6961',
  dangerSurface: '#4A211F',
  info: '#64B5FF',
  infoSurface: '#17334A',
  glassSurface: 'rgba(31, 31, 31, 0.82)',
  glassBorder: 'rgba(245, 247, 250, 0.16)',
  paid: '#63D39B',
  unpaid: '#FFB340',
  delivered: '#63D39B',
  pending: '#FFB340',
  revenue: '#63D39B',
  profit: '#5EEAD4',
  expense: '#FF817A',
  overlay: 'rgba(0, 0, 0, 0.58)',
};

export const GLASS_DARK_TINT_OPACITY = 0.85 as const;

export const darkModeCardSurface = '#0A0C0E' as const;
export const registrarSheetDetailLightSurface = '#FFFFFF' as const;
export const registrarSheetDetailDarkSurface = 'rgba(80, 80, 84, 0.40)' as const;

export function getCardSurfaceColor(mode: 'light' | 'dark', lightSurface: string): string {
  return mode === 'dark' ? darkModeCardSurface : lightSurface;
}

function colorWithOpacity(hexColor: string, opacity: number): string {
  const normalized = hexColor.replace('#', '');
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

export const darkModeLiquidGlassTint = colorWithOpacity(
  darkColors.surface,
  GLASS_DARK_TINT_OPACITY,
);
export const registrarDeliveryDarkLiquidGlassTint = colorWithOpacity(
  darkColors.background,
  0.30,
);

export function getLiquidGlassTint(mode: 'light' | 'dark'): string {
  return mode === 'dark' ? darkModeLiquidGlassTint : lightModeLiquidGlassTint;
}

export function getSearchBarLiquidGlassTint(mode: 'light' | 'dark'): string | undefined {
  return mode === 'dark' ? darkModeLiquidGlassTint : searchBarLightModeLiquidGlassTint;
}
