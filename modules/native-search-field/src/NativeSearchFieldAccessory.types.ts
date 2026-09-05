import type { Ref } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export type NativeSearchFieldAccessoryRef = {
  clear: () => Promise<void>;
  blur: () => Promise<void>;
  focus: () => Promise<void>;
};

export type NativeSearchFieldAccessoryProps = {
  accessibilityLabel?: string;
  autoFocus?: boolean;
  onChangeText: (value: string) => void;
  onFocusChange?: (focused: boolean) => void;
  onPressHelp?: () => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  ref?: Ref<NativeSearchFieldAccessoryRef>;
  style?: StyleProp<ViewStyle>;
  value: string;
};
