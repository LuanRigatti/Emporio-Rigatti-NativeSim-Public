import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { get as httpGet } from 'node:http';
import { createConnection } from 'node:net';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  inMemoryPersistence,
  initializeAuth,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
} from 'firebase/auth';
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  setDoc,
  type Firestore,
} from 'firebase/firestore';

import { useCarSettings } from '@/hooks/useCarSettings';
import { useAuth } from '@/providers';
import {
  CAR_SETTINGS_STORAGE_KEY,
  carSettingsStorageKey,
  EMPTY_CAR_SETTINGS,
  FirestoreCarSettingsDataSource,
  firestoreCarSettingsDataSource,
  type FirestoreCarSettingsLoadResult,
} from '@/services/car';
import { FirestoreDailyMonthlyDataSource } from '@/services/costs/FirestoreDailyMonthlyDataSource';
import type { CostSettings, CostValues } from '@/services/costs/CostSettingsStorage';

const DEMO_PROJECT_ID = 'demo-emporio-integrity-stage1';
const emulatorConfig = require('../../firebase.emulator.json') as {
  emulators: {
    auth: { host: string; port: number };
    firestore: { host: string; port: number };
  };
};
const AUTH_HOST = emulatorConfig.emulators.auth.host;
const AUTH_PORT = emulatorConfig.emulators.auth.port;
const FIRESTORE_HOST = emulatorConfig.emulators.firestore.host;
const FIRESTORE_PORT = emulatorConfig.emulators.firestore.port;
const TEST_PASSWORD = 'Stage1-Emulator-Only-2026!';
const ALLOWED_EMULATOR_PORTS = new Set([AUTH_PORT, FIRESTORE_PORT]);
const mockStorageValues = new Map<string, string>();
let mockEmulatorFirestore: Firestore | undefined;
const emulatorRequested = Object.prototype.hasOwnProperty.call(
  process.env,
  'STAGE1_EMULATOR_PROJECT_ID',
);
const emulatorDescribe = emulatorRequested ? describe : describe.skip;

const originalFetch = globalThis.fetch;
if (typeof originalFetch === 'function') {
  const localFetch = originalFetch.bind(globalThis);
  globalThis.fetch = ((input, init) => {
    let target: URL | undefined;
    try {
      if (typeof input === 'string') target = new URL(input);
      else if (input instanceof URL) target = input;
      else if (input && typeof input === 'object' && 'url' in input) {
        target = new URL(String(input.url));
      }
    } catch {
      target = undefined;
    }

    if (
      !target ||
      target.protocol !== 'http:' ||
      target.hostname !== '127.0.0.1' ||
      !ALLOWED_EMULATOR_PORTS.has(Number(target.port))
    ) {
      return Promise.reject(
        new Error(`stage1_non_emulator_fetch_blocked origin=${target?.origin ?? 'invalid'}`),
      );
    }

    return localFetch(input, { ...init, redirect: 'error' });
  }) as typeof fetch;
}

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(mockStorageValues.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      mockStorageValues.set(key, value);
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      mockStorageValues.delete(key);
      return Promise.resolve();
    }),
  },
}));

jest.mock('@/config/featureFlags', () => ({ ENABLE_FIRESTORE_CAR_SETTINGS: true }));
jest.mock('@/providers', () => ({ useAuth: jest.fn() }));
jest.mock('@/services/firebase/firestore', () => ({
  getFirebaseFirestore: () => {
    if (!mockEmulatorFirestore) throw new Error('stage1_emulator_firestore_not_initialized');
    return mockEmulatorFirestore;
  },
}));

const mockUseAuth = jest.mocked(useAuth);

let app: FirebaseApp;
let auth: Auth;
let database: Firestore;
let uidA: string;
let uidB: string;
let uidC: string;
let uidD: string;
let accountA: { email: string; password: string };
let accountB: { email: string; password: string };
let accountC: { email: string; password: string };
let accountD: { email: string; password: string };

function settings(days: CostSettings['periods']['day']): CostSettings {
  return { periods: { day: days, month: {}, year: {} } };
}

