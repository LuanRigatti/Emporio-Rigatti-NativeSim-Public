import Ionicons from '@expo/vector-icons/Ionicons';

import type { HistorySymbolIconProps } from './HistorySymbolIcon.types';

export default function HistorySymbolIconFallback({
  color,
  fallbackIcon,
  size,
}: HistorySymbolIconProps) {
  return <Ionicons color={color} name={fallbackIcon} size={size} />;
}
