import type * as Location from 'expo-location';

import type { RouteTrackingRecord, RouteTrackingSample } from '@/types/routeTracking';

const MAX_ACCEPTED_ACCURACY_METERS = 100;
const MAX_REASONABLE_SPEED_METERS_PER_SECOND = 100;
const DUPLICATE_DISTANCE_METERS = 0.5;
const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function calculateDistanceMeters(
  first: Pick<RouteTrackingSample, 'latitude' | 'longitude'>,
  second: Pick<RouteTrackingSample, 'latitude' | 'longitude'>,
): number {
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

function toValidSample(location: Location.LocationObject): RouteTrackingSample | null {
  const { accuracy, latitude, longitude } = location.coords;
  if (
    accuracy === null ||
    !Number.isFinite(accuracy) ||
    accuracy > MAX_ACCEPTED_ACCURACY_METERS ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    !Number.isFinite(location.timestamp) ||
    location.timestamp <= 0
  ) {
    return null;
  }

  return { accuracy, latitude, longitude, timestamp: location.timestamp };
}

export function appendValidLocationSamples(
  record: RouteTrackingRecord,
  locations: readonly Location.LocationObject[],
): RouteTrackingRecord {
  const samples = [...record.samples];
  let accumulatedDistanceMeters = record.accumulatedDistanceMeters;
  let previous = samples.at(-1);

  const orderedLocations = [...locations].sort((left, right) => left.timestamp - right.timestamp);
  for (const location of orderedLocations) {
    const sample = toValidSample(location);
    if (!sample || (previous && sample.timestamp <= previous.timestamp)) continue;

    if (previous) {
      const distanceMeters = calculateDistanceMeters(previous, sample);
      const elapsedSeconds = (sample.timestamp - previous.timestamp) / 1000;
      if (
        distanceMeters <= DUPLICATE_DISTANCE_METERS ||
        elapsedSeconds <= 0 ||
        distanceMeters / elapsedSeconds > MAX_REASONABLE_SPEED_METERS_PER_SECOND
      ) {
        continue;
      }
      accumulatedDistanceMeters += distanceMeters;
    }

    samples.push(sample);
    previous = sample;
  }

  return { ...record, accumulatedDistanceMeters, samples };
}
