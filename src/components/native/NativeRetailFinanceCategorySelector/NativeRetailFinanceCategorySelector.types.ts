import type { StyleProp, ViewStyle } from 'react-native';

export type NativeRetailFinanceCategorySelectorItem = {
  key: string;
  label: string;
};

export type NativeRetailFinanceCategorySelectorProps = {
  accessibilityLabel?: string;
  items: readonly NativeRetailFinanceCategorySelectorItem[];
  onChange: (key: string) => void;
  selectedKey: string;
  style?: StyleProp<ViewStyle>;
};
