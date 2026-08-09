import type { StyleProp, ViewStyle } from 'react-native';

import type { RouteTrackingSample } from '@/types/routeTracking';

export type NativeTrackedRouteMapProps = {
  animate?: boolean;
  interactive?: boolean;
  routeId: string;
  samples: readonly RouteTrackingSample[];
  style?: StyleProp<ViewStyle>;
};
