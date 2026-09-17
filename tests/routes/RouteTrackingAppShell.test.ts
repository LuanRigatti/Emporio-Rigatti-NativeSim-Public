/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, Fragment, type ReactNode } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RouteTrackingSession } from '@/types/routeTracking';

const mockStorage = new Map<string, string>();
const mockHydrationValues: boolean[] = [];
const mockSessionState: {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  user: { id: string } | null;
  sessionVersion: number;
} = {
  sessionVersion: 1,
  status: 'authenticated',
  user: { id: 'uid-a' },
};

const mockClientDataSource = {
  hydrateFromCache: jest.fn(() => Promise.resolve()),
  setSessionUser: jest.fn(),
};
const mockDeliveryDataSource = {
  hydrateFromCache: jest.fn(() => Promise.resolve()),
  setSessionUser: jest.fn(),
};
const mockFactoryDataSource = {
  restore: jest.fn(() => Promise.resolve()),
  setSessionUser: jest.fn(),
};
const mockRouteService = {
  restoreActiveRouteAfterAppRestart: jest.fn(() => Promise.resolve(null)),
};
const mockFont = { loadAsync: jest.fn(() => Promise.resolve()) };

function mockPassthrough({ children }: { children?: ReactNode }) {
  return createElement(Fragment, null, children);
}

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    clear: jest.fn(() => {
      mockStorage.clear();
      return Promise.resolve();
    }),
    getItem: jest.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
    removeItem: jest.fn((key: string) => {
      mockStorage.delete(key);
      return Promise.resolve();
    }),
    setItem: jest.fn((key: string, value: string) => {
      mockStorage.set(key, value);
      return Promise.resolve();
    }),
  },
}));

jest.mock('@/providers', () => {
  const React = require('react') as typeof import('react');
  const InitialCacheHydrationContext = React.createContext(false);
  return {
    AppSafeAreaProvider: mockPassthrough,
    AppModeProvider: mockPassthrough,
    InitialCacheHydrationContext,
    SessionProvider: mockPassthrough,
    TestModeProvider: mockPassthrough,
    useSession: () => mockSessionState,
  };
});

