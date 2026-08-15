import { selectHomeSearchRouteSessions } from '@/features/home/components/HomeSearchRoutePreviewAdapter';
import type { RouteTrackingSession } from '@/types/routeTracking';

const session = (id: string): RouteTrackingSession => ({
  date: '2026-08-14',
  distanceMeters: 100,
  durationSeconds: 60,
  endTimestamp: 2,
  id,
  pointsCount: 2,
  samples: [],
  startTimestamp: 1,
  status: 'finalized',
});

describe('HomeSearchRoutePreviewAdapter', () => {
  it('selects existing sessions in requested order and removes duplicate ids', () => {
    const history = [session('second'), session('first')];

    expect(selectHomeSearchRouteSessions(history, ['first', 'missing', 'first', 'second'])).toEqual(
      [history[1], history[0]],
    );
  });
});
