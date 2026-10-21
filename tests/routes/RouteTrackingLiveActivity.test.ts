import type {
  RouteTrackingLiveActivityContent,
  RouteTrackingLiveActivityDriver,
  RouteTrackingLiveActivityInstance,
  RouteTrackingLiveActivityOwnership,
  RouteTrackingLiveActivityOwnershipStore,
} from '@/features/location/liveActivity/RouteTrackingLiveActivityContracts';
import { RouteTrackingLiveActivityCoordinator } from '@/features/location/liveActivity/RouteTrackingLiveActivityCoordinator';
import {
  formatRouteTrackingKilometers,
  getRouteTrackingTimerInterval,
} from '@/features/location/liveActivity/RouteTrackingLiveActivityPresentation';
import { routeTrackingRepository } from '@/services/routes/RouteTrackingRepository';
import type { RouteTrackingRecord } from '@/types/routeTracking';

const mockStorage = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    clear: jest.fn(() => {
      mockStorage.clear();
      return Promise.resolve();
    }),
    getItem: jest.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      mockStorage.set(key, value);
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      mockStorage.delete(key);
      return Promise.resolve();
    }),
  },
}));

class MemoryOwnershipStore implements RouteTrackingLiveActivityOwnershipStore {
  public ownership: RouteTrackingLiveActivityOwnership | null = null;

  public async read() {
    return this.ownership;
  }

  public async write(ownership: RouteTrackingLiveActivityOwnership) {
    this.ownership = ownership;
  }

  public async clear() {
    this.ownership = null;
  }
}

class FakeActivity implements RouteTrackingLiveActivityInstance {
  public active = true;
  public readonly updates: RouteTrackingLiveActivityContent[] = [];
  public readonly endings: {
    content?: RouteTrackingLiveActivityContent;
    contentDate?: Date;
    policy?: 'default' | 'immediate';
  }[] = [];

  public constructor(private readonly id: string) {}

  public getId() {
    return this.id;
  }

  public async update(content: RouteTrackingLiveActivityContent) {
    this.updates.push(content);
  }

  public async end(
    policy?: 'default' | 'immediate',
    content?: RouteTrackingLiveActivityContent,
    contentDate?: Date,
  ) {
    this.endings.push({ content, contentDate, policy });
    this.active = false;
  }
}

class FakeDriver implements RouteTrackingLiveActivityDriver {
  public readonly activities: FakeActivity[] = [];
  public readonly starts: { content: RouteTrackingLiveActivityContent; url: string }[] = [];
  public failToStart = false;

  public getInstances() {
    return this.activities.filter((activity) => activity.active);
  }

  public start(content: RouteTrackingLiveActivityContent, url: string) {
    if (this.failToStart) throw new Error('ActivityKit unavailable');
    this.starts.push({ content, url });
    const activity = new FakeActivity(`gps-${this.activities.length + 1}`);
    this.activities.push(activity);
    return activity;
  }
}

function makeRoute(overrides: Partial<RouteTrackingRecord> = {}): RouteTrackingRecord {
  return {
    active: true,
    accumulatedDistanceMeters: 0,
    ownerUid: 'gps-user-a',
    routeId: 'gps-route-a',
    samples: [],
    startTimestamp: 1_000,
    ...overrides,
  };
}

describe('GPS Live Activity presentation', () => {
  it('formats zero, fractional and long distances without using other route totals', () => {
    expect(formatRouteTrackingKilometers(0)).toBe('0,0');
    expect(formatRouteTrackingKilometers(12_450)).toBe('12,5');
    expect(formatRouteTrackingKilometers(1_234_567_890)).toBe('1.234.567,9');
    expect(formatRouteTrackingKilometers(Number.NaN)).toBe('—');
  });

  it('uses the persisted start and stop timestamps for a native timer interval', () => {
    const active = getRouteTrackingTimerInterval(10_000);
    expect(active?.lower.getTime()).toBe(10_000);
    expect(active?.upper.getTime()).toBe(10_000 + 8 * 60 * 60 * 1000);
    expect(active?.pauseTime).toBeUndefined();

    const ended = getRouteTrackingTimerInterval(10_000, 16_000);
    expect(ended?.lower.getTime()).toBe(10_000);
    expect(ended?.upper.getTime()).toBe(16_000);
    expect(ended?.pauseTime?.getTime()).toBe(16_000);
    expect(getRouteTrackingTimerInterval(0)).toBeNull();
    expect(getRouteTrackingTimerInterval(20_000, 10_000)).toBeNull();
  });
});

