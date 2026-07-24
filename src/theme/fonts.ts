export const fonts = {
  family: {
    system: 'System',
    rounded: 'System',
    monospaced: 'Menlo',
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

export type Fonts = typeof fonts;
