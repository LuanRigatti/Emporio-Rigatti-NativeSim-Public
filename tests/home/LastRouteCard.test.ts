import {
  formatRouteDateLabel,
  formatRouteDistanceLabel,
} from '@/features/home/utils/lastRouteFormatUtils';
import type { RouteTrackingSession } from '@/types/routeTracking';

describe('LastRouteCard formatting', () => {
  it('formats dates in DD/MM format', () => {
    expect(formatRouteDateLabel('2026-08-14')).toBe('14/08');
    expect(formatRouteDateLabel('2026-08-16')).toBe('16/08');
    expect(formatRouteDateLabel('2026-08-19')).toBe('19/08');
    expect(formatRouteDateLabel('2025-12-01')).toBe('01/12');
  });

  it('formats distance with standard pt-BR formatting', () => {
    expect(formatRouteDistanceLabel(91850)).toBe('91,85 km');
    expect(formatRouteDistanceLabel(0)).toBe('0,00 km');
    expect(formatRouteDistanceLabel(12400)).toBe('12,40 km');
    expect(formatRouteDistanceLabel(500)).toBe('0,50 km');
  });

  it('preserves zero km session as valid finalized route model', () => {
    const session: RouteTrackingSession = {
      date: '2026-08-16',
      distanceMeters: 0,
      durationSeconds: 10,
      endTimestamp: 1755350410000,
      id: 'session-zero-test',
      pointsCount: 1,
      samples: [
        {
          accuracy: 5,
          latitude: -25.4296,
          longitude: -49.2719,
          timestamp: 1755350400000,
        },
      ],
      startTimestamp: 1755350400000,
      status: 'finalized',
    };

    expect(formatRouteDateLabel(session.date)).toBe('16/08');
    expect(formatRouteDistanceLabel(session.distanceMeters)).toBe('0,00 km');
  });
});
