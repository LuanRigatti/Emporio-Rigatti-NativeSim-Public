import type { StyleProp, ViewStyle } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

export type NativeGlassMorphActionGroupProps = {
  color?: string;
  isExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  onSecondaryPress?: () => void;
  primaryCollapsedSymbol?: SFSymbol;
  primaryExpandedSymbol?: SFSymbol;
  secondarySymbol?: SFSymbol;
  size?: number;
  spacing?: number;
  style?: StyleProp<ViewStyle>;
};
