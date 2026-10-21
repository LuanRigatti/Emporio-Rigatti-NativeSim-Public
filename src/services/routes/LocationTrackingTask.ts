import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { routeTrackingRepository } from './RouteTrackingRepository';
import { routeTrackingLiveActivityCoordinator } from '@/features/location/liveActivity/RouteTrackingLiveActivityCoordinator';

export const ROUTE_LOCATION_TASK_NAME = 'pareact-route-location-updates';

type RouteLocationTaskData = {
  locations: Location.LocationObject[];
};

export async function handleRouteLocationTask({
  data,
  error,
}: {
  data?: RouteLocationTaskData;
  error?: unknown;
}): Promise<void> {
  if (error || !data?.locations?.length) return;

  const updatedRoute = await routeTrackingRepository.appendLocationSamplesForBackground(
    data.locations,
  );
  if (!updatedRoute) return;

  await routeTrackingLiveActivityCoordinator.updateFromBackground(
    updatedRoute,
    routeTrackingRepository.getSessionContext(),
  );
}

if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(ROUTE_LOCATION_TASK_NAME)) {
  TaskManager.defineTask<RouteLocationTaskData>(ROUTE_LOCATION_TASK_NAME, handleRouteLocationTask);
}
