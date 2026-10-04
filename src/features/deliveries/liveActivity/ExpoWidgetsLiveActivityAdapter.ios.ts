import * as Linking from 'expo-linking';

import type { LiveActivityDriver } from './LiveActivityContracts';
import { wholesaleDeliveryLiveActivity } from './WholesaleDeliveryLiveActivityWidget';

export function createWholesaleDeliveryLiveActivityDriver(): LiveActivityDriver {
  return {
    getInstances: () => wholesaleDeliveryLiveActivity.getInstances(),
    start: (content, url, staleDate) =>
      wholesaleDeliveryLiveActivity.start(content, Linking.createURL(url), staleDate),
  };
}
