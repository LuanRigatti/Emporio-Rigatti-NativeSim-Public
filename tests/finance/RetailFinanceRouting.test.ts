/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ComponentType, type ReactNode } from 'react';

const mockAppMode = { mode: 'wholesale' as 'wholesale' | 'retail' };
const mockIsFocused = { value: true };
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
    selectedKey,
    selectedVisualScale,
  }: {
    items: readonly { key: string; label: string }[];
    onChange: (key: string) => void;
    selectedKey: string;
    contentLeadingPadding?: number;
    contentTrailingPadding?: number;
    fillAvailableWidth?: boolean;
    itemHorizontalPadding?: number;
    itemSpacing?: number;
    selectedVisualScale?: number;
  }) =>
    mockCreateElement('period-selector', {
      contentLeadingPadding,
      contentTrailingPadding,
      fillAvailableWidth,
      items,
      itemHorizontalPadding,
      itemSpacing,
      onChange,
      selectedKey,
      selectedVisualScale,
    }),
);
const mockRenderNativeDateToolbarItems = jest.fn(() => null);
const mockRenderFinancePeriodToolbarItems = jest.fn(() => null);
const mockFinancialDataState: {
  comparisonSnapshot: unknown;
  error: string | undefined;
  loading: boolean;
  refreshing: boolean;
  remoteComplete: boolean;
  routesCoverage: 'not-loaded' | 'local-only';
  snapshot: unknown;
  snapshotScopeKey: string | undefined;
} = {
  comparisonSnapshot: null as unknown,
  error: undefined as string | undefined,
  loading: false,
  refreshing: false,
  remoteComplete: false,
  routesCoverage: 'not-loaded',
  snapshot: null as unknown,
  snapshotScopeKey: undefined as string | undefined,
};
const mockFinancialData = jest.fn(() => mockFinancialDataState);
const mockRouterPush = jest.fn();
const mockCalculateResumo = jest.fn();
const mockCompareCalendarMonths = jest.fn();
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
  Stack: {
    Toolbar: mockToolbar,
  },
  useFocusEffect: jest.fn(),
  useIsFocused: () => mockIsFocused.value,
  useRouter: () => ({ push: mockRouterPush }),
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
  SummaryCard: () => null,
}));
jest.mock('@/features/finance', () => ({
  FinancialTrendIndicator: () => null,
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
jest.mock('@/hooks/useFinancialFuelCosts', () => ({
  useFinancialFuelCosts: () => ({ fuelCostByDate: {}, isReady: false }),
}));
jest.mock('@/hooks/useRetailCategories', () => ({
  useRetailCategories: () => ({ categories: [] }),
}));
jest.mock('@/hooks/useRetailFinance', () => ({ useRetailFinance: mockRetailFinance }));
jest.mock('@/providers', () => ({ useAppMode: () => mockAppMode }));
jest.mock('@/services/costs', () => ({
  expenseQueryForFinancialSelection: jest.fn(),
  expenseQueryForWholesaleFinanceSelection: mockExpenseQueryForWholesaleFinanceSelection,
}));
jest.mock('@/services/finance', () => ({
  financialCalculationService: {
    calculateResumo: mockCalculateResumo,
    compareCalendarMonths: mockCompareCalendarMonths,
  },
  formatWholesaleFinancePeriodLabel: jest.fn(() => 'Todo o histórico'),
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
      spacing: { md: 16, sm: 8, xl: 20, xxl: 24, xs: 4, xxs: 2, xxxl: 32 },
      typography: { body: {}, caption: {}, footnote: {} },
    },
  }),
}));
jest.mock('@/utils/haptics', () => ({ triggerLightImpactHaptic: jest.fn() }));

const FinanceiroRoute = require('@/app/(tabs)/financeiro/index').default as ComponentType;

