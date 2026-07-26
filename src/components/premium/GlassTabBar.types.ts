import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

export type GlassTabBarIconName = ComponentProps<typeof Ionicons>['name'];

export type GlassTabBarItem = {
  key: string;
  label: string;
  icon: GlassTabBarIconName;
  selected: boolean;
  onPress: () => void;
};

export type GlassTabBarProps = {
  items: readonly GlassTabBarItem[];
  accessibilityLabel?: string;
  reduceMotionOverride?: boolean;
};
