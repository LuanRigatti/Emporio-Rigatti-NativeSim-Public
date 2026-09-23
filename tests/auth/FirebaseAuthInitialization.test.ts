const mockInitializeAuth = jest.fn((..._args: unknown[]): unknown => undefined);
const mockGetAuth = jest.fn((..._args: unknown[]): unknown => undefined);
const mockGetReactNativePersistence = jest.fn((..._args: unknown[]) => ({ type: 'LOCAL' }));
const mockFirebaseApp = { name: '[DEFAULT]' };

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(),
  },
}));

jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: (...args: unknown[]) => mockGetAuth(...args),
  getReactNativePersistence: (...args: unknown[]) => mockGetReactNativePersistence(...args),
  initializeAuth: (...args: unknown[]) => mockInitializeAuth(...args),
}));

jest.mock('@/services/firebase/app', () => ({
  getFirebaseApp: () => mockFirebaseApp,
}));

describe('Firebase Auth initialization diagnostics', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('identifies the persistent initialization path', () => {
    const persistentAuth = { currentUser: null };
    mockInitializeAuth.mockReturnValue(persistentAuth);

    const { getFirebaseAuth } =
      require('@/services/firebase/auth') as typeof import('@/services/firebase/auth');
    const diagnostics =
      require('@/services/auth/AuthDiagnostic') as typeof import('@/services/auth/AuthDiagnostic');

    expect(getFirebaseAuth()).toBe(persistentAuth);
    expect(diagnostics.getAuthDiagnosticEvents()).toEqual(['auth:init:persistent']);
  });

  it('identifies the fallback getAuth path without exposing the exception contents', () => {
    const fallbackAuth = { currentUser: null };
    mockInitializeAuth.mockImplementation(() => {
      throw {
        code: 'auth/already-initialized',
        message: 'credential=synthetic-secret email=test-user@example.test',
      };
    });
    mockGetAuth.mockReturnValue(fallbackAuth);

    const { getFirebaseAuth } =
      require('@/services/firebase/auth') as typeof import('@/services/firebase/auth');
    const diagnostics =
      require('@/services/auth/AuthDiagnostic') as typeof import('@/services/auth/AuthDiagnostic');

    expect(getFirebaseAuth()).toBe(fallbackAuth);
    expect(diagnostics.getAuthDiagnosticEvents()).toEqual([
      'auth:init:fallback-getAuth:auth-already-initialized',
    ]);
    expect(diagnostics.getAuthDiagnosticEvents().join(' ')).not.toContain('private-value');
    expect(diagnostics.getAuthDiagnosticEvents().join(' ')).not.toContain('test-user@example.test');
  });
});
