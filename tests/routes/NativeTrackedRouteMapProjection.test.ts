import {
  createTrackedRouteProjection,
  getTrackedRouteCameraPosition,
  getVisibleTrackedRouteCoordinates,
} from '@/components/routes/NativeTrackedRouteMapProjection';

const sample = (latitude: number, longitude: number, timestamp: number) => ({
  accuracy: 5,
  latitude,
  longitude,
  timestamp,
});

describe('NativeTrackedRouteMapProjection', () => {
  it('keeps separate valid paths while combining their camera coordinates', () => {
    const projection = createTrackedRouteProjection([
      {
        routeId: 'route-a',
        samples: [sample(-25.4, -49.2, 1), sample(Number.NaN, -49.1, 2)],
      },
      {
        routeId: 'route-b',
        samples: [sample(-25.5, -49.3, 3), sample(-25.6, -49.4, 4)],
      },
    ]);

    expect(projection.routes).toEqual([
      { coordinates: [{ latitude: -25.4, longitude: -49.2 }], routeId: 'route-a' },
      {
        coordinates: [
          { latitude: -25.5, longitude: -49.3 },
          { latitude: -25.6, longitude: -49.4 },
        ],
        routeId: 'route-b',
      },
    ]);
    expect(projection.allCoordinates).toHaveLength(3);
  });

  it('calculates one camera position from all route coordinates', () => {
    const camera = getTrackedRouteCameraPosition([
      { latitude: -25.4, longitude: -49.2 },
      { latitude: -25.6, longitude: -49.4 },
    ]);

    expect(camera.coordinates).toEqual({ latitude: -25.5, longitude: -49.3 });
    expect(camera.zoom).toBeGreaterThan(0);
  });

  it('uses an open preview zoom for a route with one valid point', () => {
    const camera = getTrackedRouteCameraPosition([{ latitude: -25.4, longitude: -49.2 }]);

    expect(camera).toEqual({
      coordinates: { latitude: -25.4, longitude: -49.2 },
      zoom: 11,
    });
  });

  it('reveals a route progressively without joining another route', () => {
    const coordinates = [
      { latitude: -25.4, longitude: -49.2 },
      { latitude: -25.5, longitude: -49.3 },
      { latitude: -25.6, longitude: -49.4 },
    ];

    expect(getVisibleTrackedRouteCoordinates(coordinates, 0.5)).toEqual(coordinates.slice(0, 2));
  });
});
