import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export type NativeGlassHeaderMode = 'transparent' | 'translucent' | 'floating';

export type NativeGlassHeaderProps = {
  title: string;
  subtitle?: string;
  largeTitle?: boolean;
  leftActions?: ReactNode;
  rightActions?: ReactNode;
  search?: ReactNode;
  segmentedControl?: ReactNode;
  accessory?: ReactNode;
  mode?: NativeGlassHeaderMode;
  includeTopSafeArea?: boolean;
  style?: StyleProp<ViewStyle>;
  onLayout?: (event: { nativeEvent: { layout: { height: number } } }) => void;
};

export type NativeGlassHeaderBackgroundProps = {
  mode: NativeGlassHeaderMode;
  style?: StyleProp<ViewStyle>;
};
