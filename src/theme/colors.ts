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
  paid: string;
  unpaid: string;
  delivered: string;
  pending: string;
  revenue: string;
  profit: string;
  expense: string;
  overlay: string;
};

export const lightColors: ThemeColors = {
  background: '#F7F8FA',
  backgroundSecondary: '#EEF2F7',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#EEF2F7',
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textTertiary: '#6B7280',
  textInverse: '#FFFFFF',
  textDisabled: '#9CA3AF',
  separator: '#E5E7EB',
  borderStrong: '#D1D5DB',
  focus: '#0A84FF',
  primary: '#0A84FF',
  primaryPressed: '#006EDB',
  secondary: '#5E5CE6',
  brand: '#CFEDE3',
  brandStrong: '#76BFAE',
  success: '#34C759',
  successSurface: '#EAF8EE',
  warning: '#FF9F0A',
  warningSurface: '#FFF5E5',
  danger: '#FF3B30',
  dangerSurface: '#FFEBEA',
  info: '#0A84FF',
  infoSurface: '#EAF4FF',
  paid: '#168A5B',
  unpaid: '#B45309',
  delivered: '#168A5B',
  pending: '#B45309',
  revenue: '#168A5B',
  profit: '#0F766E',
  expense: '#C53B36',
  overlay: 'rgba(17, 24, 39, 0.42)',
};

export const darkColors: ThemeColors = {
  background: '#0B0F14',
  backgroundSecondary: '#11161D',
  surface: '#161B22',
  surfaceElevated: '#20262F',
  surfaceMuted: '#11161D',
  textPrimary: '#F5F7FA',
  textSecondary: '#B8C0CC',
  textTertiary: '#8E98A8',
  textInverse: '#111827',
  textDisabled: '#667085',
  separator: '#2A313B',
  borderStrong: '#3A4350',
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
  paid: '#63D39B',
  unpaid: '#FFB340',
  delivered: '#63D39B',
  pending: '#FFB340',
  revenue: '#63D39B',
  profit: '#5EEAD4',
  expense: '#FF817A',
  overlay: 'rgba(0, 0, 0, 0.58)',
};

/**
 * Legacy light tokens kept temporarily for existing components that have not
 * yet migrated to useAppTheme. New components must consume ThemeColors.
 */
export const colors = {
  brand: {
    primary: lightColors.primary,
    primaryPressed: lightColors.primaryPressed,
    secondary: lightColors.secondary,
  },
  text: {
    primary: lightColors.textPrimary,
    secondary: lightColors.textSecondary,
    tertiary: lightColors.textTertiary,
    inverse: lightColors.textInverse,
    disabled: lightColors.textDisabled,
  },
  background: {
    canvas: lightColors.background,
    surface: lightColors.surface,
    elevated: lightColors.surfaceElevated,
    muted: lightColors.surfaceMuted,
    inverse: lightColors.textPrimary,
  },
  border: {
    subtle: lightColors.separator,
    strong: lightColors.borderStrong,
    focus: lightColors.focus,
  },
  feedback: {
    positive: lightColors.success,
    positiveSurface: lightColors.successSurface,
    warning: lightColors.warning,
    warningSurface: lightColors.warningSurface,
    negative: lightColors.danger,
    negativeSurface: lightColors.dangerSurface,
    info: lightColors.info,
    infoSurface: lightColors.infoSurface,
  },
  overlay: lightColors.overlay,
} as const;

export type Colors = typeof colors;
