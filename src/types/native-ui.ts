import type { ReactElement, ReactNode } from 'react';
import type { KeyboardTypeOptions, StyleProp, TextStyle, ViewStyle } from 'react-native';

export type NativeMenuAction = {
  id: string;
  title: string;
  systemImage?: string;
  destructive?: boolean;
  disabled?: boolean;
  isOn?: boolean;
  onPress: () => void;
};

export type NativeMenuProps = {
  children: ReactElement;
  actions: readonly NativeMenuAction[];
  title?: string;
  href?: string;
  accessibilityLabel?: string;
};

export type NativeSheetProps = {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  children: ReactNode;
  title?: string;
  accessibilityLabel?: string;
};

export type NativeDialogAction = {
  id: string;
  title: string;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

export type NativeDialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  actions: readonly NativeDialogAction[];
  onDismiss: () => void;
};

export type NativePickerProps = {
  options: readonly string[];
  selectedIndex: number | null;
  onSelectedIndexChange: (index: number) => void;
  label?: string;
  accessibilityLabel?: string;
};

export type NativeSegmentedControlProps = {
  options: readonly string[];
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
  accessibilityLabel?: string;
};

export type NativeListItem = {
  id: string;
  title: string;
  subtitle?: string;
  systemImage?: string;
  disabled?: boolean;
};

export type NativeListProps = {
  items: readonly NativeListItem[];
  onItemPress?: (item: NativeListItem) => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export type NativeDatePickerMode = 'date' | 'time';

export type NativeDatePickerProps = {
  value: Date;
  mode: NativeDatePickerMode;
  onChange: (value: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  accessibilityLabel?: string;
};

export type NativeButtonProps = {
  label: string;
  onPress: () => void;
  systemImage?: string;
  fallbackIcon?: string;
  disabled?: boolean;
  destructive?: boolean;
  accessibilityLabel?: string;
};

export type NativeToggleProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
};

export type NativeTextFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  label?: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  multiline?: boolean;
  style?: StyleProp<TextStyle>;
};

export type NativeRuntimeEnvironment = 'expo-go' | 'development-build' | 'web';

export type NativeCapabilities = {
  environment: NativeRuntimeEnvironment;
  canUseExpoUI: boolean;
  canUseNativeMenu: boolean;
  canUseNativeSheet: boolean;
  canUseNativePicker: boolean;
  canUseNativeTabs: boolean;
  canUseLiquidGlass: boolean;
};
