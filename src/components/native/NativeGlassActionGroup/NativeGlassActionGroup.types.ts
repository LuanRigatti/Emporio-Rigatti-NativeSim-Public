import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';

export type NativeGlassAction = {
  systemImage: string;
  fallbackIcon: ComponentProps<typeof Ionicons>['name'];
  accessibilityLabel: string;
  onPress: () => void;
};

export type NativeGlassActionGroupProps = {
  leadingSystemImage: string;
  trailingSystemImage: string;
  leadingFallbackIcon: ComponentProps<typeof Ionicons>['name'];
  trailingFallbackIcon: ComponentProps<typeof Ionicons>['name'];
  leadingAccessibilityLabel: string;
  trailingAccessibilityLabel: string;
  onLeadingPress: () => void;
  onTrailingPress: () => void;
  color?: string;
  size?: number;
  disabled?: boolean;
  selectionMode?: boolean;
  selectionAction?: NativeGlassAction;
};
