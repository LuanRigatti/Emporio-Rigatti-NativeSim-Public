import {
  FirestoreRouteFinancialLedgerDataSource,
  ROUTE_FINANCIAL_LEDGER_COLLECTION,
  getRouteFinancialLedgerCacheKey,
} from '@/services/routes/FirestoreRouteFinancialLedgerDataSource';
import { summarizeRouteKilometersByDate } from '@/services/routes/routeTrackingDistance';
import type { RouteTrackingSessionContext } from '@/services/routes/RouteTrackingRepository';
import type { RouteTrackingSession } from '@/types/routeTracking';

const mockDocuments = new Map<string, Record<string, unknown>>();
const mockCache = new Map<string, string>();
const mockFirestore = { id: 'mock-firestore' };
const mockGetDocsFromServer = jest.fn(async (collectionReference: { path: string }) => ({
  docs: [...mockDocuments.entries()]
    .filter(([path]) => path.startsWith(`${collectionReference.path}/`))
    .map(([path, data]) => ({
      data: () => data,
      id: path.slice(collectionReference.path.length + 1),
    })),
}));
const mockRunTransaction = jest.fn(
  async (_firestore: unknown, callback: (tx: unknown) => unknown) => {
    const writes: [string, Record<string, unknown>][] = [];
    const transaction = {
      get: async (reference: { path: string }) => {
        const data = mockDocuments.get(reference.path);
        return {
          data: () => data,
          exists: () => data !== undefined,
        };
      },
      set: (reference: { path: string }, data: Record<string, unknown>) => {
        writes.push([reference.path, data]);
      },
    };
    const result = await callback(transaction);
    writes.forEach(([path, data]) => mockDocuments.set(path, data));
    return result;
  },
);

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockCache.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockCache.set(key, value);
    }),
  },
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_firestore: unknown, ...segments: string[]) => ({
    path: segments.join('/'),
  })),
  doc: jest.fn((_firestore: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  getDocsFromServer: (...args: Parameters<typeof mockGetDocsFromServer>) =>
    mockGetDocsFromServer(...args),
  runTransaction: (...args: Parameters<typeof mockRunTransaction>) => mockRunTransaction(...args),
  serverTimestamp: jest.fn(() => 'server-timestamp'),
}));

jest.mock('@/services/firebase/firestore', () => ({
  getFirebaseFirestore: jest.fn(() => mockFirestore),
}));

function context(uid = 'user-a', sessionVersion = 3): RouteTrackingSessionContext {
  return { sessionKey: `${uid}\u0000${sessionVersion}`, sessionVersion, uid };
}

function localRoute(
  id: string,
  distanceMeters = 12_400,
  date = '2026-08-06',
): RouteTrackingSession {
  return {
    date,
    distanceMeters,
    durationSeconds: 600,
    endTimestamp: 2_000,
    id,
    ownerUid: 'user-a',
    pointsCount: 3,
    samples: [
      { accuracy: 4, latitude: -25.4, longitude: -49.2, timestamp: 1_000 },
      { accuracy: 4, latitude: -25.5, longitude: -49.3, timestamp: 2_000 },
    ],
    startTimestamp: 1_000,
    status: 'finalized',
  };
}

function path(uid: string, routeId: string) {
  return `users/${uid}/${ROUTE_FINANCIAL_LEDGER_COLLECTION}/${routeId}`;
}

