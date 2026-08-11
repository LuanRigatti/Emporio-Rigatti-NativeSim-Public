import type { StyleProp, TextStyle } from 'react-native';

export type NativeAnimatedNumberWeight =
  | 'ultraLight'
  | 'thin'
  | 'light'
  | 'regular'
  | 'medium'
  | 'semibold'
  | 'bold'
  | 'heavy'
  | 'black';

export type NativeAnimatedNumberProps = {
  value: number | null;
  text: string;
  color: string;
  fontSize?: number;
  fontWeight?: NativeAnimatedNumberWeight;
  lineHeight?: number;
  animationEnabled?: boolean;
  style?: StyleProp<TextStyle>;
};
