import type { StyleProp, TextStyle } from 'react-native';

export type NativeAnimatedNumberWeight =
  'ultraLight' | 'thin' | 'light' | 'regular' | 'medium' | 'semibold' | 'bold' | 'heavy' | 'black';

export type NativeAnimatedNumberAlignment = 'leading' | 'trailing' | 'center';

export type NativeAnimatedNumberProps = {
  value: number | null;
  text: string;
  color: string;
  fontSize?: number;
  fontWeight?: NativeAnimatedNumberWeight;
  lineHeight?: number;
  alignment?: NativeAnimatedNumberAlignment;
  animationEnabled?: boolean;
  style?: StyleProp<TextStyle>;
};