jest.mock('expo-router', () => {
  const React = require('react') as typeof import('react');
  const Screen = ({ children }: { children?: ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  Screen.BackButton = Screen;
  const HydrationProbe = ({ children }: { children?: ReactNode }) => {
    const { InitialCacheHydrationContext } = require('@/providers') as {
      InitialCacheHydrationContext: React.Context<boolean>;
    };
    const isHydrated = React.useContext(InitialCacheHydrationContext);
    mockHydrationValues.push(isHydrated);
    return React.createElement(React.Fragment, null, children);
  };
  const Stack = ({ children }: { children?: ReactNode }) => {
    return React.createElement(HydrationProbe, null, children);
  };
  Stack.Protected = Screen;
  Stack.Screen = Screen;
  return {
    DefaultTheme: {
      colors: {
        background: '#000',
        border: '#000',
        card: '#000',
        notification: '#f00',
        primary: '#fff',
        text: '#fff',
      },
      dark: true,
    },
    Stack,
    ThemeProvider: mockPassthrough,
    usePathname: () => '/',
  };
});

jest.mock('expo-splash-screen', () => ({
  hide: jest.fn(),
  hideAsync: jest.fn(() => Promise.resolve()),
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('@expo/vector-icons/Ionicons', () => ({
  __esModule: true,
  default: { font: {} },
}));

jest.mock('expo-font', () => mockFont);
jest.mock('react-native-gesture-handler', () => ({ GestureHandlerRootView: mockPassthrough }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: mockPassthrough,
  initialWindowMetrics: null,
}));
jest.mock('react-native-keyboard-controller', () => ({ KeyboardProvider: mockPassthrough }));
jest.mock('@/components/auth/BiometricLockOverlay', () => ({ BiometricLockOverlay: () => null }));
jest.mock('@/hooks/useBiometricUnlock', () => ({
  useBiometricUnlock: () => ({ canRetry: false, isPrivacyActive: false, retry: jest.fn() }),
}));
jest.mock('@/theme', () => ({
  ThemeProvider: mockPassthrough,
  useAppTheme: () => ({
    resolvedMode: 'dark',
    theme: {
      colors: {
        background: '#000',
        danger: '#f00',
        primary: '#fff',
        separator: '#333',
        textPrimary: '#fff',
      },
    },
  }),
}));
jest.mock('@/features/quick-actions/QuickActionRouter', () => ({ QuickActionRouter: () => null }));
jest.mock('@/features/retail-orders/components/RetailOrderFlowProvider', () => ({
  RetailOrderFlowProvider: mockPassthrough,
}));
jest.mock('@/services/clients', () => ({ firestoreClientDataSource: mockClientDataSource }));
jest.mock('@/services/deliveries', () => ({ firestoreDeliveryDataSource: mockDeliveryDataSource }));
jest.mock('@/services/factory-purchases', () => ({
  firestoreFactoryReceiptDataSource: mockFactoryDataSource,
}));
jest.mock('@/services/routes', () => {
  const actual = jest.requireActual(
    '@/services/routes/RouteTrackingRepository',
  ) as typeof import('@/services/routes/RouteTrackingRepository');
  return {
    routeTrackingRepository: new actual.RouteTrackingRepository(),
    locationTrackingService: mockRouteService,
  };
});
jest.mock('@/services/finance/FinancialPeriodSnapshotCache', () => ({
  financialPeriodSnapshotCache: { read: jest.fn(() => Promise.resolve()) },
}));
jest.mock('@/services/stock/StockPeriodSnapshotCache', () => ({
  stockPeriodSnapshotCache: { read: jest.fn(() => Promise.resolve()) },
}));
const PrototypeRootLayout = require('@/app/_layout')
  .default as typeof import('@/app/_layout').default;
const { routeTrackingRepository } =
  require('@/services/routes') as typeof import('@/services/routes');
const { getRouteTrackingHistoryStorageKey, ROUTE_TRACKING_HISTORY_STORAGE_KEY } =
  require('@/services/routes/RouteTrackingRepository') as typeof import('@/services/routes/RouteTrackingRepository');

const routeHistory = (id: string, ownerUid: string): RouteTrackingSession => ({
  date: '2026-09-06',
  distanceMeters: 10_000,
  durationSeconds: 60,
  endTimestamp: 2_000,
  id,
  ownerUid,
  pointsCount: 2,
  samples: [],
  startTimestamp: 1_000,
  status: 'finalized',
});

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('real AppShell route preload', () => {
  let renderer: ReactTestRenderer | undefined;

  beforeEach(async () => {
    await AsyncStorage.clear();
    routeTrackingRepository.setSessionUser(null, 0);
    mockHydrationValues.length = 0;
    jest.clearAllMocks();
    mockSessionState.status = 'authenticated';
    mockSessionState.user = { id: 'uid-a' };
    mockSessionState.sessionVersion = 1;
  });

  afterEach(async () => {
    await act(async () => {
      renderer?.unmount();
    });
    renderer = undefined;
  });

  it('loads only the authenticated UID v2 history offline and releases the cache gate', async () => {
    const historyA = routeHistory('route-a', 'uid-a');
    const historyB = routeHistory('route-b', 'uid-b');
    await AsyncStorage.setItem(
      getRouteTrackingHistoryStorageKey('uid-a'),
      JSON.stringify([historyA]),
    );
    await AsyncStorage.setItem(
      getRouteTrackingHistoryStorageKey('uid-b'),
      JSON.stringify([historyB]),
    );
    await AsyncStorage.setItem(ROUTE_TRACKING_HISTORY_STORAGE_KEY, JSON.stringify([historyB]));

    await act(async () => {
      renderer = create(createElement(PrototypeRootLayout));
      await Promise.resolve();
    });
    await flushEffects();

    expect(mockHydrationValues.at(-1)).toBe(true);
    expect(routeTrackingRepository.getMemoryRouteHistory()).toEqual([historyA]);
    expect(mockClientDataSource.hydrateFromCache).toHaveBeenCalledWith('uid-a');
    expect(mockDeliveryDataSource.hydrateFromCache).toHaveBeenCalledWith('uid-a');
    expect(mockFactoryDataSource.restore).not.toHaveBeenCalled();
    expect(jest.mocked(AsyncStorage.getItem).mock.calls.map(([key]) => key)).toContain(
      getRouteTrackingHistoryStorageKey('uid-a'),
    );
    expect(jest.mocked(AsyncStorage.getItem)).not.toHaveBeenCalledWith(
      getRouteTrackingHistoryStorageKey('uid-b'),
    );
    expect(jest.mocked(AsyncStorage.getItem)).not.toHaveBeenCalledWith(
      ROUTE_TRACKING_HISTORY_STORAGE_KEY,
    );
  });

  it('does not preload authenticated history when there is no UID', async () => {
    const historyA = routeHistory('route-a', 'uid-a');
    await AsyncStorage.setItem(
      getRouteTrackingHistoryStorageKey('uid-a'),
      JSON.stringify([historyA]),
    );
    await AsyncStorage.setItem(ROUTE_TRACKING_HISTORY_STORAGE_KEY, JSON.stringify([historyA]));
    mockSessionState.status = 'unauthenticated';
    mockSessionState.user = null;

    await act(async () => {
      renderer = create(createElement(PrototypeRootLayout));
      await Promise.resolve();
    });
    await flushEffects();

    expect(routeTrackingRepository.getMemoryRouteHistory()).toBeNull();
    expect(jest.mocked(AsyncStorage.getItem)).not.toHaveBeenCalledWith(
      getRouteTrackingHistoryStorageKey('uid-a'),
    );
    expect(jest.mocked(AsyncStorage.getItem)).not.toHaveBeenCalledWith(
      ROUTE_TRACKING_HISTORY_STORAGE_KEY,
    );
  });

  it('discards a stale preload after switching UID before the first read resolves', async () => {
    const historyA = routeHistory('route-a', 'uid-a');
    const historyB = routeHistory('route-b', 'uid-b');
    let resolveA: (value: string | null) => void = () => undefined;
    let resolveB: (value: string | null) => void = () => undefined;
    const readA = new Promise<string | null>((resolve) => {
      resolveA = resolve;
    });
    const readB = new Promise<string | null>((resolve) => {
      resolveB = resolve;
    });
    jest.mocked(AsyncStorage.getItem).mockImplementation((key: string) => {
      if (key === getRouteTrackingHistoryStorageKey('uid-a')) return readA;
      if (key === getRouteTrackingHistoryStorageKey('uid-b')) return readB;
      return Promise.resolve(mockStorage.get(key) ?? null);
    });

    await act(async () => {
      renderer = create(createElement(PrototypeRootLayout));
      await Promise.resolve();
    });

    mockSessionState.user = { id: 'uid-b' };
    mockSessionState.sessionVersion = 2;
    await act(async () => {
      renderer?.update(createElement(PrototypeRootLayout));
      await Promise.resolve();
    });

    expect(routeTrackingRepository.getMemoryRouteHistory()).toBeNull();
    resolveB(JSON.stringify([historyB]));
    await flushEffects();
    resolveA(JSON.stringify([historyA]));
    await flushEffects();

    expect(routeTrackingRepository.getMemoryRouteHistory()).toEqual([historyB]);
    expect(routeTrackingRepository.getMemoryRouteHistory()?.[0]?.ownerUid).toBe('uid-b');
  });
});
