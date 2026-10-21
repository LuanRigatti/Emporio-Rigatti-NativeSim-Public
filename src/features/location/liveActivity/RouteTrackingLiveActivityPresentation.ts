const MAX_ACTIVE_ACTIVITY_DURATION_MS = 8 * 60 * 60 * 1000;

export type RouteTrackingTimerInterval = {
  lower: Date;
  pauseTime?: Date;
  upper: Date;
};

export function formatRouteTrackingKilometers(distanceMeters: number): string {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) return '—';

  const tenthsOfKilometer = Math.round(distanceMeters / 100);
  const integerPart = Math.floor(tenthsOfKilometer / 10).toString();
  const decimalPart = tenthsOfKilometer % 10;
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${groupedInteger},${decimalPart}`;
}

export function getRouteTrackingTimerInterval(
  startTimestamp: number,
  endTimestamp?: number,
): RouteTrackingTimerInterval | null {
  if (!Number.isFinite(startTimestamp) || startTimestamp <= 0) return null;
  if (
    endTimestamp !== undefined &&
    (!Number.isFinite(endTimestamp) || endTimestamp < startTimestamp)
  ) {
    return null;
  }

  const lower = new Date(startTimestamp);
  if (endTimestamp !== undefined) {
    const upper = new Date(endTimestamp);
    return { lower, pauseTime: upper, upper };
  }

  return {
    lower,
    upper: new Date(startTimestamp + MAX_ACTIVE_ACTIVITY_DURATION_MS),
  };
}