describe('GPS Live Activity lifecycle and ownership', () => {
  let store: MemoryOwnershipStore;
  let driver: FakeDriver;
  let coordinator: RouteTrackingLiveActivityCoordinator;
  let session: NonNullable<ReturnType<typeof routeTrackingRepository.getSessionContext>>;

  beforeEach(() => {
    mockStorage.clear();
    routeTrackingRepository.setSessionUser('gps-user-a', 4);
    session = routeTrackingRepository.getSessionContext()!;
    store = new MemoryOwnershipStore();
    driver = new FakeDriver();
    coordinator = new RouteTrackingLiveActivityCoordinator({
      isIOS: true,
      loadDriver: async () => driver,
      ownershipStore: store,
    });
  });

  it('starts once for a confirmed route and associates its UID and route ID', async () => {
    const route = makeRoute();
    await coordinator.startForRoute(route, session);
    await coordinator.startForRoute(route, session);

    expect(driver.starts).toHaveLength(1);
    expect(driver.starts[0]).toMatchObject({
      content: { distanceMeters: 0, routeId: 'gps-route-a', startTimestamp: 1_000 },
      url: '/configuracoes/localizacao',
    });
    expect(store.ownership).toMatchObject({
      activityId: 'gps-1',
      lastPublishedDistanceMeters: 0,
      routeId: 'gps-route-a',
      uid: 'gps-user-a',
    });
  });

  it('updates only after a persisted distance change and coalesces duplicate batches', async () => {
    const route = makeRoute();
    await coordinator.startForRoute(route, session);
    const updatedRoute = makeRoute({ accumulatedDistanceMeters: 1_247.3 });

    await coordinator.updateFromBackground(updatedRoute, session);
    await coordinator.updateFromBackground(updatedRoute, session);

    expect(driver.activities[0].updates).toEqual([
      expect.objectContaining({ distanceMeters: 1_247.3, routeId: 'gps-route-a' }),
    ]);
    expect(store.ownership?.lastPublishedDistanceMeters).toBe(1_247.3);
  });

  it('coalesces batches that do not change the displayed tenth of a kilometer', async () => {
    await coordinator.startForRoute(makeRoute(), session);

    await coordinator.updateFromBackground(makeRoute({ accumulatedDistanceMeters: 30 }), session);
    await coordinator.updateFromBackground(makeRoute({ accumulatedDistanceMeters: 80 }), session);

    expect(driver.activities[0].updates).toEqual([
      expect.objectContaining({ distanceMeters: 80, routeId: 'gps-route-a' }),
    ]);
  });

  it('ignores a late background callback from a different UID or route', async () => {
    await coordinator.startForRoute(makeRoute(), session);

    await coordinator.updateFromBackground(
      makeRoute({ accumulatedDistanceMeters: 900, ownerUid: 'gps-user-b' }),
      session,
    );
    await coordinator.updateFromBackground(
      makeRoute({ accumulatedDistanceMeters: 900, routeId: 'gps-route-old' }),
      session,
    );

    expect(driver.activities[0].updates).toHaveLength(0);
  });

  it('reconciles a recovered activity without duplicating it', async () => {
    const route = await routeTrackingRepository.createActiveRoute('gps-route-a');

    await coordinator.setSession('gps-user-a', 4);
    await coordinator.setSession('gps-user-a', 4);

    expect(driver.starts).toHaveLength(1);
    expect(store.ownership?.routeId).toBe(route.routeId);
  });

  it('does not recreate a Live Activity dismissed by the person or system', async () => {
    await routeTrackingRepository.createActiveRoute('gps-route-a');
    await coordinator.setSession('gps-user-a', 4);
    await driver.activities[0].end('immediate');

    await coordinator.setSession('gps-user-a', 4);

    expect(driver.starts).toHaveLength(1);
    expect(store.ownership?.activityId).toBe('gps-1');
  });

  it('publishes the final route snapshot and ends only its GPS activity immediately', async () => {
    const route = makeRoute();
    await coordinator.startForRoute(route, session);
    const finishedRoute = makeRoute({
      active: false,
      accumulatedDistanceMeters: 2_500,
      endTimestamp: 8_000,
    });

    await coordinator.endForRoute(finishedRoute, session);

    expect(driver.activities[0].endings).toEqual([
      {
        content: expect.objectContaining({ distanceMeters: 2_500, endTimestamp: 8_000 }),
        contentDate: new Date(8_000),
        policy: 'immediate',
      },
    ]);
    expect(store.ownership).toBeNull();
  });

  it('keeps GPS data usable when ActivityKit refuses to start', async () => {
    const route = await routeTrackingRepository.createActiveRoute('gps-route-a');
    driver.failToStart = true;
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(coordinator.startForRoute(route, session)).resolves.toBeUndefined();
    await expect(routeTrackingRepository.getActiveRoute(session)).resolves.toMatchObject({
      active: true,
      routeId: 'gps-route-a',
    });
    expect(store.ownership).toBeNull();
    warn.mockRestore();
  });

  it('keeps a confirmed GPS route active when Live Activities are unavailable', async () => {
    const route = await routeTrackingRepository.createActiveRoute('gps-route-a');
    coordinator = new RouteTrackingLiveActivityCoordinator({
      isIOS: true,
      loadDriver: async () => null,
      ownershipStore: store,
    });

    await expect(coordinator.startForRoute(route, session)).resolves.toBeUndefined();

    await expect(routeTrackingRepository.getActiveRoute(session)).resolves.toMatchObject({
      active: true,
      routeId: 'gps-route-a',
    });
    expect(store.ownership).toBeNull();
  });

  it('starts a new activity with the new route timestamp and distance', async () => {
    await coordinator.startForRoute(makeRoute(), session);
    await coordinator.endForRoute(
      makeRoute({ active: false, accumulatedDistanceMeters: 3_000, endTimestamp: 9_000 }),
      session,
    );

    await coordinator.startForRoute(
      makeRoute({
        accumulatedDistanceMeters: 0,
        routeId: 'gps-route-b',
        startTimestamp: 20_000,
      }),
      session,
    );

    expect(driver.starts).toHaveLength(2);
    expect(driver.starts[1]?.content).toEqual({
      distanceMeters: 0,
      routeId: 'gps-route-b',
      startTimestamp: 20_000,
    });
    expect(store.ownership).toMatchObject({
      lastPublishedDistanceMeters: 0,
      routeId: 'gps-route-b',
      startTimestamp: 20_000,
    });
  });

  it('ends only GPS-typed activities on logout and clears their ownership', async () => {
    await coordinator.startForRoute(makeRoute(), session);

    await coordinator.setSession(null, 5);

    expect(driver.activities[0].endings[0]?.policy).toBe('immediate');
    expect(store.ownership).toBeNull();
  });
});
