import * as Linking from 'expo-linking';

import type { RouteTrackingLiveActivityDriver } from './RouteTrackingLiveActivityContracts';
import { routeTrackingLiveActivity } from './RouteTrackingLiveActivityWidget';

export function createRouteTrackingLiveActivityDriver(): RouteTrackingLiveActivityDriver {
  return {
    getInstances: () => routeTrackingLiveActivity.getInstances(),
    start: (content, url) => routeTrackingLiveActivity.start(content, Linking.createURL(url)),
  };
}
