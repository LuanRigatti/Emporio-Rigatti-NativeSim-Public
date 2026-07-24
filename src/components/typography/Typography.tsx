import type { ComponentProps } from 'react';
import { Text } from 'react-native';

import { useAppTheme } from '@/theme';

import type { TextComponentStyle } from '../types';

export type TypographyVariant =
  | 'largeTitle'
  | 'title1'
  | 'title2'
  | 'title3'
  | 'headline'
  | 'body'
  | 'callout'
  | 'subheadline'
  | 'footnote'
  | 'caption'
  | 'metricLarge'
  | 'metricMedium'
  | 'currency';

export type AppTextProps = Omit<ComponentProps<typeof Text>, 'style'> & {
  variant?: TypographyVariant;
  style?: TextComponentStyle;
};

export function AppText({ variant = 'body', style, ...props }: AppTextProps) {
  const { theme } = useAppTheme();

  return (
    <Text
      allowFontScaling
      style={[theme.typography[variant], { color: theme.colors.textPrimary }, style]}
      {...props}
    />
  );
}
