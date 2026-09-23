/* eslint-disable @typescript-eslint/no-require-imports */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ReactNode } from 'react';

const mockAppMode = {
  isReady: true,
  mode: 'retail' as 'wholesale' | 'retail',
};
const mockUseDeliveries = jest.fn(() => ({
  deliveries: [],
  remove: jest.fn(),
  toggleDelivered: jest.fn(),
}));
const mockUseClients = jest.fn(() => ({ clients: [] }));
const mockUseFactoryPurchases = jest.fn(() => ({ dataUnavailable: false, purchases: [] }));
const mockUseOpenPaymentClients = jest.fn(() => ({ clientCards: [], totalOpenAmount: 0 }));

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@expo/vector-icons/Ionicons', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/layout', () => ({ NativeGlassHeader: () => null }));
jest.mock('@/components/navigation/HomeToolbar', () => ({
  HomeToolbar: () => null,
  useHomeModeSelector: () => ({
    mode: mockAppMode.mode,
    visible: false,
    open: jest.fn(),
    onVisibleChange: jest.fn(),
    onDismiss: jest.fn(),
    onSelect: jest.fn(),
  }),
}));
jest.mock('@/components/premium', () => ({
  AnimatedPressable: ({ children }: { children?: ReactNode }) => children,
  PremiumCard: ({ children }: { children?: ReactNode }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('premium-card', null, children);
  },
  PremiumScreen: ({ children }: { children?: ReactNode }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('premium-screen', null, children);
  },
}));
jest.mock('@/features/home/components/RetailHome', () => ({
  RetailHome: () => {
    const React = require('react') as typeof import('react');
    return React.createElement('retail-home');
  },
}));
jest.mock('@/features/home/profile/HomeProfileSheet', () => ({ HomeProfileSheet: () => null }));
jest.mock('@/features/open-payments/hooks/useOpenPaymentClients', () => ({
  useOpenPaymentClients: mockUseOpenPaymentClients,
}));
jest.mock('@/hooks/useClients', () => ({ useClients: mockUseClients }));
jest.mock('@/hooks/useDeliveries', () => ({ useDeliveries: mockUseDeliveries }));
jest.mock('@/hooks/useFactoryPurchases', () => ({ useFactoryPurchases: mockUseFactoryPurchases }));
jest.mock('@/providers', () => ({
  useAppMode: () => mockAppMode,
  useAppSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
  useAuth: () => ({ user: { displayName: 'Conta', id: 'uid' } }),
}));
jest.mock('@/services/factory-purchases', () => ({
  factoryPurchaseCalculationService: { summarize: () => ({ openValue: 0 }) },
}));
jest.mock('@/features/invoices', () => ({ countOpenDocuments: () => 0 }));
jest.mock('@/theme', () => ({
  getCardSurfaceColor: () => '#FFFFFF',
  useAppTheme: () => ({
    resolvedMode: 'light',
    theme: {
      colors: {
        background: '#FFFFFF',
        danger: '#FF0000',
        surface: '#FFFFFF',
        textPrimary: '#000000',
        textSecondary: '#666666',
        warning: '#FF9900',
      },
      layout: { screenHorizontalPadding: 24, tabBarHeight: 80 },
      radius: { xl: 24 },
      sizes: { iconMedium: 24 },
      spacing: { lg: 20, md: 16, sm: 8, xl: 24, xs: 8, xxl: 32, xxxl: 40, xxs: 4 },
      typography: { body: {}, footnote: {}, headline: {} },
    },
  }),
}));
jest.mock('@/utils/data', () => ({ todayIso: () => '2026-09-18' }));
jest.mock('@/utils/haptics', () => ({ triggerLightImpactHaptic: jest.fn() }));
jest.mock('@/utils/presentation/testModeValues', () => ({
  useTestModePresentation: () => ({
    currency: (value: number) => String(value),
    enabled: false,
    text: (value: string) => value,
  }),
}));

const DashboardRoute = require('@/app/(tabs)/dashboard/index').default as () => ReactNode;

function renderDashboard(): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(createElement(DashboardRoute));
  });
  return renderer;
}

describe('Dashboard AppMode routing', () => {
  beforeEach(() => {
    mockAppMode.isReady = true;
    mockAppMode.mode = 'retail';
    mockUseDeliveries.mockClear();
    mockUseClients.mockClear();
    mockUseFactoryPurchases.mockClear();
    mockUseOpenPaymentClients.mockClear();
  });

  it('renders Retail Home without initializing Wholesale hooks', () => {
    const renderer = renderDashboard();

    expect(renderer.root.findAll((node) => String(node.type) === 'retail-home')).toHaveLength(1);
    expect(mockUseDeliveries).not.toHaveBeenCalled();
    expect(mockUseClients).not.toHaveBeenCalled();
    expect(mockUseFactoryPurchases).not.toHaveBeenCalled();
    expect(mockUseOpenPaymentClients).not.toHaveBeenCalled();
    act(() => renderer.unmount());
  });

  it('keeps the Wholesale composition when the mode is Wholesale', () => {
    mockAppMode.mode = 'wholesale';
    const renderer = renderDashboard();

    expect(renderer.root.findAll((node) => String(node.type) === 'retail-home')).toHaveLength(0);
    expect(renderer.root.findAll((node) => String(node.type) === 'premium-screen')).toHaveLength(1);
    expect(mockUseDeliveries).toHaveBeenCalledTimes(2);
    expect(mockUseClients).toHaveBeenCalledTimes(1);
    expect(mockUseFactoryPurchases).toHaveBeenCalledTimes(1);
    expect(mockUseOpenPaymentClients).toHaveBeenCalledTimes(1);
    act(() => renderer.unmount());
  });

  it('keeps the wholesale delivery count while removing recent-record presentation from both homes', () => {
    const dashboardSource = readFileSync(
      resolve(process.cwd(), 'src/app/(tabs)/dashboard/index.tsx'),
      'utf8',
    );
    const retailHomeSource = readFileSync(
      resolve(process.cwd(), 'src/features/home/components/RetailHome.tsx'),
      'utf8',
    );
    const retailMetricsSource = readFileSync(
      resolve(process.cwd(), 'src/hooks/useRetailHomeMetrics.ts'),
      'utf8',
    );

    expect(dashboardSource).toContain('dailyDeliveries.length} hoje');
    expect(dashboardSource).not.toContain('TodayDeliveriesCard');
    expect(dashboardSource).not.toContain('homeShortcutIconSurface');
    expect(dashboardSource).toContain('backgroundColor: theme.colors.background');
    expect(retailHomeSource).not.toContain('RetailTodayOrdersCard');
    expect(retailMetricsSource).not.toContain('todayOrders');
    expect(retailMetricsSource).not.toContain('retailOrderDataSource.list');
    expect(
      existsSync(resolve(process.cwd(), 'src/features/home/components/TodayDeliveriesCard.tsx')),
    ).toBe(false);
    expect(
      existsSync(resolve(process.cwd(), 'src/features/home/components/RetailTodayOrdersCard.tsx')),
    ).toBe(false);
  });

  it('renders no domain composition before the stored mode is ready', () => {
    mockAppMode.isReady = false;

    const renderer = renderDashboard();

    expect(renderer.toJSON()).toBeNull();
    expect(mockUseDeliveries).not.toHaveBeenCalled();
    expect(mockUseClients).not.toHaveBeenCalled();
    act(() => renderer.unmount());
  });
});
