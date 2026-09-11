import type { ComponentProps } from 'react';

import Ionicons from '@expo/vector-icons/Ionicons';

export type SettingsIconProps = {
  systemName: string;
  fallbackIcon: ComponentProps<typeof Ionicons>['name'];
  color: string;
  size: number;
};
