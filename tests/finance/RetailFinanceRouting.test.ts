/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Children, createElement, type ComponentType, type ReactNode } from 'react';
import type { NativeStackNavigationProp } from 'expo-router';

const mockSetAppMode = jest.fn();
const mockAppMode = {
  isReady: true,
  mode: 'wholesale' as 'wholesale' | 'retail',
  setMode: mockSetAppMode,
};
const mockFinanceRouteParams: { mode?: string | string[] } = {};
const mockRouterSetParams = jest.fn();
const mockAuthState = {
  status: 'authenticated' as 'authenticated' | 'loading' | 'unauthenticated',
  user: { id: 'finance-user' as string | undefined },
  sessionVersion: 1,
};
const mockTestModeState = { enabled: false, isReady: true };
const mockPresentationRecords = new Map<string, Record<string, unknown>>();
const mockFinancialPresentationCache = {
  readWithStatus: jest.fn(async (uid: string, scopeKey: string) => {
    const entry = mockPresentationRecords.get(`${uid}:${scopeKey}`);
    return entry
      ? { status: 'hit' as const, entry }
      : { status: 'miss' as const, reason: 'no_record' as const };
  }),
  writeWithStatus: jest.fn(
    async (
      uid: string,
      scopeKey: string,
      values: Record<string, unknown>,
      canRun: () => boolean = () => true,
    ) => {
      if (!canRun()) return { status: 'skipped' as const, reason: 'stale_context' as const };
      const key = `${uid}:${scopeKey}`;
      const previous = mockPresentationRecords.get(key);
      const entry = {
        cacheVersion: 2,
        rulesVersion: 1,
        environment: 'development',
        firebaseProjectId: 'demo-finance-presentation',
        uid,
        scopeKey,
        ...values,
      };
      if (previous && JSON.stringify(previous) === JSON.stringify(entry)) {
        return { status: 'unchanged' as const };
      }
      mockPresentationRecords.set(key, entry);
      return { status: 'written' as const };
    },
  ),
};
const mockCreateFinancialPresentationScopeKey = jest.fn((selection: unknown, filters: unknown) =>
  JSON.stringify({ filters, selection }),
);
const mockIsFocused = { value: true };
const mockFuelCostsState = { isReady: false };
const mockConnectivityState = {
  value: null as null | {
    isConnected: boolean;
    isInternetReachable: boolean | null;
    type: string;
  },
};
let mockFocusEffectCallback: (() => void | (() => void)) | undefined;
const mockUseFocusEffect = jest.fn((callback: () => void | (() => void)) => {
  mockFocusEffectCallback = callback;
});
const mockGetFinancialRouteSummaries = jest.fn(async () => []);
const mockGetMemoryFinancialRouteSummaries = jest.fn((): never[] | null => null);
const mockCreateElement = (
  type: string,
  props: Record<string, unknown> | null,
  ...children: ReactNode[]
) => createElement(type, props as never, ...children);
const mockToolbar = Object.assign(
  ({ children }: { children?: ReactNode }) => mockCreateElement('toolbar', null, children),
  {
    Button: ({ children }: { children?: ReactNode }) =>
      mockCreateElement('toolbar-button', null, children),
    Label: ({ children }: { children?: ReactNode }) =>
      mockCreateElement('toolbar-label', null, children),
  },
);
const mockRetailFinanceState: {
  categoryOptions: never[];
  error: string | undefined;
  loading: boolean;
  refreshing: boolean;
  reload: jest.Mock;
  summary: Record<string, unknown> | null;
} = {
  categoryOptions: [],
  error: undefined,
  loading: false,
  refreshing: false,
  reload: jest.fn(),
  summary: null,
};
const mockRetailFinance = jest.fn(() => mockRetailFinanceState);
const mockNativePeriodSelector = jest.fn(
  ({
    contentLeadingPadding,
    contentTrailingPadding,
    fillAvailableWidth,
    items,
    itemHorizontalPadding,
    itemSpacing,
    onChange,
    selectionAnimationMode,
    selectedKey,
  }: {
    items: readonly { key: string; label: string }[];
    onChange: (key: string) => void;
    selectedKey: string;
    contentLeadingPadding?: number;
    contentTrailingPadding?: number;
    fillAvailableWidth?: boolean;
    itemHorizontalPadding?: number;
    itemSpacing?: number;
    selectionAnimationMode?: 'native' | 'slidingBubble';
  }) =>
    mockCreateElement('period-selector', {
      contentLeadingPadding,
      contentTrailingPadding,
      fillAvailableWidth,
      items,
      itemHorizontalPadding,
      itemSpacing,
      onChange,
      selectionAnimationMode,
      selectedKey,
    }),
);
const mockRenderNativeDateToolbarItems = jest.fn(() => null);
const mockRenderFinancePeriodToolbarItems = jest.fn(() => null);
const mockFinancialDataState: {
  comparisonSnapshot: unknown;
  coverage: {
    remoteComplete: boolean;
    requestScopeKey?: string;
    routesCoverage: 'not-loaded' | 'local-only';
    source: 'none' | 'cache' | 'remote' | 'local';
  };
  error: string | undefined;
  hasPreviouslyConfirmedSnapshot: boolean;
  loading: boolean;
  refreshing: boolean;
  reload: jest.Mock;
  remoteComplete: boolean;
  requestScopeKey: string;
  routesCoverage: 'not-loaded' | 'local-only';
  snapshot: unknown;
  snapshotScopeKey: string | undefined;
  snapshotSessionScopeKey: string | undefined;
} = {
  comparisonSnapshot: null as unknown,
  coverage: { remoteComplete: false, routesCoverage: 'not-loaded', source: 'none' },
  error: undefined as string | undefined,
  hasPreviouslyConfirmedSnapshot: false,
  loading: false,
  refreshing: false,
  reload: jest.fn(),
  remoteComplete: false,
  requestScopeKey: 'same-session-month-query',
  routesCoverage: 'not-loaded',
  snapshot: null as unknown,
  snapshotScopeKey: undefined as string | undefined,
  snapshotSessionScopeKey: undefined as string | undefined,
};
const mockFinancialData = jest.fn(() => mockFinancialDataState);
const mockRouterNavigate = jest.fn();

function createNavigationMock() {
  const listeners = new Map<string, Set<(event: { data?: { closing: boolean } }) => void>>();
  const state = { index: 0, routes: [{ name: '(tabs)' }] };
  return {
    addListener: (event: string, listener: (event: { data?: { closing: boolean } }) => void) => {
      const subscribers = listeners.get(event) ?? new Set<typeof listener>();
      subscribers.add(listener);
      listeners.set(event, subscribers);
      return () => subscribers.delete(listener);
    },
    emit: (event: string, closing?: boolean) => {
      for (const listener of listeners.get(event) ?? []) {
        listener({ data: closing === undefined ? undefined : { closing } });
      }
    },
    setChart: (name?: string) => {
      state.routes = name ? [{ name: '(tabs)' }, { name }] : [{ name: '(tabs)' }];
      state.index = state.routes.length - 1;
    },
    getState: () => state,
    getParent: () => ({ getState: () => ({ index: 0, routes: [mockSelectedTab] }) }),
    isFocused: () => mockIsFocused.value,
  };
}

let mockFinanceNavigation: ReturnType<typeof createNavigationMock>;
let mockRootNavigation: ReturnType<typeof createNavigationMock>;
const mockSelectedTab = { name: 'financeiro' };
const mockCalculateResumo = jest.fn();
const mockCompareCalendarMonths = jest.fn();
const mockWholesaleSnapshot = {
  clientesCustom: {},
  entregas: [],
  gastosDiarios: {},
  gastosMensais: {},
  recebimentoBaldes: [],
};
const mockWholesaleSummary = {
  custoCombustivel: 10,
  custoEstar: 0,
  custoLuz: 0,
  custoMedioBalde: 20,
  custoMedioCombustivelPorEntrega: 10,
  custoOutros: 0,
  custoTotal: 30,
  custoTotalBaldes: 20,
  faturamento: 100,
  lucroBruto: 80,
  lucroLiquido: 50,
  lucroLiquidoPorBalde: 10,
  margemBruta: 80,
  margemLiquida: 50,
  quantidadeBaldes: 2,
  quantidadeEntregas: 1,
  precoMedioBalde: 50,
  valoresPagos: 100,
  valoresPendentes: 0,
};
const mockExpenseQueryForWholesaleFinanceSelection = jest.fn(
  (selection: {
    kind: string;
    date?: string;
    endDate?: string;
    month?: string;
    startDate?: string;
  }) => {
    if (selection.kind === 'day') return { date: selection.date };
    if (selection.kind === 'week') {
      return { endDate: selection.endDate, startDate: selection.startDate };
    }
    if (selection.kind === 'all') return { loadAll: true };
    return { startDate: '2026-09-01', endDate: '2026-09-30' };
  },
);

