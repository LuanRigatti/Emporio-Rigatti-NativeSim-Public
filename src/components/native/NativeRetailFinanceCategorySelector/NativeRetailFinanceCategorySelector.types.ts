import type { StyleProp, ViewStyle } from 'react-native';

export type NativeRetailFinanceCategorySelectorItem = {
  key: string;
  label: string;
};

export type NativeRetailFinanceCategorySelectorProps = {
  accessibilityLabel?: string;
  contentLeadingPadding?: number;
  contentTrailingPadding?: number;
  fillAvailableWidth?: boolean;
  items: readonly NativeRetailFinanceCategorySelectorItem[];
  itemHorizontalPadding?: number;
  itemSpacing?: number;
  onChange: (key: string) => void;
  scrollable?: boolean;
  selectionAnimationMode?: 'native' | 'slidingBubble';
  selectedKey: string;
  style?: StyleProp<ViewStyle>;
};
