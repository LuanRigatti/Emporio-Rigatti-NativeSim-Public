/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ComponentType, type ReactNode } from 'react';

const mockAppMode = { mode: 'wholesale' as 'wholesale' | 'retail' };
const mockCreateElement = (...args: Parameters<typeof createElement>) => createElement(...args);
const mockRetailFinance = jest.fn(() => ({
  categoryOptions: [],
  error: undefined,
  loading: false,
  refreshing: false,
  reload: jest.fn(),
  summary: null,
}));

jest.mock('expo-router', () => ({
  Stack: {
    Toolbar: ({ children }: { children?: ReactNode }) =>
      mockCreateElement('toolbar', null, children),
  },
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('@expo/vector-icons/Ionicons', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/layout', () => ({ NativeGlassHeader: () => null }));
jest.mock('@/components/native', () => ({
  NativeAnimatedNumber: () => null,
  NativeRetailFinanceCategorySelector: () => null,
}));
jest.mock('@/components/Charts', () => ({ FinancialSeriesChart: () => null }));
jest.mock('@/components/premium', () => ({
  GlassSegmentedControl: () => null,
  PremiumCard: ({ children }: { children?: ReactNode }) =>
    mockCreateElement('premium-card', null, children),
  PremiumScreen: ({ children }: { children?: ReactNode }) =>
    mockCreateElement('premium-screen', null, children),
  SummaryCard: () => null,
}));
jest.mock('@/features/finance', () => ({
  FinancialTrendIndicator: () => null,
  renderFinancePeriodToolbarItems: () => null,
}));
jest.mock('@/features/history/utils/historyDateUtils', () => ({
  getCurrentHistoryPeriod: () => ({ month: 9, year: 2026 }),
}));
jest.mock('@/features/history/utils/historyPeriodUtils', () => ({
  getHistoryMonthRange: () => ({ endDate: '2026-09-30', startDate: '2026-09-01' }),
}));
jest.mock('@/hooks/useFinancialData', () => ({
  useFinancialData: () => ({
    comparisonSnapshot: null,
    snapshot: null,
    snapshotScopeKey: undefined,
  }),
}));
jest.mock('@/hooks/useFinancialFuelCosts', () => ({
  useFinancialFuelCosts: () => ({ fuelCostByDate: {}, isReady: false }),
}));
jest.mock('@/hooks/useRetailCategories', () => ({
  useRetailCategories: () => ({ categories: [] }),
}));
jest.mock('@/hooks/useRetailFinance', () => ({ useRetailFinance: mockRetailFinance }));
jest.mock('@/providers', () => ({ useAppMode: () => mockAppMode }));
jest.mock('@/services/costs', () => ({ expenseQueryForFinancialSelection: jest.fn() }));
jest.mock('@/services/finance', () => ({
  financialCalculationService: { calculateResumo: jest.fn(), compareCalendarMonths: jest.fn() },
}));
jest.mock('@/services/routes', () => ({
  routeTrackingRepository: {
    getMemoryRouteHistory: () => [],
    getRouteHistory: jest.fn(async () => []),
  },
  summarizeRouteKilometersByDate: () => ({}),
}));
jest.mock('@/services/retail-finance', () => ({
  retailFinanceCategoryIdFromView: (view: string) =>
    view === 'general' ? undefined : view.slice('category:'.length),
  retailFinanceViewForCategory: (categoryId: string) => `category:${categoryId}`,
}));
jest.mock('@/theme', () => ({
  getCardSurfaceColor: () => '#fff',
  useAppTheme: () => ({
    resolvedMode: 'light',
    theme: {
      colors: { primary: '#000', surface: '#fff', textPrimary: '#000', textSecondary: '#666' },
      radius: { xl: 24 },
      sizes: { iconSmall: 12 },
      spacing: { sm: 8, xl: 20, xxl: 24, xs: 4, xxs: 2, xxxl: 32 },
      typography: { body: {}, caption: {}, footnote: {} },
    },
  }),
}));
jest.mock('@/utils/haptics', () => ({ triggerLightImpactHaptic: jest.fn() }));

const FinanceiroRoute = require('@/app/(tabs)/financeiro/index').default as ComponentType;

describe('Financeiro AppMode routing', () => {
  beforeEach(() => {
    mockAppMode.mode = 'wholesale';
    mockRetailFinance.mockClear();
  });

  function renderRoute(): ReactTestRenderer {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(FinanceiroRoute));
    });
    return renderer;
  }

  it('keeps the Wholesale branch and does not initialize Retail Finance in wholesale mode', () => {
    const renderer = renderRoute();

    expect(renderer.root.findAll((node) => String(node.type) === 'premium-screen')).toHaveLength(1);
    expect(mockRetailFinance).not.toHaveBeenCalled();
  });

  it('initializes only the Retail Finance branch in retail mode', () => {
    mockAppMode.mode = 'retail';
    const renderer = renderRoute();

    expect(mockRetailFinance).toHaveBeenCalledTimes(1);
    expect(renderer.root.findAll((node) => String(node.type) === 'premium-screen')).toHaveLength(1);
  });

  it('switches branches without creating another route entry', () => {
    mockAppMode.mode = 'retail';
    const renderer = renderRoute();
    expect(mockRetailFinance).toHaveBeenCalledTimes(1);

    mockAppMode.mode = 'wholesale';
    act(() => renderer.update(createElement(FinanceiroRoute)));

    expect(mockRetailFinance).toHaveBeenCalledTimes(1);
  });
});