function costValues(overrides: Partial<CostValues> = {}): CostValues {
  return {
    estar: '',
    fuel: '',
    fuelPrice: '',
    fuelType: '',
    kilometers: '',
    light: '',
    other: '',
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  void promise.catch(() => undefined);
  return { promise, resolve, reject };
}

function createCarLoadObserver() {
  const waiters = new Map<
    string,
    ReturnType<typeof deferred<FirestoreCarSettingsLoadResult | undefined>>[]
  >();
  const originalLoad = firestoreCarSettingsDataSource.loadWithMetadata.bind(
    firestoreCarSettingsDataSource,
  );
  const spy = jest
    .spyOn(firestoreCarSettingsDataSource, 'loadWithMetadata')
    .mockImplementation(async (uid, options) => {
      try {
        const result = await originalLoad(uid, options);
        waiters.get(uid)?.shift()?.resolve(result);
        return result;
      } catch (error) {
        waiters.get(uid)?.shift()?.reject(error);
        throw error;
      }
    });

  return {
    spy,
    waitForNext(uid: string) {
      const signal = deferred<FirestoreCarSettingsLoadResult | undefined>();
      const queue = waiters.get(uid) ?? [];
      queue.push(signal);
      waiters.set(uid, queue);
      return signal.promise;
    },
  };
}

async function assertLocalEmulatorEndpoint(
  host: string,
  port: number,
  service: 'auth' | 'firestore',
): Promise<void> {
  if (host !== '127.0.0.1') throw new Error(`stage1_${service}_host_must_be_loopback`);

  await new Promise<void>((resolve, reject) => {
    const socket = createConnection({ host, port });
    let settled = false;
    const timer = setTimeout(
      () =>
        finish(
          new Error(
            `stage1_${service}_emulator_unavailable endpoint=${host}:${port} reason=tcp_timeout`,
          ),
        ),
      1500,
    );
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      if (error) reject(error);
      else resolve();
    };
    socket.once('connect', () => finish());
    socket.once('error', (error) =>
      finish(
        new Error(
          `stage1_${service}_emulator_unavailable endpoint=${host}:${port} reason=${error.message}`,
        ),
      ),
    );
  });
}

function assertJestFetchRuntime(): void {
  const expoFetchBypassed =
    process.env.EXPO_PUBLIC_USE_RN_FETCH === '1' || process.env.EXPO_PUBLIC_USE_RN_FETCH === 'true';
  if (!expoFetchBypassed) {
    throw new Error(
      'stage1_fetch_runtime_misconfigured: set EXPO_PUBLIC_USE_RN_FETCH=1 before starting Jest to preserve Node fetch instead of jest-expo NativeResponse stubs',
    );
  }
  if (typeof globalThis.fetch !== 'function') {
    throw new Error('stage1_node_fetch_unavailable: Jest runtime has no fetch implementation');
  }
}

async function assertAuthEmulatorHttpEndpoint(): Promise<void> {
  if (AUTH_HOST !== '127.0.0.1') {
    throw new Error('stage1_auth_host_must_be_loopback');
  }

  const path = `/emulator/v1/projects/${DEMO_PROJECT_ID}/config`;
  const endpoint = `http://${AUTH_HOST}:${AUTH_PORT}${path}`;
  await new Promise<void>((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout>;
    const request = httpGet(
      { hostname: AUTH_HOST, port: AUTH_PORT, path, method: 'GET' },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          body += chunk;
          if (body.length > 16_384) request.destroy(new Error('response_too_large'));
        });
        response.once('error', (error) => {
          clearTimeout(timeout);
          reject(
            new Error(
              `stage1_auth_emulator_http_error endpoint=${endpoint} reason=${error.message}`,
            ),
          );
        });
        response.once('end', () => {
          clearTimeout(timeout);
          if (response.statusCode !== 200) {
            reject(
              new Error(
                `stage1_auth_emulator_http_unavailable endpoint=${endpoint} status=${response.statusCode ?? 'unknown'}`,
              ),
            );
            return;
          }

          try {
            const payload = JSON.parse(body) as { signIn?: { allowDuplicateEmails?: unknown } };
            if (typeof payload.signIn?.allowDuplicateEmails !== 'boolean') {
              throw new Error('missing_auth_emulator_config_shape');
            }
          } catch (error) {
            reject(
              new Error(
                `stage1_auth_emulator_unexpected_response endpoint=${endpoint} reason=${error instanceof Error ? error.message : String(error)}`,
              ),
            );
            return;
          }

          resolve();
        });
      },
    );

    timeout = setTimeout(() => request.destroy(new Error('request_timeout')), 1500);
    request.once('error', (error) => {
      clearTimeout(timeout);
      reject(
        new Error(`stage1_auth_emulator_unreachable endpoint=${endpoint} reason=${error.message}`),
      );
    });
  });
}

