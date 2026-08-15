import type { StyleProp, ViewStyle } from 'react-native';

import type { RouteTrackingSample } from '@/types/routeTracking';

export type NativeTrackedRouteMapProps = {
  animate?: boolean;
  interactive?: boolean;
  routeId: string;
  samples: readonly RouteTrackingSample[];
  style?: StyleProp<ViewStyle>;
};

export type NativeTrackedRoute = {
  routeId: string;
  samples: readonly RouteTrackingSample[];
};

export type NativeTrackedRoutesMapProps = {
  animate?: boolean;
  interactive?: boolean;
  routes: readonly NativeTrackedRoute[];
  style?: StyleProp<ViewStyle>;
};
