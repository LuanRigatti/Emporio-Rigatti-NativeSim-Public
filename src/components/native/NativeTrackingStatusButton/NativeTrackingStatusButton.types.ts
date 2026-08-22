import type { StyleProp, ViewStyle } from 'react-native';

export type NativeTrackingStatusButtonProps = {
  active: boolean;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
  idleLabel?: string;
  activeLabel?: string;
  idleSystemImage?: string;
  activeSystemImage?: string;
  color?: string;
  glassTint?: string;
  containerHeight?: number;
  containerWidth?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};
