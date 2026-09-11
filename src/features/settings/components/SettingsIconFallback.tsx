import Ionicons from '@expo/vector-icons/Ionicons';

import type { SettingsIconProps } from './SettingsIcon.types';

export default function SettingsIconFallback({ color, fallbackIcon, size }: SettingsIconProps) {
  return <Ionicons color={color} name={fallbackIcon} size={size} />;
}
