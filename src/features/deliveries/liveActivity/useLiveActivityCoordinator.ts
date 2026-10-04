import { useSyncExternalStore } from 'react';

import { wholesaleDeliveryLiveActivityCoordinator } from './LiveActivityCoordinator';

export function useLiveActivityCoordinatorState() {
  return useSyncExternalStore(
    wholesaleDeliveryLiveActivityCoordinator.subscribe,
    wholesaleDeliveryLiveActivityCoordinator.getSnapshot,
    wholesaleDeliveryLiveActivityCoordinator.getSnapshot,
  );
}