jest.mock('expo-router', () => ({
  router: { setParams: mockRouterSetParams },
  Stack: {
    Toolbar: mockToolbar,
  },
  useFocusEffect: mockUseFocusEffect,
  useIsFocused: () => mockIsFocused.value,
  useLocalSearchParams: () => mockFinanceRouteParams,
  useNavigation: (path?: string) => (path === '/' ? mockRootNavigation : mockFinanceNavigation),
  useRouter: () => ({ navigate: mockRouterNavigate }),
}));
jest.mock('@expo/vector-icons/Ionicons', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/layout', () => ({ NativeGlassHeader: () => null }));
jest.mock('@/components/native', () => ({
  NativeAnimatedNumber: (props: Record<string, unknown>) =>
    mockCreateElement('native-animated-number', props),
  NativeRetailFinanceCategorySelector: mockNativePeriodSelector,
  renderNativeDateToolbarItems: mockRenderNativeDateToolbarItems,
}));
jest.mock('@/components/Charts', () => ({ FinancialSeriesChart: () => null }));
jest.mock('@/components/premium', () => ({
  GlassSegmentedControl: () => null,
  PremiumCard: ({
    accessibilityLabel,
    children,
    onPress,
    preservePressableIdentity,
    style,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    onPress?: () => void;
    preservePressableIdentity?: boolean;
    style?: unknown;
  }) =>
    mockCreateElement(
      onPress || preservePressableIdentity ? 'premium-card-pressable' : 'premium-card-static',
      { accessibilityLabel, onPress, preservePressableIdentity, style },
      children,
    ),
  PremiumScreen: ({ children }: { children?: ReactNode }) =>
    mockCreateElement('premium-screen', null, children),
  ProgressiveCollapsibleScreen: ({
    children,
    largeTitle,
  }: {
    children?: ReactNode;
    largeTitle?: ReactNode;
  }) => mockCreateElement('premium-screen', null, largeTitle, children),
  SummaryCard: ({
    rows,
    title,
  }: {
    rows: readonly { label: string; value: string }[];
    title: string;
  }) => mockCreateElement('summary-card', { rows, title }),
}));
jest.mock('@/features/finance', () => ({
  FinancialTrendIndicator: (props: Record<string, unknown>) =>
    mockCreateElement('financial-trend-indicator', props),
  renderFinancePeriodToolbarItems: mockRenderFinancePeriodToolbarItems,
}));
jest.mock('@/features/history/utils/historyDateUtils', () => ({
  getCurrentHistoryPeriod: () => ({ month: 9, year: 2026 }),
}));
jest.mock('@/features/history/utils/historyPeriodUtils', () => ({
  createHistoryWeekGroups: () => [],
  getHistoryMonthRange: () => ({ endDate: '2026-09-30', startDate: '2026-09-01' }),
  getHistoryWeekRange: (date: string) => ({ endDate: date, startDate: date }),
}));
jest.mock('@/hooks/useFinancialData', () => ({
  useFinancialData: mockFinancialData,
}));
jest.mock('@/hooks/useConnectivity', () => ({
  useConnectivity: () => mockConnectivityState.value,
}));
jest.mock('@/hooks/useFinancialFuelCosts', () => ({
  useFinancialFuelCosts: () => ({
    fuelCostByDate: {},
    isReady: mockFuelCostsState.isReady,
  }),
}));
jest.mock('@/hooks/useRetailCategories', () => ({
  useRetailCategories: () => ({ categories: [] }),
}));
jest.mock('@/hooks/useRetailFinance', () => ({ useRetailFinance: mockRetailFinance }));
jest.mock('@/providers', () => ({
  useAppMode: () => mockAppMode,
  useAppSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 59 }),
  useAuth: () => mockAuthState,
  useTestMode: () => mockTestModeState,
}));
jest.mock('@/services/costs', () => ({
  expenseQueryForFinancialSelection: jest.fn(),
  expenseQueryForWholesaleFinanceSelection: mockExpenseQueryForWholesaleFinanceSelection,
}));
jest.mock('@/services/finance', () => ({
  createFinancialPresentationScopeKey: mockCreateFinancialPresentationScopeKey,
  FINANCIAL_PRESENTATION_SUMMARY_FIELDS: [
    'quantidadeBaldes',
    'lucroBruto',
    'valoresPagos',
    'valoresPendentes',
    'custoTotalBaldes',
    'custoCombustivel',
    'custoOutros',
    'custoLuz',
    'custoMedioCombustivelPorEntrega',
    'margemBruta',
    'margemLiquida',
    'precoMedioBalde',
    'lucroLiquidoPorBalde',
    'custoMedioBalde',
  ],
  financialCalculationService: {
    calculateResumo: mockCalculateResumo,
    compareCalendarMonths: mockCompareCalendarMonths,
  },
  formatWholesaleFinancePeriodLabel: jest.fn(() => 'Todo o histórico'),
  financialPresentationCache: mockFinancialPresentationCache,
  wholesaleFinanceFiltersForSelection: jest.fn((selection) =>
    selection.kind === 'month'
      ? { mesSelecionado: selection.month, periodo: 'mes' }
      : selection.kind === 'day'
        ? { diaSelecionado: selection.date, periodo: 'dia' }
        : selection.kind === 'week'
          ? {
              dataFimSelecionada: selection.endDate,
              dataInicioSelecionada: selection.startDate,
              periodo: 'range',
            }
          : { periodo: 'todos' },
  ),
}));
jest.mock('@/services/routes', () => ({
  locationTrackingService: {
    getFinancialRouteSummaries: mockGetFinancialRouteSummaries,
    getMemoryFinancialRouteSummaries: mockGetMemoryFinancialRouteSummaries,
  },
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
jest.mock('@/services/auth/ActiveAuthSession', () => ({
  isActiveAuthSession: () => true,
}));
jest.mock('@/theme', () => ({
  getCardSurfaceColor: () => '#fff',
  useAppTheme: () => ({
    resolvedMode: 'light',
    theme: {
      colors: { primary: '#000', surface: '#fff', textPrimary: '#000', textSecondary: '#666' },
      layout: { tabBarHeight: 80 },
      radius: { xl: 24 },
      sizes: { iconSmall: 12 },
      spacing: { lg: 20, md: 16, sm: 8, xl: 20, xxl: 24, xs: 4, xxs: 2, xxxl: 32 },
      typography: { body: {}, caption: {}, footnote: {} },
    },
  }),
}));
jest.mock('@/utils/haptics', () => ({ triggerLightImpactHaptic: jest.fn() }));

const FinanceiroRoute = require('@/app/(tabs)/financeiro/index').default as ComponentType;
const { observeRootTabsTransition } =
  require('@/utils/navigation/rootTabsTransition') as typeof import('@/utils/navigation/rootTabsTransition');
const { cancelPendingReturnIntentsForGestureCancelledRoute } =
  require('@/utils/navigation/usePendingReturnNavigationIntent') as typeof import('@/utils/navigation/usePendingReturnNavigationIntent');

describe('Financeiro AppMode routing', () => {
  beforeEach(() => {
    mockAuthState.status = 'authenticated';
    mockAuthState.user = { id: 'finance-user' };
    mockAuthState.sessionVersion = 1;
    mockTestModeState.enabled = false;
    mockTestModeState.isReady = true;
    mockPresentationRecords.clear();
    mockFinancialPresentationCache.readWithStatus.mockClear();
    mockFinancialPresentationCache.writeWithStatus.mockClear();
    mockAppMode.mode = 'wholesale';
    mockAppMode.isReady = true;
    mockFinanceRouteParams.mode = undefined;
    mockIsFocused.value = true;
    mockFuelCostsState.isReady = false;
    mockConnectivityState.value = null;
    mockFocusEffectCallback = undefined;
    mockUseFocusEffect.mockClear();
    mockGetFinancialRouteSummaries.mockReset().mockResolvedValue([]);
    mockGetMemoryFinancialRouteSummaries.mockReset().mockReturnValue(null);
    mockRetailFinanceState.error = undefined;
    mockRetailFinanceState.loading = false;
    mockRetailFinanceState.refreshing = false;
    mockRetailFinanceState.summary = null;
    mockFinancialDataState.comparisonSnapshot = null;
    mockFinancialDataState.coverage = {
      remoteComplete: false,
      routesCoverage: 'not-loaded',
      source: 'none',
    };
    mockFinancialDataState.error = undefined;
    mockFinancialDataState.hasPreviouslyConfirmedSnapshot = false;
    mockFinancialDataState.loading = false;
    mockFinancialDataState.refreshing = false;
    mockFinancialDataState.reload.mockReset();
    mockFinancialDataState.remoteComplete = false;
    mockFinancialDataState.requestScopeKey = 'same-session-month-query';
    mockFinancialDataState.routesCoverage = 'not-loaded';
    mockFinancialDataState.snapshot = null;
    mockFinancialDataState.snapshotScopeKey = undefined;
    mockFinancialDataState.snapshotSessionScopeKey = undefined;
    mockRetailFinance.mockClear();
    mockNativePeriodSelector.mockClear();
    mockRenderNativeDateToolbarItems.mockClear();
    mockRenderFinancePeriodToolbarItems.mockClear();
    mockFinancialData.mockClear();
    mockExpenseQueryForWholesaleFinanceSelection.mockClear();
    mockRouterNavigate.mockClear();
    mockFinanceNavigation = createNavigationMock();
    mockRootNavigation = createNavigationMock();
    mockSelectedTab.name = 'financeiro';
    mockRouterSetParams.mockClear();
    mockSetAppMode.mockClear();
    mockCalculateResumo.mockReset();
    mockCompareCalendarMonths.mockReset();
  });

  function renderRoute(): ReactTestRenderer {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(FinanceiroRoute));
    });
    return renderer;
  }

  function setLiveWholesaleFinanceState(summary = mockWholesaleSummary) {
    mockIsFocused.value = true;
    mockConnectivityState.value = null;
    mockFuelCostsState.isReady = true;
    mockGetMemoryFinancialRouteSummaries.mockReturnValue([]);
    mockFinancialDataState.snapshot = mockWholesaleSnapshot;
    mockFinancialDataState.comparisonSnapshot = mockWholesaleSnapshot;
    mockFinancialDataState.snapshotScopeKey = '2026-09';
    mockFinancialDataState.snapshotSessionScopeKey = 'finance-session-1';
    mockFinancialDataState.coverage = {
      remoteComplete: true,
      requestScopeKey: 'same-session-month-query',
      routesCoverage: 'not-loaded',
      source: 'remote',
    };
    mockFinancialDataState.error = undefined;
    mockFinancialDataState.hasPreviouslyConfirmedSnapshot = true;
    mockFinancialDataState.loading = false;
    mockFinancialDataState.refreshing = false;
    mockFinancialDataState.remoteComplete = true;
    mockFinancialDataState.requestScopeKey = 'same-session-month-query';
    mockFinancialDataState.routesCoverage = 'not-loaded';
    mockCalculateResumo.mockReturnValue(summary);
    mockCompareCalendarMonths.mockReturnValue({
      faturamento: {
        atual: summary.faturamento,
        anterior: summary.faturamento - 10,
        diferenca: 10,
        percentual: 1,
        subiu: true,
      },
      lucroLiquido: {
        atual: summary.lucroLiquido,
        anterior: summary.lucroLiquido - 5,
        diferenca: 5,
        percentual: 10,
        subiu: true,
      },
    });
  }

  function findWholesalePeriodSelector(renderer: ReactTestRenderer) {
    const selector = renderer.root.findAll((node) => String(node.type) === 'period-selector')[0];
    if (!selector) throw new Error('Seletor de período não encontrado.');
    return selector;
  }

  async function renderWholesaleCharts() {
    mockFuelCostsState.isReady = true;
    mockFinancialDataState.snapshot = mockWholesaleSnapshot;
    mockFinancialDataState.snapshotScopeKey = '2026-09';
    mockCalculateResumo.mockReturnValue(mockWholesaleSummary);
    const renderer = renderRoute();
    await act(async () => {
      mockFocusEffectCallback?.();
      await Promise.resolve();
    });
    return renderer;
  }

  const chartCards = [
    ['Abrir detalhes do faturamento', 'faturamento-mensal'],
    ['Abrir detalhes do lucro líquido', 'lucro-liquido-mensal'],
  ] as const;

  function pressChart(renderer: ReactTestRenderer, label: string) {
    renderer.root
      .find(
        (node) =>
          String(node.type) === 'premium-card-pressable' && node.props.accessibilityLabel === label,
      )
      .props.onPress();
  }

  function showChart(name: string) {
    mockRootNavigation.setChart(name);
    mockRootNavigation.emit('state');
    mockIsFocused.value = false;
    mockFinanceNavigation.emit('blur');
  }

  function focusFinance() {
    mockRootNavigation.setChart();
    mockRootNavigation.emit('state');
    mockIsFocused.value = true;
    mockFinanceNavigation.emit('focus');
  }

  function observeFinanceReturn() {
    return observeRootTabsTransition(
      mockRootNavigation as unknown as NativeStackNavigationProp<
        Record<string, object | undefined>
      >,
    );
  }

  it.each(chartCards)(
    'opens %s only once per opening, including during a native return',
    async (label, route) => {
      const renderer = await renderWholesaleCharts();
      const stopObserving = observeFinanceReturn();
      try {
        act(() => {
          for (let tap = 0; tap < 5; tap++) pressChart(renderer, label);
        });
        const href = { pathname: `/${route}`, params: { period: '2026-09' } };
        expect(mockRouterNavigate.mock.calls).toEqual([[href]]);

        act(() => {
          showChart(route);
          pressChart(renderer, label);
          mockRootNavigation.emit('transitionStart', false);
          for (let tap = 0; tap < 5; tap++) pressChart(renderer, label);
          focusFinance();
          pressChart(renderer, label);
        });
        expect(mockRouterNavigate).toHaveBeenCalledTimes(1);

        act(() => {
          mockRootNavigation.emit('transitionEnd', false);
          pressChart(renderer, label);
        });
        expect(mockRouterNavigate.mock.calls).toEqual([[href], [href]]);
      } finally {
        act(() => renderer.unmount());
        stopObserving();
      }
    },
  );

  it.each(chartCards)(
    'discards a pending %s tap when the chart cancels the return gesture',
    async (label, route) => {
      const renderer = await renderWholesaleCharts();
      const stopObserving = observeFinanceReturn();
      try {
        act(() => {
          pressChart(renderer, label);
          showChart(route);
          mockRootNavigation.emit('transitionStart', false);
          pressChart(renderer, label);
          cancelPendingReturnIntentsForGestureCancelledRoute(route);
          pressChart(renderer, label);
        });
        expect(mockRouterNavigate).toHaveBeenCalledTimes(1);

        act(() => {
          mockRootNavigation.emit('transitionStart', false);
          mockRootNavigation.emit('transitionEnd', false);
          focusFinance();
        });
        expect(mockRouterNavigate).toHaveBeenCalledTimes(1);

        act(() => pressChart(renderer, label));
        expect(mockRouterNavigate).toHaveBeenCalledTimes(2);
      } finally {
        act(() => renderer.unmount());
        stopObserving();
      }
    },
  );

  it('accepts the other chart on the first tap after returning and ignores competing taps while opening', async () => {
    const renderer = await renderWholesaleCharts();
    try {
      const [revenue, netProfit] = chartCards;
      act(() => {
        pressChart(renderer, revenue[0]);
        pressChart(renderer, netProfit[0]);
        showChart(revenue[1]);
        focusFinance();
        pressChart(renderer, netProfit[0]);
        pressChart(renderer, revenue[0]);
      });
      expect(mockRouterNavigate.mock.calls).toEqual([
        [{ pathname: '/faturamento-mensal', params: { period: '2026-09' } }],
        [{ pathname: '/lucro-liquido-mensal', params: { period: '2026-09' } }],
      ]);
    } finally {
      act(() => renderer.unmount());
    }
  });

  it('ignores a late chart tap delivered after another tab is selected', async () => {
    const renderer = await renderWholesaleCharts();
    const stopObserving = observeFinanceReturn();
    try {
      const [revenue] = chartCards;
      act(() => {
        pressChart(renderer, revenue[0]);
        showChart(revenue[1]);
        mockRootNavigation.emit('transitionStart', false);
        focusFinance();
        mockRootNavigation.emit('transitionEnd', false);

        mockSelectedTab.name = 'dashboard';
        mockIsFocused.value = false;
        mockFinanceNavigation.emit('blur');
        pressChart(renderer, revenue[0]);

        mockSelectedTab.name = 'financeiro';
        focusFinance();
      });
      expect(mockRouterNavigate).toHaveBeenCalledTimes(1);

      act(() => pressChart(renderer, revenue[0]));
      expect(mockRouterNavigate).toHaveBeenCalledTimes(2);
    } finally {
      act(() => renderer.unmount());
      stopObserving();
    }
  });

  function hasRenderedText(renderer: ReactTestRenderer, value: string): boolean {
    return (
      renderer.root.findAll((node) => {
        const text = String(node.props.children ?? '');
        return String(node.type) === 'Text' && text.includes(value);
      }).length > 0
    );
  }

  it('keeps the Wholesale branch and does not initialize Retail Finance in wholesale mode', () => {
    const renderer = renderRoute();

    expect(renderer.root.findAll((node) => String(node.type) === 'premium-screen')).toHaveLength(1);
    expect(mockRetailFinance).not.toHaveBeenCalled();
  });

  it.each(['wholesale', 'retail'] as const)(
    'applies and consumes the %s mode from the widget deep link',
    (requestedMode) => {
      mockAppMode.mode = requestedMode === 'retail' ? 'wholesale' : 'retail';
      mockFinanceRouteParams.mode = requestedMode;

      const renderer = renderRoute();
      expect(mockSetAppMode).toHaveBeenCalledWith(requestedMode);

      act(() => {
        mockAppMode.mode = requestedMode;
        renderer.update(createElement(FinanceiroRoute));
      });

      expect(mockRouterSetParams).toHaveBeenCalledWith({ mode: undefined });
    },
  );

  it('renders the Wholesale period selector in the canonical order with month selected', () => {
    const renderer = renderRoute();
    const selector = findWholesalePeriodSelector(renderer);

    expect(selector.props.items).toEqual([
      { key: 'month', label: 'Mensal' },
      { key: 'day', label: 'Diário' },
      { key: 'week', label: 'Semanal' },
      { key: 'all', label: 'Total' },
    ]);
    expect(selector.props.selectedKey).toBe('month');
    expect(selector.props.contentLeadingPadding).toBeUndefined();
    expect(selector.props.contentTrailingPadding).toBeUndefined();
    expect(selector.props.fillAvailableWidth).toBe(true);
    expect(selector.props.selectionAnimationMode).toBe('slidingBubble');
    expect(selector.props.itemSpacing).toBeUndefined();
    expect(selector.props).not.toHaveProperty('selectedVisualScale');
    expect(mockExpenseQueryForWholesaleFinanceSelection).toHaveBeenCalledWith({
      kind: 'month',
      month: '2026-09',
    });
  });

  it('writes and restores every finance card before remote data completes, then replaces the panel together', async () => {
    setLiveWholesaleFinanceState();
    const firstProcessRenderer = renderRoute();
    await act(async () => {
      mockFocusEffectCallback?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockPresentationRecords.size).toBe(1);
    expect([...mockPresentationRecords.values()][0]).toMatchObject({
      faturamento: mockWholesaleSummary.faturamento,
      lucroLiquido: mockWholesaleSummary.lucroLiquido,
      summary: {
        quantidadeBaldes: mockWholesaleSummary.quantidadeBaldes,
        lucroBruto: mockWholesaleSummary.lucroBruto,
        margemLiquida: mockWholesaleSummary.margemLiquida,
      },
    });
    act(() => firstProcessRenderer.unmount());

    mockFinancialDataState.snapshot = null;
    mockFinancialDataState.comparisonSnapshot = null;
    mockFinancialDataState.snapshotScopeKey = undefined;
    mockFinancialDataState.snapshotSessionScopeKey = undefined;
    mockFinancialDataState.coverage = {
      remoteComplete: false,
      routesCoverage: 'not-loaded',
      source: 'none',
    };
    mockFinancialDataState.error = undefined;
    mockFinancialDataState.hasPreviouslyConfirmedSnapshot = false;
    mockFinancialDataState.loading = true;
    mockFinancialDataState.refreshing = false;
    mockFinancialDataState.remoteComplete = false;
    mockFuelCostsState.isReady = false;
    mockCalculateResumo.mockReturnValue(undefined);
    mockIsFocused.value = false;
    mockConnectivityState.value = {
      isConnected: false,
      isInternetReachable: false,
      type: 'none',
    };

    const reopenedRenderer = renderRoute();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const restoredNumbers = reopenedRenderer.root.findAll(
      (node) => String(node.type) === 'native-animated-number',
    );
    expect(restoredNumbers.map((node) => node.props.value)).toEqual([
      mockWholesaleSummary.faturamento,
      mockWholesaleSummary.lucroLiquido,
    ]);
    expect(
      reopenedRenderer.root.findAll((node) => String(node.type) === 'premium-card-pressable'),
    ).toHaveLength(2);
    expect(
      reopenedRenderer.root.findAll((node) => String(node.type) === 'summary-card'),
    ).toHaveLength(4);
    expect(
      reopenedRenderer.root.findAll(
        (node) => node.props.children === 'Carregando Finanças Atacado...',
      ),
    ).toHaveLength(0);
    expect(mockFinancialDataState.remoteComplete).toBe(false);
    expect(mockFinancialPresentationCache.readWithStatus).toHaveBeenCalled();
    expect(mockFinancialData).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ enabled: false }),
    );
    const restoredTrends = reopenedRenderer.root.findAll(
      (node) => String(node.type) === 'financial-trend-indicator',
    );
    expect(restoredTrends).toHaveLength(2);
    expect(restoredTrends.every((node) => node.props.visible === true)).toBe(true);

    mockFinancialDataState.error = 'synthetic remote failure';
    act(() => reopenedRenderer.update(createElement(FinanceiroRoute)));
    expect(
      reopenedRenderer.root.findAll((node) => String(node.type) === 'summary-card'),
    ).toHaveLength(4);
    expect(restoredNumbers.map((node) => node.props.value)).toEqual([
      mockWholesaleSummary.faturamento,
      mockWholesaleSummary.lucroLiquido,
    ]);
    mockFinancialDataState.error = undefined;
    act(() => reopenedRenderer.update(createElement(FinanceiroRoute)));

    let periodSelector = findWholesalePeriodSelector(reopenedRenderer);
    act(() => periodSelector.props.onChange('day'));
    expect(
      reopenedRenderer.root
        .findAll((node) => String(node.type) === 'native-animated-number')
        .map((node) => node.props.value),
    ).toEqual([]);
    periodSelector = findWholesalePeriodSelector(reopenedRenderer);
    act(() => periodSelector.props.onChange('month'));
    expect(
      reopenedRenderer.root
        .findAll((node) => String(node.type) === 'native-animated-number')
        .map((node) => node.props.value),
    ).toEqual([mockWholesaleSummary.faturamento, mockWholesaleSummary.lucroLiquido]);
    const restoredProfitNumber = reopenedRenderer.root.findAll(
      (node) => String(node.type) === 'native-animated-number',
    )[1];

    setLiveWholesaleFinanceState({ ...mockWholesaleSummary });
    act(() => reopenedRenderer.update(createElement(FinanceiroRoute)));
    expect(
      reopenedRenderer.root
        .findAll((node) => String(node.type) === 'native-animated-number')
        .map((node) => node.props.value),
    ).toEqual([mockWholesaleSummary.faturamento, mockWholesaleSummary.lucroLiquido]);
    expect(
      reopenedRenderer.root.findAll((node) => String(node.type) === 'native-animated-number')[1],
    ).toBe(restoredProfitNumber);
    expect(
      reopenedRenderer.root.findAll((node) => String(node.type) === 'summary-card'),
    ).toHaveLength(4);

    const changedLiveSummary = {
      ...mockWholesaleSummary,
      faturamento: 2100,
      lucroLiquido: 600,
      lucroBruto: 900,
      margemLiquida: 28.6,
    };
    setLiveWholesaleFinanceState(changedLiveSummary);
    act(() => reopenedRenderer.update(createElement(FinanceiroRoute)));
    expect(
      reopenedRenderer.root
        .findAll((node) => String(node.type) === 'native-animated-number')
        .map((node) => node.props.value),
    ).toEqual([2100, 600]);
    expect(
      reopenedRenderer.root.findAll((node) => String(node.type) === 'native-animated-number')[1],
    ).toBe(restoredProfitNumber);
    const updatedSummaryCards = reopenedRenderer.root.findAll(
      (node) => String(node.type) === 'summary-card',
    );
    expect(updatedSummaryCards).toHaveLength(4);
    const updatedOperationRows = updatedSummaryCards.find((node) => node.props.title === 'OPERAÇÃO')
      ?.props.rows as { label: string; value: string }[];
    expect(updatedOperationRows.find((row) => row.label === 'Lucro bruto')?.value).toContain('900');

    mockFinancialDataState.snapshot = null;
    mockFinancialDataState.comparisonSnapshot = null;
    mockFinancialDataState.snapshotScopeKey = undefined;
    mockFinancialDataState.snapshotSessionScopeKey = undefined;
    mockFinancialDataState.coverage = {
      remoteComplete: false,
      routesCoverage: 'not-loaded',
      source: 'none',
    };
    mockFinancialDataState.error = undefined;
    mockFinancialDataState.loading = true;
    mockFinancialDataState.remoteComplete = false;
    mockAuthState.user = { id: 'finance-user-b' };
    mockAuthState.sessionVersion = 2;
    act(() => reopenedRenderer.update(createElement(FinanceiroRoute)));
    expect(
      reopenedRenderer.root
        .findAll((node) => String(node.type) === 'native-animated-number')
        .map((node) => node.props.value),
    ).toEqual([]);
    act(() => reopenedRenderer.unmount());
  });

  it('resets route readiness on a direct account change before writing the next presentation', async () => {
    setLiveWholesaleFinanceState();
    const renderer = renderRoute();
    const firstSessionRouteLoad = mockFocusEffectCallback;

    expect(firstSessionRouteLoad).toBeDefined();
    mockFinancialPresentationCache.writeWithStatus.mockClear();

    mockAuthState.user = { id: 'finance-user-b' };
    mockAuthState.sessionVersion = 2;
    mockGetMemoryFinancialRouteSummaries.mockReturnValue(null);
    mockFinancialDataState.snapshotSessionScopeKey = 'finance-user-b:2';
    mockFinancialDataState.snapshotScopeKey = '2026-09';
    mockFinancialDataState.coverage = {
      remoteComplete: true,
      requestScopeKey: 'same-session-month-query',
      routesCoverage: 'not-loaded',
      source: 'remote',
    };
    mockFinancialDataState.remoteComplete = true;
    mockFinancialDataState.loading = false;
    mockFinancialDataState.refreshing = false;
    mockFinancialDataState.error = undefined;
    mockFuelCostsState.isReady = true;
    mockCalculateResumo.mockReturnValue({
      ...mockWholesaleSummary,
      faturamento: 2100,
      lucroLiquido: 600,
    });

    act(() => renderer.update(createElement(FinanceiroRoute)));

    expect(mockFocusEffectCallback).toBeDefined();
    expect(mockFocusEffectCallback).not.toBe(firstSessionRouteLoad);
    expect(mockFinancialPresentationCache.writeWithStatus).not.toHaveBeenCalled();
    expect(
      renderer.root
        .findAll((node) => String(node.type) === 'native-animated-number')
        .map((node) => node.props.value),
    ).not.toContain(mockWholesaleSummary.lucroLiquido);

    const nextSessionRouteLoad = mockFocusEffectCallback;
    mockGetFinancialRouteSummaries.mockResolvedValue([]);
    await act(async () => {
      nextSessionRouteLoad?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockFinancialPresentationCache.writeWithStatus).toHaveBeenCalledWith(
      'finance-user-b',
      expect.any(String),
      expect.objectContaining({ faturamento: 2100, lucroLiquido: 600 }),
      expect.any(Function),
    );
    act(() => renderer.unmount());
  });

  it('keeps the previous Wholesale cards visible while the next period revalidates', () => {
    mockFuelCostsState.isReady = true;
    mockFinancialDataState.snapshot = {
      clientesCustom: {},
      entregas: [],
      gastosDiarios: {},
      gastosMensais: {},
      recebimentoBaldes: [],
    };
    mockFinancialDataState.snapshotScopeKey = '2026-09';
    mockFinancialDataState.snapshotSessionScopeKey = 'firebase-user:1';
    mockFinancialDataState.coverage = {
      remoteComplete: true,
      requestScopeKey: '2026-09-request',
      routesCoverage: 'not-loaded',
      source: 'remote',
    };
    mockFinancialDataState.remoteComplete = true;
    mockFinancialDataState.hasPreviouslyConfirmedSnapshot = true;
    mockCalculateResumo.mockReturnValue({
      faturamento: 100,
      lucroLiquido: 50,
      margemBruta: 0,
      margemLiquida: 0,
    });

    const renderer = renderRoute();
    expect(
      renderer.root.findAll((node) =>
        ['premium-card-pressable', 'premium-card-static'].includes(String(node.type)),
      ),
    ).toHaveLength(2);

    mockFinancialDataState.loading = true;
    const selector = findWholesalePeriodSelector(renderer);
    act(() => selector.props.onChange('week'));

    expect(
      renderer.root.findAll((node) => node.props.children === 'Carregando Finanças Atacado...'),
    ).toHaveLength(0);
    expect(
      renderer.root.findAll((node) =>
        ['premium-card-pressable', 'premium-card-static'].includes(String(node.type)),
      ),
    ).toHaveLength(2);
  });

  it('keeps the same-session confirmed net profit visible during offline revalidation', async () => {
    mockFuelCostsState.isReady = true;
    mockFinancialDataState.snapshot = mockWholesaleSnapshot;
    mockFinancialDataState.snapshotScopeKey = '2026-09';
    mockFinancialDataState.snapshotSessionScopeKey = 'firebase-user:1';
    mockFinancialDataState.coverage = {
      remoteComplete: true,
      requestScopeKey: 'same-session-month-query',
      routesCoverage: 'not-loaded',
      source: 'remote',
    };
    mockFinancialDataState.remoteComplete = true;
    mockFinancialDataState.hasPreviouslyConfirmedSnapshot = true;
    mockCalculateResumo.mockReturnValue(mockWholesaleSummary);

    const renderer = renderRoute();
    await act(async () => {
      mockFocusEffectCallback?.();
      await Promise.resolve();
    });
    expect(
      renderer.root
        .findAll((node) => String(node.type) === 'native-animated-number')
        .some((node) => node.props.value === 50),
    ).toBe(true);

    mockFinancialDataState.coverage = {
      remoteComplete: false,
      requestScopeKey: 'same-session-month-query',
      routesCoverage: 'not-loaded',
      source: 'cache',
    };
    mockFinancialDataState.remoteComplete = false;
    mockFinancialDataState.refreshing = true;
    mockConnectivityState.value = {
      isConnected: false,
      isInternetReachable: false,
      type: 'none',
    };
    act(() => renderer.update(createElement(FinanceiroRoute)));

    expect(
      renderer.root
        .findAll((node) => String(node.type) === 'native-animated-number')
        .some((node) => node.props.value === 50),
    ).toBe(true);
    expect(hasRenderedText(renderer, 'Sem conexão. Exibindo o último resultado confirmado.')).toBe(
      false,
    );

    mockFinancialDataState.reload.mockClear();
    mockConnectivityState.value = {
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
    };
    act(() => renderer.update(createElement(FinanceiroRoute)));
    expect(mockFinancialDataState.reload).not.toHaveBeenCalled();

    mockFinancialDataState.refreshing = false;
    mockFinancialDataState.error = 'A atualização não foi confirmada.';
    act(() => renderer.update(createElement(FinanceiroRoute)));
    expect(mockFinancialDataState.reload).toHaveBeenCalledTimes(1);
    expect(
      renderer.root
        .findAll((node) => String(node.type) === 'native-animated-number')
        .some((node) => node.props.value === 50),
    ).toBe(true);
    expect(
      hasRenderedText(
        renderer,
        'A atualização não foi confirmada. Exibindo o último resultado confirmado.',
      ),
    ).toBe(false);

    mockFinancialDataState.snapshot = null;
    mockFinancialDataState.snapshotScopeKey = undefined;
    mockFinancialDataState.snapshotSessionScopeKey = undefined;
    mockFinancialDataState.requestScopeKey = 'changed-session-query';
    mockAuthState.sessionVersion = 2;
    mockFinancialDataState.coverage = {
      remoteComplete: false,
      routesCoverage: 'not-loaded',
      source: 'none',
    };
    mockFinancialDataState.hasPreviouslyConfirmedSnapshot = false;
    mockFinancialDataState.error = 'A sessão financeira mudou.';
    act(() => renderer.update(createElement(FinanceiroRoute)));
    expect(
      renderer.root
        .findAll((node) => String(node.type) === 'native-animated-number')
        .some((node) => node.props.value === 50),
    ).toBe(false);
    expect(
      renderer.root.findAll((node) => {
        const children = node.props.children;
        const text =
          typeof children === 'string'
            ? children
            : Array.isArray(children)
              ? children.join('')
              : '';
        return String(node.type) === 'Text' && text.includes('Lucro líquido indisponível.');
      }),
    ).not.toHaveLength(0);
  });

  it('shows an explicit net profit state when cold offline data has no confirmation', async () => {
    mockFuelCostsState.isReady = true;
    mockFinancialDataState.snapshot = mockWholesaleSnapshot;
    mockFinancialDataState.snapshotScopeKey = '2026-09';
    mockFinancialDataState.snapshotSessionScopeKey = 'firebase-user:1';
    mockFinancialDataState.coverage = {
      remoteComplete: false,
      requestScopeKey: 'cold-offline-query',
      routesCoverage: 'not-loaded',
      source: 'local',
    };
    mockFinancialDataState.remoteComplete = false;
    mockFinancialDataState.hasPreviouslyConfirmedSnapshot = false;
    mockConnectivityState.value = {
      isConnected: false,
      isInternetReachable: false,
      type: 'none',
    };
    mockCalculateResumo.mockReturnValue(mockWholesaleSummary);

    const renderer = renderRoute();
    await act(async () => {
      mockFocusEffectCallback?.();
      await Promise.resolve();
    });

    const numbers = renderer.root.findAll((node) => String(node.type) === 'native-animated-number');
    expect(numbers.some((node) => node.props.value === 100)).toBe(true);
    expect(numbers.some((node) => node.props.value === 50)).toBe(false);
    const showsExplicitUnavailableState = numbers.some(
      (node) => node.props.value === null && node.props.text === 'Lucro líquido indisponível',
    );
    expect(showsExplicitUnavailableState).toBe(true);
  });

  it('keeps online revalidation silent and preserves the original hero card composition', async () => {
    mockFuelCostsState.isReady = true;
    mockFinancialDataState.snapshot = mockWholesaleSnapshot;
    mockFinancialDataState.snapshotScopeKey = '2026-09';
    mockFinancialDataState.snapshotSessionScopeKey = 'firebase-user:1';
    mockFinancialDataState.coverage = {
      remoteComplete: true,
      requestScopeKey: 'same-session-month-query',
      routesCoverage: 'not-loaded',
      source: 'remote',
    };
    mockFinancialDataState.remoteComplete = true;
    mockFinancialDataState.hasPreviouslyConfirmedSnapshot = true;
    mockConnectivityState.value = {
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
    };
    mockCalculateResumo.mockReturnValue(mockWholesaleSummary);

    const renderer = renderRoute();
    await act(async () => {
      mockFocusEffectCallback?.();
      await Promise.resolve();
    });

    for (let cycle = 0; cycle < 4; cycle += 1) {
      mockFinancialDataState.refreshing = true;
      mockIsFocused.value = false;
      act(() => renderer.update(createElement(FinanceiroRoute)));
      mockIsFocused.value = true;
      act(() => renderer.update(createElement(FinanceiroRoute)));

      expect(
        renderer.root
          .findAll((node) => String(node.type) === 'native-animated-number')
          .some((node) => node.props.value === 50),
      ).toBe(true);
      expect(hasRenderedText(renderer, 'Atualizando')).toBe(false);
      const cards = renderer.root.findAll((node) =>
        ['premium-card-pressable', 'premium-card-static'].includes(String(node.type)),
      );
      expect(Children.toArray(cards[1]?.props.children)).toHaveLength(2);

      mockFinancialDataState.refreshing = false;
      act(() => renderer.update(createElement(FinanceiroRoute)));
    }
  });

  it('keeps the same native animation baseline until a changed net profit is confirmed', async () => {
    const previousComparison = { atual: 50, anterior: 40, diferenca: 10, percentual: 25 };
    const nextComparison = { atual: 75, anterior: 50, diferenca: 25, percentual: 50 };
    const confirmedCoverage = {
      remoteComplete: true,
      requestScopeKey: 'same-session-month-query',
      routesCoverage: 'not-loaded',
      source: 'remote',
    } as const;
    mockFuelCostsState.isReady = true;
    mockFinancialDataState.snapshot = mockWholesaleSnapshot;
    mockFinancialDataState.comparisonSnapshot = mockWholesaleSnapshot;
    mockFinancialDataState.snapshotScopeKey = '2026-09';
    mockFinancialDataState.snapshotSessionScopeKey = 'firebase-user:1';
    mockFinancialDataState.coverage = {
      remoteComplete: false,
      routesCoverage: 'not-loaded',
      source: 'cache',
    };
    mockCalculateResumo.mockReturnValue(mockWholesaleSummary);
    mockCompareCalendarMonths.mockReturnValue({ lucroLiquido: previousComparison });

    const renderer = renderRoute();
    await act(async () => {
      mockFocusEffectCallback?.();
      await Promise.resolve();
    });
    const getProfitNumber = () =>
      renderer.root.findAll((node) => String(node.type) === 'native-animated-number')[1];
    const getProfitTrend = () =>
      renderer.root.findAll((node) => String(node.type) === 'financial-trend-indicator')[1];
    const statusNumber = getProfitNumber();
    expect(statusNumber.props).toMatchObject({
      animateFirstValue: true,
      animationEnabled: false,
      text: 'Lucro líquido indisponível',
      value: null,
    });
    expect(getProfitTrend().props.visible).toBe(false);

    mockFinancialDataState.refreshing = true;
    act(() => renderer.update(createElement(FinanceiroRoute)));

    expect(getProfitNumber()).toBe(statusNumber);
    expect(getProfitNumber().props).toMatchObject({
      animationEnabled: false,
      text: 'Aguardando confirmação',
      value: null,
    });

    mockFinancialDataState.coverage = confirmedCoverage;
    mockFinancialDataState.remoteComplete = true;
    mockFinancialDataState.hasPreviouslyConfirmedSnapshot = true;
    mockFinancialDataState.refreshing = false;
    act(() => renderer.update(createElement(FinanceiroRoute)));

    const confirmedNumber = getProfitNumber();
    const confirmedTrend = getProfitTrend();
    expect(confirmedNumber === statusNumber).toBe(true);
    expect(confirmedNumber.props).toMatchObject({ animationEnabled: true, value: 50 });
    expect(confirmedTrend.props).toMatchObject({ comparison: previousComparison, visible: true });

    mockFinancialDataState.snapshot = null;
    mockFinancialDataState.comparisonSnapshot = null;
    mockFinancialDataState.snapshotScopeKey = undefined;
    mockFinancialDataState.snapshotSessionScopeKey = undefined;
    mockFinancialDataState.coverage = {
      remoteComplete: false,
      routesCoverage: 'not-loaded',
      source: 'none',
    };
    mockFinancialDataState.remoteComplete = false;
    mockFinancialDataState.hasPreviouslyConfirmedSnapshot = false;
    mockFinancialDataState.loading = true;
    act(() => renderer.update(createElement(FinanceiroRoute)));

    expect(getProfitNumber() === confirmedNumber).toBe(true);
    expect(getProfitNumber().props).toMatchObject({ animationEnabled: true, value: 50 });
    expect(getProfitTrend().props).toMatchObject({ comparison: previousComparison, visible: true });
    expect(
      hasRenderedText(
        renderer,
        'Exibindo o último resultado confirmado enquanto o período é atualizado.',
      ),
    ).toBe(false);

    mockFinancialDataState.coverage = {
      remoteComplete: false,
      routesCoverage: 'not-loaded',
      source: 'local',
    };
    mockFinancialDataState.remoteComplete = false;
    mockFinancialDataState.loading = true;
    mockFinancialDataState.refreshing = true;
    mockFinancialDataState.snapshot = { ...mockWholesaleSnapshot };
    mockFinancialDataState.comparisonSnapshot = { ...mockWholesaleSnapshot };
    mockFinancialDataState.snapshotScopeKey = '2026-09';
    mockFinancialDataState.snapshotSessionScopeKey = 'firebase-user:1';
    mockCalculateResumo.mockReturnValue({ ...mockWholesaleSummary, lucroLiquido: 75 });
    mockCompareCalendarMonths.mockReturnValue({ lucroLiquido: nextComparison });
    act(() => renderer.update(createElement(FinanceiroRoute)));

    expect(getProfitNumber()).toBe(confirmedNumber);
    expect(getProfitNumber().props).toMatchObject({ animationEnabled: true, value: 50 });
    expect(getProfitTrend().props).toMatchObject({ comparison: previousComparison, visible: true });

    mockFinancialDataState.coverage = confirmedCoverage;
    mockFinancialDataState.remoteComplete = true;
    mockFinancialDataState.hasPreviouslyConfirmedSnapshot = true;
    mockFinancialDataState.loading = false;
    act(() => renderer.update(createElement(FinanceiroRoute)));
    expect(getProfitNumber().props).toMatchObject({ animationEnabled: true, value: 50 });

    mockFinancialDataState.refreshing = false;
    act(() => renderer.update(createElement(FinanceiroRoute)));
    expect(getProfitNumber()).toBe(confirmedNumber);
    expect(getProfitNumber().props).toMatchObject({ animationEnabled: true, value: 75 });
    expect(getProfitTrend()).toBe(confirmedTrend);
    expect(getProfitTrend().props).toMatchObject({ comparison: nextComparison, visible: true });
    expect(
      hasRenderedText(
        renderer,
        'Exibindo o último resultado confirmado enquanto o período é atualizado.',
      ),
    ).toBe(false);

    mockFinancialDataState.coverage = {
      remoteComplete: false,
      routesCoverage: 'not-loaded',
      source: 'cache',
    };
    mockFinancialDataState.remoteComplete = false;
    mockFinancialDataState.hasPreviouslyConfirmedSnapshot = false;
    act(() => renderer.update(createElement(FinanceiroRoute)));
    expect(getProfitNumber()).toBe(confirmedNumber);
    expect(getProfitNumber().props).toMatchObject({ animationEnabled: true, value: 75 });
    expect(getProfitTrend().props.visible).toBe(true);

    mockFinancialDataState.requestScopeKey = 'new-month-query';
    mockFinancialDataState.coverage = {
      ...mockFinancialDataState.coverage,
      requestScopeKey: mockFinancialDataState.requestScopeKey,
    };
    act(() => renderer.update(createElement(FinanceiroRoute)));
    const nextQueryNumber = getProfitNumber();
    expect(nextQueryNumber).toBe(confirmedNumber);
    expect(nextQueryNumber.props.value).toBe(75);
    expect(getProfitTrend().props.visible).toBe(true);

    mockFinancialDataState.requestScopeKey = 'other-user-month-query';
    mockFinancialDataState.snapshotSessionScopeKey = 'other-user:1';
    act(() => renderer.update(createElement(FinanceiroRoute)));
    const nextSessionNumber = getProfitNumber();
    expect(nextSessionNumber).toBe(nextQueryNumber);
    expect(nextSessionNumber.props.value).toBeNull();
    expect(getProfitTrend().props.visible).toBe(false);

    mockFinancialDataState.loading = true;
    mockFinancialDataState.snapshotScopeKey = 'all';
    mockFinancialDataState.requestScopeKey = 'other-user-all-time-query';
    const selector = findWholesalePeriodSelector(renderer);
    act(() => selector.props.onChange('all'));
    expect(getProfitNumber()).not.toBe(nextSessionNumber);
    expect(getProfitNumber().props).toMatchObject({ animationEnabled: false, value: null });
    expect(getProfitTrend().props.visible).toBe(false);
  });

  it('keeps the all-time native baseline when its canonical cache omits the request key', async () => {
    mockFuelCostsState.isReady = true;
    mockFinancialDataState.snapshot = mockWholesaleSnapshot;
    mockFinancialDataState.snapshotScopeKey = 'all';
    mockFinancialDataState.snapshotSessionScopeKey = 'firebase-user:1';
    mockFinancialDataState.coverage = {
      remoteComplete: true,
      requestScopeKey: 'all-time-request',
      routesCoverage: 'local-only',
      source: 'remote',
    };
    mockFinancialDataState.remoteComplete = true;
    mockFinancialDataState.hasPreviouslyConfirmedSnapshot = true;
    mockCalculateResumo.mockReturnValue(mockWholesaleSummary);

    const renderer = renderRoute();
    const selector = findWholesalePeriodSelector(renderer);
    act(() => selector.props.onChange('all'));
    await act(async () => {
      mockFocusEffectCallback?.();
      await Promise.resolve();
    });
    const getProfitNumber = () =>
      renderer.root.findAll((node) => String(node.type) === 'native-animated-number')[1];
    const confirmedNumber = getProfitNumber();
    expect(confirmedNumber.props).toMatchObject({ animationEnabled: true, value: 50 });

    mockFinancialDataState.coverage = {
      remoteComplete: false,
      routesCoverage: 'local-only',
      source: 'cache',
    };
    mockFinancialDataState.remoteComplete = false;
    mockFinancialDataState.refreshing = true;
    act(() => renderer.update(createElement(FinanceiroRoute)));
    expect(getProfitNumber()).toBe(confirmedNumber);
    expect(getProfitNumber().props).toMatchObject({ animationEnabled: true, value: 50 });
  });

  it('keeps the last confirmed monthly comparison visible until the same scope is confirmed again', async () => {
    const confirmedComparison = {
      atual: 50,
      anterior: 40,
      diferenca: 10,
      percentual: 25,
      subiu: true,
    };
    mockFuelCostsState.isReady = true;
    mockFinancialDataState.snapshot = mockWholesaleSnapshot;
    mockFinancialDataState.comparisonSnapshot = mockWholesaleSnapshot;
    mockFinancialDataState.snapshotScopeKey = '2026-09';
    mockFinancialDataState.snapshotSessionScopeKey = 'firebase-user:1';
    mockFinancialDataState.coverage = {
      remoteComplete: true,
      requestScopeKey: 'same-session-month-query',
      routesCoverage: 'not-loaded',
      source: 'remote',
    };
    mockFinancialDataState.remoteComplete = true;
    mockFinancialDataState.hasPreviouslyConfirmedSnapshot = true;
    mockCalculateResumo.mockReturnValue(mockWholesaleSummary);
    mockCompareCalendarMonths.mockReturnValue({ lucroLiquido: confirmedComparison });

    const renderer = renderRoute();
    await act(async () => {
      mockFocusEffectCallback?.();
      await Promise.resolve();
    });
    const getProfitTrend = () =>
      renderer.root
        .findAll((node) => String(node.type) === 'financial-trend-indicator')
        .find((node) => node.props.comparison === confirmedComparison);
    expect(getProfitTrend()?.props.visible).toBe(true);

    mockFinancialDataState.coverage = {
      remoteComplete: false,
      requestScopeKey: 'same-session-month-query',
      routesCoverage: 'not-loaded',
      source: 'cache',
    };
    mockFinancialDataState.remoteComplete = false;
    mockFinancialDataState.comparisonSnapshot = null;
    mockFinancialDataState.refreshing = true;
    act(() => renderer.update(createElement(FinanceiroRoute)));

    expect(getProfitTrend()?.props.visible).toBe(true);
    expect(
      renderer.root
        .findAll((node) => String(node.type) === 'native-animated-number')
        .some((node) => node.props.value === 50),
    ).toBe(true);

    mockFinancialDataState.snapshotScopeKey = 'all';
    mockFinancialDataState.requestScopeKey = 'all-time-query';
    mockFinancialDataState.coverage = {
      remoteComplete: false,
      routesCoverage: 'not-loaded',
      source: 'cache',
    };
    mockFinancialDataState.hasPreviouslyConfirmedSnapshot = false;
    act(() => findWholesalePeriodSelector(renderer).props.onChange('all'));

    const currentTrends = renderer.root.findAll(
      (node) => String(node.type) === 'financial-trend-indicator',
    );
    expect(currentTrends.some((trend) => trend.props.comparison === confirmedComparison)).toBe(
      false,
    );
    expect(
      renderer.root
        .findAll((node) => String(node.type) === 'native-animated-number')
        .some((node) => node.props.value === 50),
    ).toBe(false);

    mockFinancialDataState.snapshotScopeKey = '2026-09';
    mockFinancialDataState.snapshotSessionScopeKey = 'firebase-user:2';
    mockFinancialDataState.requestScopeKey = 'different-session-query';
    mockFinancialDataState.coverage = {
      remoteComplete: false,
      requestScopeKey: 'different-session-query',
      routesCoverage: 'not-loaded',
      source: 'cache',
    };
    act(() => findWholesalePeriodSelector(renderer).props.onChange('month'));
    const switchedSessionTrend = renderer.root.findAll(
      (node) => String(node.type) === 'financial-trend-indicator',
    )[1];
    expect(switchedSessionTrend?.props.comparison).not.toBe(confirmedComparison);
    expect(
      renderer.root
        .findAll((node) => String(node.type) === 'native-animated-number')
        .some((node) => node.props.value === 50),
    ).toBe(false);
  });

  it('marks a still-confirmed snapshot as the last confirmed value while offline', async () => {
    mockFuelCostsState.isReady = true;
    mockFinancialDataState.snapshot = mockWholesaleSnapshot;
    mockFinancialDataState.snapshotScopeKey = '2026-09';
    mockFinancialDataState.snapshotSessionScopeKey = 'firebase-user:1';
    mockFinancialDataState.coverage = {
      remoteComplete: true,
      requestScopeKey: 'same-session-month-query',
      routesCoverage: 'not-loaded',
      source: 'remote',
    };
    mockFinancialDataState.remoteComplete = true;
    mockFinancialDataState.hasPreviouslyConfirmedSnapshot = true;
    mockConnectivityState.value = {
      isConnected: false,
      isInternetReachable: false,
      type: 'none',
    };
    mockCalculateResumo.mockReturnValue(mockWholesaleSummary);

    const renderer = renderRoute();
    await act(async () => {
      mockFocusEffectCallback?.();
      await Promise.resolve();
    });

    expect(
      renderer.root
        .findAll((node) => String(node.type) === 'native-animated-number')
        .some((node) => node.props.value === 50),
    ).toBe(true);
    expect(hasRenderedText(renderer, 'Sem conexão. Exibindo o último resultado confirmado.')).toBe(
      true,
    );
  });

  it('keeps hero card identity while monthly detail interactivity changes', async () => {
    mockFuelCostsState.isReady = true;
    mockFinancialDataState.snapshot = {
      clientesCustom: {},
      entregas: [],
      gastosDiarios: {},
      gastosMensais: {},
      recebimentoBaldes: [],
    };
    mockFinancialDataState.snapshotScopeKey = '2026-09';
    mockFinancialDataState.snapshotSessionScopeKey = 'firebase-user:1';
    mockFinancialDataState.coverage = {
      remoteComplete: true,
      requestScopeKey: '2026-09-request',
      routesCoverage: 'not-loaded',
      source: 'remote',
    };
    mockFinancialDataState.remoteComplete = true;
    mockFinancialDataState.hasPreviouslyConfirmedSnapshot = true;
    mockCalculateResumo.mockReturnValue({
      faturamento: 100,
      lucroLiquido: 50,
      margemBruta: 0,
      margemLiquida: 0,
    });

    mockFuelCostsState.isReady = true;
    const renderer = renderRoute();
    const initialCards = renderer.root.findAll(
      (node) => String(node.type) === 'premium-card-pressable',
    );
    expect(initialCards).toHaveLength(2);
    expect(typeof initialCards[0].props.onPress).toBe('function');
    expect(initialCards[1].props.onPress).toBeUndefined();

    await act(async () => {
      mockFocusEffectCallback?.();
      await Promise.resolve();
    });
    const monthlyCards = renderer.root.findAll(
      (node) => String(node.type) === 'premium-card-pressable',
    );
    const monthlyNumbers = renderer.root.findAll(
      (node) => String(node.type) === 'native-animated-number',
    );
    expect(monthlyCards).toHaveLength(2);
    expect(monthlyNumbers).toHaveLength(2);
    expect(monthlyCards.every((card) => typeof card.props.onPress === 'function')).toBe(true);

    const selector = findWholesalePeriodSelector(renderer);
    act(() => selector.props.onChange('day'));

    const dayCards = renderer.root.findAll(
      (node) => String(node.type) === 'premium-card-pressable',
    );
    const dayNumbers = renderer.root.findAll(
      (node) => String(node.type) === 'native-animated-number',
    );
    expect(dayCards).toHaveLength(2);
    expect(dayNumbers).toHaveLength(2);
    expect(dayCards.map((card) => String(card.type))).toEqual(
      monthlyCards.map((card) => String(card.type)),
    );
    expect(dayCards.every((card) => card.props.onPress === undefined)).toBe(true);
    expect(dayCards.every((card) => card.props.preservePressableIdentity === true)).toBe(true);
    expect(dayNumbers.map((number) => String(number.type))).toEqual(
      monthlyNumbers.map((number) => String(number.type)),
    );
  });

  it('changes the canonical query and History toolbar when selecting day, week, and all', () => {
    const renderer = renderRoute();
    let selector = findWholesalePeriodSelector(renderer);

    act(() => selector.props.onChange('day'));
    expect(mockExpenseQueryForWholesaleFinanceSelection).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'day', date: expect.any(String) }),
    );
    expect(mockRenderNativeDateToolbarItems).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: 'day' }),
    );

    selector = findWholesalePeriodSelector(renderer);
    act(() => selector.props.onChange('week'));
    expect(mockExpenseQueryForWholesaleFinanceSelection).toHaveBeenLastCalledWith(
      expect.objectContaining({
        endDate: expect.any(String),
        kind: 'week',
        startDate: expect.any(String),
      }),
    );
    expect(mockRenderNativeDateToolbarItems).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: 'week', weekGroups: [] }),
    );

    selector = findWholesalePeriodSelector(renderer);
    act(() => selector.props.onChange('all'));
    expect(mockExpenseQueryForWholesaleFinanceSelection).toHaveBeenLastCalledWith({ kind: 'all' });
    expect(
      renderer.root.findAll(
        (node) =>
          String(node.type) === 'toolbar-label' && node.props.children === 'Todo o histórico',
      ),
    ).not.toHaveLength(0);
  });

  it('uses the all-time calculation contract without summing monthly cards', () => {
    mockFinancialDataState.snapshot = {
      clientesCustom: {},
      entregas: [],
      gastosDiarios: {},
      gastosMensais: {},
      recebimentoBaldes: [],
    };
    mockFinancialDataState.remoteComplete = false;
    mockFinancialDataState.routesCoverage = 'local-only';
    mockCalculateResumo.mockReturnValue({
      custoCombustivel: 0,
      custoEstar: 0,
      custoLuz: 0,
      custoMedioBalde: 0,
      custoMedioCombustivelPorEntrega: 0,
      custoOutros: 0,
      custoTotal: 0,
      custoTotalBaldes: 0,
      faturamento: 100,
      lucroBruto: 100,
      lucroLiquido: 100,
      lucroLiquidoPorBalde: 0,
      margemBruta: 100,
      margemLiquida: 100,
      quantidadeBaldes: 1,
      quantidadeEntregas: 1,
      precoMedioBalde: 100,
      valoresPagos: 100,
      valoresPendentes: 0,
    });

    const renderer = renderRoute();
    const selector = findWholesalePeriodSelector(renderer);
    act(() => {
      mockFinancialDataState.snapshotScopeKey = 'all';
      selector.props.onChange('all');
    });

    expect(mockCalculateResumo).toHaveBeenLastCalledWith(
      expect.objectContaining({ filters: { periodo: 'todos' } }),
    );
    expect(mockCalculateResumo.mock.calls.at(-1)?.[0]).not.toHaveProperty('filters.mesSelecionado');
  });

  it('initializes only the Retail Finance branch in retail mode', () => {
    mockAppMode.mode = 'retail';
    const renderer = renderRoute();

    expect(mockRetailFinance).toHaveBeenCalledTimes(1);
    expect(renderer.root.findAll((node) => String(node.type) === 'premium-screen')).toHaveLength(1);
    expect(
      renderer.root.findAll((node) => String(node.type) === 'period-selector')[0].props,
    ).not.toHaveProperty('fillAvailableWidth', true);
    expect(
      renderer.root.findAll((node) => String(node.type) === 'period-selector')[0].props
        .selectionAnimationMode,
    ).toBe('slidingBubble');
    expect(
      renderer.root.findAll((node) => String(node.type) === 'period-selector')[0].props,
    ).not.toHaveProperty('selectedVisualScale');
    expect(
      renderer.root.findAll((node) => String(node.type) === 'period-selector')[0].props.itemSpacing,
    ).toBe(16);
    expect(
      renderer.root.findAll((node) => String(node.type) === 'period-selector')[0].props
        .contentLeadingPadding,
    ).toBe(0);
    expect(
      renderer.root.findAll((node) => String(node.type) === 'period-selector')[0].props
        .contentTrailingPadding,
    ).toBe(0);
    expect(
      renderer.root.findAll((node) => String(node.type) === 'period-selector')[0].props
        .itemHorizontalPadding,
    ).toBe(4);
  });

  it('renders the Retail initialization state instead of a blank content area during focus transition', () => {
    mockAppMode.mode = 'retail';
    mockIsFocused.value = false;
    const renderer = renderRoute();

    expect(
      renderer.root.findAll((node) => node.props.children === 'Carregando Finanças Varejo...'),
    ).not.toHaveLength(0);
  });

  it('keeps the Retail cards visible when a warmed summary is refreshing', () => {
    mockAppMode.mode = 'retail';
    mockRetailFinanceState.refreshing = true;
    mockRetailFinanceState.summary = {
      deliveryCostRecognized: 0,
      deliveryFeeRecognized: 0,
      margin: 50,
      orderCount: 1,
      paymentFees: 0,
      productCostRecognized: 50,
      productRevenueRecognized: 100,
      profit: 50,
      revenueReceived: 100,
      series: [],
      unitsSold: 1,
    };
    const renderer = renderRoute();

    expect(
      renderer.root.findAll((node) => node.props.children === 'Carregando Finanças Varejo...'),
    ).toHaveLength(0);
    expect(renderer.root.findAll((node) => node.props.children === 'RECEBIDO')).not.toHaveLength(0);
  });

  it('uses the large-card radius only for the Retail revenue chart container', () => {
    mockAppMode.mode = 'retail';
    mockRetailFinanceState.summary = {
      deliveryCostRecognized: 0,
      deliveryFeeRecognized: 0,
      margin: 50,
      orderCount: 1,
      paymentFees: 0,
      productCostRecognized: 50,
      productRevenueRecognized: 100,
      profit: 50,
      revenueReceived: 100,
      series: [],
      unitsSold: 1,
    };

    const renderer = renderRoute();
    const chartCard = renderer.root.findAll(
      (node) =>
        String(node.type) === 'premium-card-static' &&
        node.findAll((candidate) => candidate.props.children === 'RECEITA POR PERÍODO').length > 0,
    )[0];

    expect(chartCard?.props.style).toEqual(expect.objectContaining({ borderRadius: 40 }));
  });

  it('keeps the fatal error state when no Retail summary exists', () => {
    mockAppMode.mode = 'retail';
    mockRetailFinanceState.error = 'Falha ao carregar Finanças Varejo.';
    const renderer = renderRoute();

    expect(
      renderer.root.findAll((node) => node.props.children === 'Carregando Finanças Varejo...'),
    ).toHaveLength(0);
    expect(
      renderer.root.findAll((node) => node.props.children === 'Falha ao carregar Finanças Varejo.'),
    ).not.toHaveLength(0);
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
