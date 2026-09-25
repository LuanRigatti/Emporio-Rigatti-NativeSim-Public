import type { NativeSyntheticEvent, StyleProp, ViewStyle } from 'react-native';

export type ModelIntensityStep = 'instant' | 'medium' | 'high';
export type ModelIntensityColorScheme = 'light' | 'dark';

export type ModelIntensityStepChangeEvent = NativeSyntheticEvent<{
  step: ModelIntensityStep;
}>;

export type ModelIntensityTransitionEvent = NativeSyntheticEvent<{
  expanded: boolean;
}>;

export interface NativeModelIntensitySliderProps {
  accentColor: string;
  colorScheme: ModelIntensityColorScheme;
  expanded: boolean;
  onStepChange?: (event: ModelIntensityStepChangeEvent) => void;
  onTransitionComplete?: (event: ModelIntensityTransitionEvent) => void;
  selectedStep: ModelIntensityStep;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}
