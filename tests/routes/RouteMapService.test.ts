import { getWebRouteMapState } from '@/services/routes/RouteMapService';

describe('getWebRouteMapState', () => {
  it('returns empty when there are no confirmed stops', () => {
    expect(
      getWebRouteMapState({
        hasApiKey: true,
        hasCenter: false,
        hasConfirmedStops: false,
        selectable: false,
      }),
    ).toBe('empty');
  });

  it('returns a clear missing-key state for the Web fallback', () => {
    expect(
      getWebRouteMapState({
        hasApiKey: false,
        hasCenter: true,
        hasConfirmedStops: true,
        selectable: false,
      }),
    ).toBe('missingKey');
  });

  it('allows a manual-selection map with only an initial center', () => {
    expect(
      getWebRouteMapState({
        hasApiKey: true,
        hasCenter: true,
        hasConfirmedStops: false,
        selectable: true,
      }),
    ).toBe('ready');
  });
});
