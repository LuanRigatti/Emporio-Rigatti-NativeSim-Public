import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

export type NativeThinkingOrbState = 'searching';
export type NativeThinkingOrbColorScheme = 'light' | 'dark';

export type NativeThinkingOrbProps = {
  colorScheme: NativeThinkingOrbColorScheme;
  fallbackColor?: ColorValue;
  size?: number;
  state?: NativeThinkingOrbState;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export type NativeThinkingOrbViewProps = Omit<NativeThinkingOrbProps, 'fallbackColor'>;