describe('FirestoreRouteFinancialLedgerDataSource', () => {
  beforeEach(() => {
    mockDocuments.clear();
    mockCache.clear();
    mockGetDocsFromServer.mockClear();
    mockRunTransaction.mockClear();
  });

  it('writes only the financial summary and is idempotent by routeId', async () => {
    const source = new FirestoreRouteFinancialLedgerDataSource(() => true);
    const route = localRoute('route-1');
    const summary = { date: route.date, distanceMeters: route.distanceMeters, id: route.id };

    await expect(source.upsertIfAbsent(summary, context())).resolves.toBe('created');
    await expect(source.upsertIfAbsent(summary, context())).resolves.toBe('already-present');

    expect(mockDocuments.size).toBe(1);
    const written = mockDocuments.get(path('user-a', 'route-1'));
    expect(written).toMatchObject({
      date: '2026-08-06',
      distanceMeters: 12_400,
      routeId: 'route-1',
      schemaVersion: 1,
      status: 'active',
    });
    expect(written).not.toHaveProperty('coordinates');
    expect(written).not.toHaveProperty('samples');
    expect(written).not.toHaveProperty('polyline');
  });

  it('keeps ledger reads isolated by UID and sessionVersion', async () => {
    let activeContext = context('user-a', 3);
    const source = new FirestoreRouteFinancialLedgerDataSource(
      (candidate) =>
        candidate.uid === activeContext.uid &&
        candidate.sessionVersion === activeContext.sessionVersion,
    );
    activeContext = context('user-b', 4);

    await expect(source.loadForFinance(context('user-a', 3))).resolves.toEqual([]);
    await expect(
      source.upsertIfAbsent(
        { date: '2026-08-06', distanceMeters: 100, id: 'old-session-route' },
        context('user-a', 3),
      ),
    ).resolves.toBe('stale-session');
    expect(mockGetDocsFromServer).not.toHaveBeenCalled();
    expect(getRouteFinancialLedgerCacheKey('user-a')).not.toBe(
      getRouteFinancialLedgerCacheKey('user-b'),
    );
  });

  it('migrates local v2 summaries idempotently without overwriting divergent or deleted records', async () => {
    mockDocuments.set(path('user-a', 'existing'), {
      date: '2026-08-06',
      distanceMeters: 12_400,
      routeId: 'existing',
      schemaVersion: 1,
      status: 'active',
    });
    mockDocuments.set(path('user-a', 'conflict'), {
      date: '2026-08-06',
      distanceMeters: 99,
      routeId: 'conflict',
      schemaVersion: 1,
      status: 'active',
    });
    mockDocuments.set(path('user-a', 'deleted'), {
      routeId: 'deleted',
      schemaVersion: 1,
      status: 'deleted',
    });
    const source = new FirestoreRouteFinancialLedgerDataSource(() => true);

    const result = await source.migrateLocalHistory(
      [
        localRoute('existing'),
        localRoute('conflict'),
        localRoute('deleted'),
        localRoute('new'),
        localRoute('new', 1),
      ],
      context(),
    );

    expect(result).toEqual({
      alreadyPresent: 1,
      attempted: 5,
      conflicts: 1,
      created: 1,
      failed: 0,
      skippedDeleted: 1,
    });
    expect(mockDocuments.get(path('user-a', 'conflict'))?.distanceMeters).toBe(99);
    expect(mockDocuments.get(path('user-a', 'new'))?.distanceMeters).toBe(12_400);
    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
  });

  it('returns the same canonical financial distance to Dev and Release for the same UID', async () => {
    mockDocuments.set(path('shared-user', 'route-shared'), {
      date: '2026-08-06',
      distanceMeters: 12_400,
      routeId: 'route-shared',
      schemaVersion: 1,
      status: 'active',
    });
    const dev = new FirestoreRouteFinancialLedgerDataSource(() => true);
    const release = new FirestoreRouteFinancialLedgerDataSource(() => true);

    const [devRoutes, releaseRoutes] = await Promise.all([
      dev.loadForFinance(context('shared-user', 1)),
      release.loadForFinance(context('shared-user', 2)),
    ]);

    expect(summarizeRouteKilometersByDate(devRoutes)).toEqual({ '2026-08-06': 12.4 });
    expect(summarizeRouteKilometersByDate(releaseRoutes)).toEqual({ '2026-08-06': 12.4 });
  });

  it('exposes the loaded finance summaries synchronously without another Firestore read', async () => {
    mockDocuments.set(path('user-a', 'route-1'), {
      date: '2026-08-06',
      distanceMeters: 12_400,
      routeId: 'route-1',
      schemaVersion: 1,
      status: 'active',
    });
    const source = new FirestoreRouteFinancialLedgerDataSource(() => true);

    expect(source.getMemoryForFinance(context())).toBeNull();
    const loaded = await source.loadForFinance(context());
    const readCount = mockGetDocsFromServer.mock.calls.length;

    expect(source.getMemoryForFinance(context())).toEqual(loaded);
    expect(source.getMemoryForFinance(context())).not.toBe(loaded);
    expect(mockGetDocsFromServer).toHaveBeenCalledTimes(readCount);
  });

  it('hydrates the persisted finance cache without requesting Firestore', async () => {
    mockCache.set(
      getRouteFinancialLedgerCacheKey('user-a'),
      JSON.stringify([
        {
          date: '2026-08-06',
          distanceMeters: 12_400,
          routeId: 'route-1',
          schemaVersion: 1,
          status: 'active',
        },
      ]),
    );
    const source = new FirestoreRouteFinancialLedgerDataSource(() => true);

    await expect(source.hydrateForFinanceFromCache(context())).resolves.toEqual([
      { date: '2026-08-06', distanceMeters: 12_400, id: 'route-1' },
    ]);
    expect(source.getMemoryForFinance(context())).toEqual([
      { date: '2026-08-06', distanceMeters: 12_400, id: 'route-1' },
    ]);
    expect(mockGetDocsFromServer).not.toHaveBeenCalled();
  });

  it('does not treat a missing finance cache as a complete empty route list', async () => {
    const source = new FirestoreRouteFinancialLedgerDataSource(() => true);

    await expect(source.hydrateForFinanceFromCache(context())).resolves.toBeNull();
    expect(source.getMemoryForFinance(context())).toBeNull();
    expect(mockGetDocsFromServer).not.toHaveBeenCalled();
  });

  it('uses the ledger and pending summaries only, preferring remote values and ignoring tombstones', async () => {
    mockDocuments.set(path('user-a', 'route-1'), {
      date: '2026-08-06',
      distanceMeters: 12_400,
      routeId: 'route-1',
      schemaVersion: 1,
      status: 'active',
    });
    mockDocuments.set(path('user-a', 'deleted-route'), {
      routeId: 'deleted-route',
      schemaVersion: 1,
      status: 'deleted',
    });
    const source = new FirestoreRouteFinancialLedgerDataSource(() => true);
    await source.queuePendingSummary(
      { date: '2026-08-06', distanceMeters: 3_000, id: 'unsynced-route' },
      context(),
    );

    const result = await source.loadForFinance(context());

    expect(summarizeRouteKilometersByDate(result)).toEqual({
      '2026-08-06': 15.4,
    });
    expect(result.filter((item) => item.id === 'route-1')).toEqual([
      { date: '2026-08-06', distanceMeters: 12_400, id: 'route-1' },
    ]);
  });

  it('uses UID-scoped pending summaries as an offline fallback without GPS data', async () => {
    const source = new FirestoreRouteFinancialLedgerDataSource(() => true);
    await source.queuePendingSummary(
      { date: '2026-08-06', distanceMeters: 3_000, id: 'pending-route' },
      context(),
    );
    mockGetDocsFromServer.mockRejectedValueOnce(new Error('offline'));

    const result = await source.loadForFinance(context());

    expect(result).toEqual([{ date: '2026-08-06', distanceMeters: 3_000, id: 'pending-route' }]);
    expect(mockCache.get(getRouteFinancialLedgerCacheKey('user-a')) ?? '').not.toMatch(
      /samples|coordinates|polyline/i,
    );
  });
});