function throwAuthOperationDiagnostic(operation: 'create_user' | 'sign_in', error: unknown): never {
  const authError = error as {
    code?: unknown;
    message?: unknown;
    customData?: { message?: unknown };
  };
  const code = typeof authError?.code === 'string' ? authError.code : 'unknown';
  const detailValue = authError?.customData?.message ?? authError?.message ?? error;
  const detail = String(detailValue).replace(/\s+/g, ' ').slice(0, 240);
  const diagnostic = new Error(
    `stage1_auth_${operation}_failed_after_local_preflight project=${DEMO_PROJECT_ID} endpoint=http://${AUTH_HOST}:${AUTH_PORT} firebaseCode=${code} detail=${detail}`,
  );
  (diagnostic as Error & { cause?: unknown }).cause = error;
  throw diagnostic;
}

function CarSettingsHarness({
  onRender,
}: {
  onRender: (value: ReturnType<typeof useCarSettings>) => void;
}) {
  onRender(useCarSettings());
  return null;
}

async function signInAs(credentials: { email: string; password: string }): Promise<string> {
  try {
    const result = await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
    return result.user.uid;
  } catch (error) {
    throwAuthOperationDiagnostic('sign_in', error);
  }
}

async function createEmulatorUser(credentials: {
  email: string;
  password: string;
}): Promise<string> {
  try {
    return (await createUserWithEmailAndPassword(auth, credentials.email, credentials.password))
      .user.uid;
  } catch (error) {
    throwAuthOperationDiagnostic('create_user', error);
  }
}