describe('Financeiro AppMode routing', () => {
  beforeEach(() => {
    mockAppMode.mode = 'wholesale';
    mockIsFocused.value = true;
    mockRetailFinanceState.error = undefined;
    mockRetailFinanceState.loading = false;
    mockRetailFinanceState.refreshing = false;
    mockRetailFinanceState.summary = null;
    mockFinancialDataState.comparisonSnapshot = null;
    mockFinancialDataState.error = undefined;
    mockFinancialDataState.loading = false;
    mockFinancialDataState.refreshing = false;
    mockFinancialDataState.remoteComplete = false;
    mockFinancialDataState.routesCoverage = 'not-loaded';
    mockFinancialDataState.snapshot = null;
    mockFinancialDataState.snapshotScopeKey = undefined;
    mockRetailFinance.mockClear();
    mockNativePeriodSelector.mockClear();
    mockRenderNativeDateToolbarItems.mockClear();
    mockRenderFinancePeriodToolbarItems.mockClear();
    mockFinancialData.mockClear();
    mockExpenseQueryForWholesaleFinanceSelection.mockClear();
    mockRouterPush.mockClear();
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

  function findWholesalePeriodSelector(renderer: ReactTestRenderer) {
    const selector = renderer.root.findAll((node) => String(node.type) === 'period-selector')[0];
    if (!selector) throw new Error('Seletor de período não encontrado.');
    return selector;
  }

  it('keeps the Wholesale branch and does not initialize Retail Finance in wholesale mode', () => {
    const renderer = renderRoute();

    expect(renderer.root.findAll((node) => String(node.type) === 'premium-screen')).toHaveLength(1);
    expect(mockRetailFinance).not.toHaveBeenCalled();
  });

  it('renders the Wholesale period selector in the canonical order with month selected', () => {
    const renderer = renderRoute();
    const selector = findWholesalePeriodSelector(renderer);

    expect(selector.props.items).toEqual([
      { key: 'month', label: 'Mês' },
      { key: 'day', label: 'Dia' },
      { key: 'week', label: 'Semana' },
      { key: 'all', label: 'Total' },
    ]);
    expect(selector.props.selectedKey).toBe('month');
    expect(selector.props.contentLeadingPadding).toBeUndefined();
    expect(selector.props.contentTrailingPadding).toBeUndefined();
    expect(selector.props.fillAvailableWidth).toBe(true);
    expect(selector.props.itemSpacing).toBeUndefined();
    expect(selector.props.selectedVisualScale).toBe(1.06);
    expect(mockExpenseQueryForWholesaleFinanceSelection).toHaveBeenCalledWith({
      kind: 'month',
      month: '2026-09',
    });
  });

  it('keeps the previous Wholesale cards visible while the next period revalidates', () => {
    mockFinancialDataState.snapshot = {
      clientesCustom: {},
      entregas: [],
      gastosDiarios: {},
      gastosMensais: {},
      recebimentoBaldes: [],
    };
    mockFinancialDataState.snapshotScopeKey = '2026-09';
    mockCalculateResumo.mockReturnValue({
      faturamento: 100,
      lucroLiquido: 50,
      margemBruta: 0,
      margemLiquida: 0,
    });

    const renderer = renderRoute();
    expect(
      renderer.root.findAll((node) => String(node.type) === 'premium-card-pressable'),
    ).toHaveLength(2);

    mockFinancialDataState.loading = true;
    const selector = findWholesalePeriodSelector(renderer);
    act(() => selector.props.onChange('week'));

    expect(
      renderer.root.findAll((node) => node.props.children === 'Carregando Finanças Atacado...'),
    ).toHaveLength(0);
    expect(
      renderer.root.findAll((node) => String(node.type) === 'premium-card-pressable'),
    ).toHaveLength(2);
  });

  it('keeps hero card identity while monthly detail interactivity changes', () => {
    mockFinancialDataState.snapshot = {
      clientesCustom: {},
      entregas: [],
      gastosDiarios: {},
      gastosMensais: {},
      recebimentoBaldes: [],
    };
    mockFinancialDataState.snapshotScopeKey = '2026-09';
    mockCalculateResumo.mockReturnValue({
      faturamento: 100,
      lucroLiquido: 50,
      margemBruta: 0,
      margemLiquida: 0,
    });

    const renderer = renderRoute();
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
        .selectedVisualScale,
    ).toBeUndefined();
    expect(
      renderer.root.findAll((node) => String(node.type) === 'period-selector')[0].props.itemSpacing,
    ).toBe(0.5);
    expect(
      renderer.root.findAll((node) => String(node.type) === 'period-selector')[0].props
        .contentTrailingPadding,
    ).toBe(0);
    expect(
      renderer.root.findAll((node) => String(node.type) === 'period-selector')[0].props
        .itemHorizontalPadding,
    ).toBe(2);
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