emulatorDescribe('Stage 1 integrity checks against Firebase Emulator', () => {
  jest.setTimeout(30_000);

  beforeAll(async () => {
    assertJestFetchRuntime();
    if (process.env.STAGE1_EMULATOR_PROJECT_ID !== DEMO_PROJECT_ID) {
      throw new Error('stage1_tests_require_fixed_demo_project');
    }
    for (const key of ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT']) {
      if (process.env[key] && process.env[key] !== DEMO_PROJECT_ID) {
        throw new Error('stage1_tests_reject_non_demo_project_environment');
      }
    }
    await Promise.all([
      assertLocalEmulatorEndpoint(AUTH_HOST, AUTH_PORT, 'auth'),
      assertLocalEmulatorEndpoint(FIRESTORE_HOST, FIRESTORE_PORT, 'firestore'),
    ]);
    await assertAuthEmulatorHttpEndpoint();

    const accountSuffix = `${process.pid}@example.test`;
    accountA = { email: `stage1-a-${accountSuffix}`, password: TEST_PASSWORD };
    accountB = { email: `stage1-b-${accountSuffix}`, password: TEST_PASSWORD };
    accountC = { email: `stage1-c-${accountSuffix}`, password: TEST_PASSWORD };
    accountD = { email: `stage1-d-${accountSuffix}`, password: TEST_PASSWORD };

    app = initializeApp(
      {
        apiKey: 'emulator-only',
        appId: '1:1234567890:web:stage1-integrity',
        authDomain: `${DEMO_PROJECT_ID}.firebaseapp.com`,
        projectId: DEMO_PROJECT_ID,
      },
      `stage1-integrity-${process.pid}`,
    );
    auth = initializeAuth(app, { persistence: inMemoryPersistence });
    connectAuthEmulator(auth, `http://${AUTH_HOST}:${AUTH_PORT}`, { disableWarnings: true });
    database = getFirestore(app);
    connectFirestoreEmulator(database, FIRESTORE_HOST, FIRESTORE_PORT);
    mockEmulatorFirestore = database;

    uidA = await createEmulatorUser(accountA);
    await setDoc(doc(database, 'users', uidA, 'settings', 'car'), {
      alcoholAutonomy: 'A-only alcohol value',
      gasolineAutonomy: 'A-only gasoline value',
    });
    await signOut(auth);

    uidB = await createEmulatorUser(accountB);
    await signOut(auth);

    uidC = await createEmulatorUser(accountC);
    await setDoc(doc(database, 'users', uidC, 'settings', 'car'), {
      alcoholAutonomy: '6,1 Km/l',
      gasolineAutonomy: '8,2 Km/l',
    });
    await signOut(auth);

    uidD = await createEmulatorUser(accountD);
    await signOut(auth);
  });

  afterAll(async () => {
    if (auth?.currentUser) await signOut(auth);
    if (app) await deleteApp(app);
    mockEmulatorFirestore = undefined;
  });

  beforeEach(async () => {
    mockStorageValues.clear();
    if (auth.currentUser) await signOut(auth);
    const signedInUid = await signInAs(accountB);
    if (signedInUid !== uidB) throw new Error('stage1_auth_emulator_returned_unexpected_uid');
    mockUseAuth.mockReturnValue({ user: { id: uidB }, sessionVersion: 2 } as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not replay stale local cost after remote deletion', async () => {
    const remoteDocument = doc(database, 'users', uidB, 'dailyData', '2026-09-02');
    await setDoc(remoteDocument, { data: '2026-09-02', km: 11 });
    await deleteDoc(remoteDocument);
    expect((await getDoc(remoteDocument)).exists()).toBe(false);

    const staleCache = settings({ '2026-09-02': costValues({ kilometers: '11' }) });
    const source = new FirestoreDailyMonthlyDataSource();
    await source.saveSettingsDiff(uidB, settings({}), staleCache, { changes: [] });

    expect((await getDoc(remoteDocument)).exists()).toBe(false);
  });

  it('keeps account A legacy and UID cache isolated after switching to account B', async () => {
    const legacyAccountASettings = {
      alcoholAutonomy: 'A-only alcohol value',
      gasolineAutonomy: 'A-only gasoline value',
    };
    mockStorageValues.set(CAR_SETTINGS_STORAGE_KEY, JSON.stringify(legacyAccountASettings));
    mockStorageValues.set(carSettingsStorageKey(uidA), JSON.stringify(legacyAccountASettings));

    await signOut(auth);
    expect(await signInAs(accountA)).toBe(uidA);
    mockUseAuth.mockReturnValue({ user: { id: uidA }, sessionVersion: 10 } as never);

    const observer = createCarLoadObserver();
    const accountALoad = observer.waitForNext(uidA);
    let current: ReturnType<typeof useCarSettings> | undefined;
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(
        createElement(CarSettingsHarness, { onRender: (value) => (current = value) }),
      );
    });
    await act(async () => {
      await accountALoad;
      await Promise.resolve();
    });
    expect(current?.settings).toEqual({
      alcoholAutonomy: 'A-only alcohol value',
      gasolineAutonomy: 'A-only gasoline value',
    });

    await signOut(auth);
    expect(await signInAs(accountB)).toBe(uidB);
    mockUseAuth.mockReturnValue({ user: { id: uidB }, sessionVersion: 11 } as never);
    const accountBLoad = observer.waitForNext(uidB);
    await act(async () => {
      renderer?.update(
        createElement(CarSettingsHarness, { onRender: (value) => (current = value) }),
      );
    });
    await act(async () => {
      await accountBLoad;
      await Promise.resolve();
    });

    expect(current?.settings).toEqual(EMPTY_CAR_SETTINGS);
    expect((await getDoc(doc(database, 'users', uidB, 'settings', 'car'))).exists()).toBe(false);
    expect(mockStorageValues.get(CAR_SETTINGS_STORAGE_KEY)).toBe(
      JSON.stringify(legacyAccountASettings),
    );
    expect(mockStorageValues.has(carSettingsStorageKey(uidB))).toBe(false);

    await act(async () => renderer?.unmount());
  });

  it('ignores an old response across logout and login for the same UID', async () => {
    const oldRemote = deferred<FirestoreCarSettingsLoadResult | undefined>();
    const oldReadReady = deferred<FirestoreCarSettingsLoadResult | undefined>();
    const freshReadReady = deferred<FirestoreCarSettingsLoadResult | undefined>();
    const originalLoad = firestoreCarSettingsDataSource.loadWithMetadata.bind(
      firestoreCarSettingsDataSource,
    );
    let uidCReadCount = 0;
    jest
      .spyOn(firestoreCarSettingsDataSource, 'loadWithMetadata')
      .mockImplementation(async (uid, options) => {
        let result: FirestoreCarSettingsLoadResult | undefined;
        try {
          result = await originalLoad(uid, options);
        } catch (error) {
          if (uid === uidC) {
            uidCReadCount += 1;
            if (uidCReadCount === 1) oldReadReady.reject(error);
            if (uidCReadCount === 2) freshReadReady.reject(error);
          }
          throw error;
        }
        if (uid !== uidC) return result;
        uidCReadCount += 1;
        if (uidCReadCount === 1) {
          oldReadReady.resolve(result);
          return oldRemote.promise;
        }
        if (uidCReadCount === 2) freshReadReady.resolve(result);
        return result;
      });

    await signOut(auth);
    expect(await signInAs(accountC)).toBe(uidC);
    mockUseAuth.mockReturnValue({ user: { id: uidC }, sessionVersion: 20 } as never);
    let current: ReturnType<typeof useCarSettings> | undefined;
    let renderer: ReactTestRenderer | undefined;
    let firstRemote: FirestoreCarSettingsLoadResult | undefined;
    await act(async () => {
      renderer = create(
        createElement(CarSettingsHarness, { onRender: (value) => (current = value) }),
      );
    });
    await act(async () => {
      firstRemote = await oldReadReady.promise;
      await Promise.resolve();
    });
    expect(firstRemote?.settings.gasolineAutonomy).toBe('8,2 Km/l');

    await signOut(auth);
    mockUseAuth.mockReturnValue({ user: null, sessionVersion: 21 } as never);
    await act(async () => {
      renderer?.update(
        createElement(CarSettingsHarness, { onRender: (value) => (current = value) }),
      );
      await Promise.resolve();
    });
    expect(current?.settings).toEqual(EMPTY_CAR_SETTINGS);

    expect(await signInAs(accountC)).toBe(uidC);
    await setDoc(doc(database, 'users', uidC, 'settings', 'car'), {
      alcoholAutonomy: '6,3 Km/l',
      gasolineAutonomy: '8,4 Km/l',
    });
    mockUseAuth.mockReturnValue({ user: { id: uidC }, sessionVersion: 22 } as never);
    await act(async () => {
      renderer?.update(
        createElement(CarSettingsHarness, { onRender: (value) => (current = value) }),
      );
    });
    await act(async () => {
      await freshReadReady.promise;
      await Promise.resolve();
    });
    expect(current?.settings.gasolineAutonomy).toBe('8,4 Km/l');

    oldRemote.resolve(firstRemote);
    await act(async () => {
      await oldRemote.promise;
      await Promise.resolve();
    });
    expect(current?.settings.gasolineAutonomy).toBe('8,4 Km/l');
    await act(async () => renderer?.unmount());
  });

  it('merges concurrent explicit cost creates from separate clients', async () => {
    await signOut(auth);
    expect(await signInAs(accountD)).toBe(uidD);
    const date = '2026-09-04';
    const remoteDocument = doc(database, 'users', uidD, 'dailyData', date);
    await deleteDoc(remoteDocument);

    const kilometerSource = new FirestoreDailyMonthlyDataSource();
    const fuelSource = new FirestoreDailyMonthlyDataSource();
    const empty = settings({});
    const kilometerSettings = settings({ [date]: costValues({ kilometers: '31' }) });
    const fuelSettings = settings({ [date]: costValues({ fuel: '24' }) });
    await Promise.all([
      kilometerSource.saveSettingsDiff(uidD, empty, kilometerSettings, {
        changes: [{ period: 'day', key: date, field: 'kilometers', revision: 1 }],
      }),
      fuelSource.saveSettingsDiff(uidD, empty, fuelSettings, {
        changes: [{ period: 'day', key: date, field: 'fuel', revision: 1 }],
      }),
    ]);

    const snapshot = await getDoc(remoteDocument);
    expect(snapshot.exists()).toBe(true);
    expect(snapshot.data()).toMatchObject({ data: date, km: 31, gasolina: 24 });
  });

  it('preserves concurrent car field updates when two clients create one document', async () => {
    await signOut(auth);
    expect(await signInAs(accountD)).toBe(uidD);
    const remoteDocument = doc(database, 'users', uidD, 'settings', 'car');
    await deleteDoc(remoteDocument);

    const firstClient = new FirestoreCarSettingsDataSource();
    const secondClient = new FirestoreCarSettingsDataSource();
    await Promise.all([
      firstClient.saveFields(uidD, { gasolineAutonomy: '9,1 Km/l' }, true),
      secondClient.saveFields(uidD, { alcoholAutonomy: '6,7 Km/l' }, true),
    ]);

    const snapshot = await getDoc(remoteDocument);
    expect(snapshot.exists()).toBe(true);
    expect(snapshot.data()).toMatchObject({
      alcoholAutonomy: '6,7 Km/l',
      gasolineAutonomy: '9,1 Km/l',
    });
  });
});
