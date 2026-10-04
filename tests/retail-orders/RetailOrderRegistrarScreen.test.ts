/* eslint-disable @typescript-eslint/no-require-imports */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ReactNode, useEffect } from 'react';
import { StyleSheet } from 'react-native';

import NativeButtonSwiftUI from '@/components/native/NativeButton/NativeButtonSwiftUI.ios';
import { RetailOrderRegistrarLauncher } from '@/features/retail-orders/components/RetailOrderRegistrarScreen';
import { RetailOrderPrimaryButton } from '@/features/retail-orders/components/RetailOrderPrimaryButton';
import {
  RetailOrderFlowProvider,
  type RetailOrderFlowContextValue,
  type RetailOrderFlowStep,
  useRetailOrderFlow,
} from '@/features/retail-orders/components/RetailOrderFlowProvider';
import {
  RetailOrderCombinedRegistrarScreen,
  RetailOrderStepScreen,
} from '@/features/retail-orders/components/RetailOrderStepScreen';
import type { NativeButtonProps } from '@/types/native-ui';

jest.mock('@expo/ui/swift-ui', () => {
  const React = require('react') as typeof import('react');
  const makeNativeView = (type: string) => {
    const NativeView = (props: Record<string, unknown>) =>
      React.createElement(type, props, props.children as string | undefined);
    NativeView.displayName = type;
    return NativeView;
  };

  return {
    Button: makeNativeView('swiftui-button'),
    Circle: makeNativeView('swiftui-circle'),
    HStack: makeNativeView('swiftui-hstack'),
    Host: makeNativeView('swiftui-host'),
    Image: makeNativeView('swiftui-image'),
    Label: makeNativeView('swiftui-label'),
    Text: makeNativeView('swiftui-text'),
    VStack: makeNativeView('swiftui-vstack'),
  };
});

jest.mock('@expo/ui/swift-ui/modifiers', () => {
  const modifier = (name: string) => (value?: unknown) => ({ name, value });

  return {
    accessibilityHint: modifier('accessibilityHint'),
    accessibilityValue: modifier('accessibilityValue'),
    background: modifier('background'),
    buttonStyle: modifier('buttonStyle'),
    contentShape: modifier('contentShape'),
    controlSize: modifier('controlSize'),
    cornerRadius: modifier('cornerRadius'),
    disabled: modifier('disabled'),
    font: modifier('font'),
    foregroundColor: modifier('foregroundColor'),
    foregroundStyle: modifier('foregroundStyle'),
    frame: modifier('frame'),
    padding: modifier('padding'),
    shapes: { capsule: () => ({ name: 'capsule' }) },
    tint: modifier('tint'),
  };
});

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return Object.defineProperty(Object.create(actual), 'useWindowDimensions', {
    configurable: true,
    enumerable: true,
    value: () => ({ height: 844, scale: 1, fontScale: 1, width: 390 }),
  });
});

let mockPathname = '/registrar-pedido-varejo';
const mockAppMode = { mode: 'retail' as 'wholesale' | 'retail' };
let mockResolvedMode: 'light' | 'dark' = 'light';
let observedFlow: RetailOrderFlowContextValue | undefined;
const mockRouter = {
  dismissAll: jest.fn(),
  dismissTo: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
};
const mockCreate = jest.fn<Promise<string>, [unknown, unknown]>().mockResolvedValue('order-1');
const mockPrefetchForOrder = jest.fn().mockResolvedValue(undefined);
const mockPrepareForOrder = jest.fn().mockResolvedValue({});
const mockLightImpactHaptic = jest.fn();
const mockNativeButtonHaptic = jest.fn();

const products: {
  active: boolean;
  categoryId: string;
  costMode: 'direct';
  directCostItemId?: string;
  productId: string;
  productName: string;
  standardSalePrice: number;
}[] = [
  {
    active: true,
    categoryId: 'category-1',
    costMode: 'direct' as const,
    directCostItemId: 'cost-1',
    productId: 'product-1',
    productName: 'Cesta Café',
    standardSalePrice: 100,
  },
  {
    active: true,
    categoryId: 'category-1',
    costMode: 'direct' as const,
    directCostItemId: 'cost-1',
    productId: 'product-2',
    productName: 'Cesta Chocolate',
    standardSalePrice: 50,
  },
];
const mockCatalog = {
  categories: [{ categoryId: 'category-1', label: 'Cestas' }],
  clients: [
    {
      active: true,
      address: 'Rua Principal, 10',
      clientId: 'client-1',
      defaultDeliveryFee: 12,
      name: 'Cliente Varejo',
      phone: '99999-0000',
    },
  ],
  error: undefined,
  loading: false,
  prefetchForOrder: mockPrefetchForOrder,
  prepareForOrder: mockPrepareForOrder,
  products,
};
const mockOrderCatalog = {
  categories: mockCatalog.categories,
  compositionVersionsByProductId: new Map(),
  costEntriesByItemId: new Map([
    [
      'cost-1',
      [
        {
          entryId: 'entry-1',
          effectiveDate: '2026-09-15',
          normalizedUnitCost: 20,
          purchasedQuantity: 1,
          purchaseTotalCost: 20,
          unit: 'un',
        },
      ],
    ],
  ]),
  costItems: [{ costItemId: 'cost-1', name: 'Custo', unit: 'un' }],
  products,
};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn() },
}));

jest.mock('expo-router', () => ({
  Stack: {
    Toolbar: Object.assign(
      ({ children, ...props }: { children?: ReactNode }) => {
        const React = require('react') as typeof import('react');
        return React.createElement('stack-toolbar', props, children);
      },
      {
        Button: ({ children, ...props }: { children?: ReactNode }) => {
          const React = require('react') as typeof import('react');
          return React.createElement('stack-toolbar-button', props, children);
        },
        Icon: (props: Record<string, unknown>) => {
          const React = require('react') as typeof import('react');
          return React.createElement('stack-toolbar-icon', props);
        },
        Label: ({ children, ...props }: { children?: ReactNode }) => {
          const React = require('react') as typeof import('react');
          return React.createElement('stack-toolbar-label', props, children);
        },
      },
    ),
  },
  usePathname: () => mockPathname,
  useRouter: () => mockRouter,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

jest.mock('@/components/layout', () => ({
  getNativeLargeTitleStyle: (spacingXxs: number) => ({
    fontFamily: 'System',
    fontSize: 36,
    fontWeight: '700',
    marginLeft: -(spacingXxs * 2),
  }),
  NativeGlassHeader: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('native-header', props);
  },
}));

jest.mock('@/components/feedback', () => ({
  Loading: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('native-loading', props);
  },
}));

jest.mock('@/components/ui/progressive-blur', () => ({
  ProgressiveBlur: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('progressive-blur', props);
  },
}));

jest.mock('@/components/native', () => ({
  NativeButton: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('native-button', props, props.label as ReactNode);
  },
  NativeDatePicker: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('native-date-picker', props);
  },
  NativeDialog: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('native-dialog', props);
  },
  NativeDropdown: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('native-dropdown', props);
  },
  NativeTextField: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('native-text-field', props);
  },
}));

jest.mock('@/components/premium', () => ({
  PremiumCard: ({ children, ...props }: { children?: ReactNode }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('premium-card', props, children);
  },
  PremiumScreen: ({ children, ...props }: { children?: ReactNode }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('premium-screen', props, children);
  },
  ProgressiveCollapsibleScreen: ({
    children,
    largeTitle,
    ...props
  }: {
    children?: ReactNode;
    largeTitle?: ReactNode;
  }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('progressive-collapsible-screen', props, largeTitle, children);
  },
  SearchBar: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    const clearButton =
      props.value && typeof props.onClear === 'function'
        ? React.createElement('search-clear-button', {
            accessibilityLabel: 'Limpar busca',
            onPress: props.onClear,
          })
        : null;
    return React.createElement('search-bar', props, clearButton);
  },
}));

jest.mock('@/components/premium/StickyActionFooter', () => {
  const React = require('react') as typeof import('react');
  const { ProgressiveBlur } = require('@/components/ui/progressive-blur') as {
    ProgressiveBlur: (props: Record<string, unknown>) => ReactNode;
  };
  return {
    StickyActionFooter: ({ children, height }: { children?: ReactNode; height: number }) =>
      React.createElement(
        'sticky-action-footer',
        { height },
        React.createElement(ProgressiveBlur, {
          edge: 'bottom',
          fadeStart: 8,
          height,
          intensity: 30,
          layers: 4,
          style: { bottom: 0 },
          tint: 'systemUltraThinMaterial',
        }),
        children,
      ),
  };
});

jest.mock('@/providers', () => ({
  useAppMode: () => mockAppMode,
  useAppSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

jest.mock('@/hooks/useRetailOrderCatalog', () => ({
  useRetailOrderCatalog: () => mockCatalog,
}));

jest.mock('@/hooks/useRetailOrders', () => ({
  useRetailOrders: () => ({ create: mockCreate }),
}));

jest.mock('@/theme', () => ({
  getCardSurfaceColor: jest.fn((mode: 'light' | 'dark', surface: string) =>
    mode === 'dark' ? '#0C0C0E' : surface,
  ),
  useAppTheme: () => ({
    resolvedMode: mockResolvedMode,
    theme: {
      colors: {
        background: mockResolvedMode === 'dark' ? '#000000' : '#F7F7F7',
        contrastContent: '#FFFFFF',
        contrastSurface: '#000000',
        danger: '#FF0000',
        surface: mockResolvedMode === 'dark' ? '#0C0C0E' : '#FEFFFF',
        surfaceMuted: mockResolvedMode === 'dark' ? '#242426' : '#F2F2F7',
        textPrimary: '#111111',
        textSecondary: '#666666',
      },
      layout: { screenHorizontalPadding: 24, tabBarHeight: 64 },
      radius: { card: 20, md: 12, xl: 24 },
      sizes: { touchTargetMinimum: 44 },
      spacing: {
        lg: 20,
        md: 16,
        sm: 8,
        xxs: 4,
        xl: 24,
        xs: 4,
        xxl: 32,
        xxxl: 48,
      },
      typography: {
        body: {},
        footnote: {},
        headline: {},
        title2: {},
        title3: {},
      },
    },
  }),
}));

jest.mock('@/utils/haptics', () => ({
  triggerLightImpactHaptic: () => mockLightImpactHaptic(),
  triggerNativeButtonHaptic: (...args: unknown[]) => mockNativeButtonHaptic(...args),
}));

jest.mock('@/utils/data', () => ({
  formatCurrency: (value: number) => `R$ ${value.toFixed(2)}`,
  normalizeClientKey: (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim(),
  normalizeMoney: (value: unknown) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    if (typeof value !== 'string' || value.trim() === '') return undefined;
    const normalized = value
      .trim()
      .replace(/[R$\s]/g, '')
      .replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  },
  parseIsoCalendarDate: jest.fn(() => new Date(2026, 8, 15)),
  formatPtBrDate: (value: string) => (value === '2026-09-15' ? '15/09/2026' : value),
  todayIso: jest.fn(() => '2026-09-15'),
}));

function findNodes(renderer: ReactTestRenderer, type: string): ReactTestInstance[] {
  return renderer.root.findAll((node) => String(node.type) === type);
}

function findTestId(renderer: ReactTestRenderer, testID: string): ReactTestInstance[] {
  return renderer.root.findAll((node) => node.props.testID === testID);
}

function findButton(renderer: ReactTestRenderer, label: string): ReactTestInstance {
  const button = findNodes(renderer, 'native-button').find((node) => node.props.label === label);
  if (!button) throw new Error(`Botão não encontrado: ${label}`);
  return button;
}

function expectRetailPrimaryButton(button: ReactTestInstance) {
  expect(button.props).toEqual(
    expect.objectContaining({
      backgroundColor: '#000000',
      color: '#FFFFFF',
      controlSize: 'large',
      haptic: 'light',
      horizontalPadding: 28,
      minHeight: 58,
      variant: 'filled',
    }),
  );
  expect(button.props.minWidth).toBeCloseTo(327.6);
}

function expectNoRetailStepIndicator(renderer: ReactTestRenderer) {
  expect(collectText(renderer.root)).not.toMatch(/Etapa [1-5] de 5/);
}

function expectRetailLargeTitle(renderer: ReactTestRenderer, title: string) {
  const headers = findNodes(renderer, 'native-header');
  expect(headers).toHaveLength(1);
  expect(headers[0].props).toEqual(
    expect.objectContaining({
      largeTitle: true,
      title,
      titleStyle: {
        fontFamily: 'System',
        fontSize: 36,
        fontWeight: '700',
        marginLeft: -8,
      },
    }),
  );
}

function collectText(node: ReactTestInstance): string {
  return node.children
    .map((child) => (typeof child === 'string' ? child : collectText(child)))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function FlowProbe() {
  const flow = useRetailOrderFlow();
  useEffect(() => {
    observedFlow = flow;
  }, [flow]);
  return null;
}

function renderStep(step: RetailOrderFlowStep): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      createElement(
        RetailOrderFlowProvider,
        null,
        createElement(FlowProbe),
        createElement(RetailOrderStepScreen, { step }),
      ),
    );
  });
  return renderer;
}

function renderCombinedRegistrar(): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      createElement(
        RetailOrderFlowProvider,
        null,
        createElement(FlowProbe),
        createElement(RetailOrderCombinedRegistrarScreen),
      ),
    );
  });
  return renderer;
}

function updateCombinedRegistrar(renderer: ReactTestRenderer) {
  act(() => {
    renderer.update(
      createElement(
        RetailOrderFlowProvider,
        null,
        createElement(FlowProbe),
        createElement(RetailOrderCombinedRegistrarScreen),
      ),
    );
  });
}

function searchCombinedClient(renderer: ReactTestRenderer, query: string) {
  const searchBar = findNodes(renderer, 'search-bar')[0];
  act(() => {
    searchBar.props.onFocus();
    searchBar.props.onChangeText(query);
  });
}

function selectCombinedClient(
  renderer: ReactTestRenderer,
  clientId = 'client-1',
  query = 'Cliente Varejo',
) {
  searchCombinedClient(renderer, query);
  const result = renderer.root.findByProps({ testID: `retail-client-result-${clientId}` });
  act(() => result.props.onPress());
}

function renderRegistrarLauncher(): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(createElement(RetailOrderRegistrarLauncher));
  });
  return renderer;
}

function updateStep(renderer: ReactTestRenderer, step: RetailOrderFlowStep) {
  act(() => {
    renderer.update(
      createElement(
        RetailOrderFlowProvider,
        null,
        createElement(FlowProbe),
        createElement(RetailOrderStepScreen, { step }),
      ),
    );
  });
}

async function selectClientAndPushProducts(renderer: ReactTestRenderer) {
  await act(async () => {
    findNodes(renderer, 'native-dropdown')[0].props.onValueChange('client-1');
    await Promise.resolve();
  });
  await act(async () => {
    findButton(renderer, 'Continuar').props.onPress();
    await Promise.resolve();
  });
  expect(mockRouter.push).toHaveBeenLastCalledWith('/registrar-pedido-varejo/produtos');
  updateStep(renderer, 'products');
}

async function addProductAndPushDetails(renderer: ReactTestRenderer) {
  await act(async () => {
    await findNodes(renderer, 'native-dropdown')[0].props.onValueChange('product-1');
  });
  expect(findNodes(renderer, 'native-text-field')).toHaveLength(1);
  await act(async () => {
    findButton(renderer, 'Continuar').props.onPress();
    await Promise.resolve();
  });
  expect(mockRouter.push).toHaveBeenLastCalledWith('/registrar-pedido-varejo/detalhes');
  updateStep(renderer, 'details');
}

describe('RetailOrderRegistrarScreen wizard', () => {
  beforeEach(() => {
    mockPathname = '/registrar-pedido-varejo';
    mockAppMode.mode = 'retail';
    mockResolvedMode = 'light';
    observedFlow = undefined;
    mockRouter.dismissAll.mockClear();
    mockRouter.dismissTo.mockClear();
    mockRouter.push.mockClear();
    mockRouter.replace.mockClear();
    mockLightImpactHaptic.mockClear();
    mockNativeButtonHaptic.mockClear();
    mockCreate.mockClear().mockResolvedValue('order-1');
    mockPrefetchForOrder.mockClear().mockResolvedValue(undefined);
    mockPrepareForOrder.mockClear().mockResolvedValue(mockOrderCatalog);
    mockCatalog.clients = [
      {
        active: true,
        address: 'Rua Principal, 10',
        clientId: 'client-1',
        defaultDeliveryFee: 12,
        name: 'Cliente Varejo',
        phone: '99999-0000',
      },
    ];
    mockCatalog.products = products;
  });

  it('shows only the Registrar pedido action card and opens the combined wizard', () => {
    const renderer = renderRegistrarLauncher();
    const cards = findNodes(renderer, 'premium-card');

    expectRetailLargeTitle(renderer, 'Registrar');
    expect(cards).toHaveLength(1);
    expect(collectText(cards[0])).toContain('Registrar pedido');
    expect(cards[0].props.accessibilityLabel).toBe('Abrir Registrar Pedido Varejo');
    expect(StyleSheet.flatten(cards[0].props.style)).toMatchObject({
      backgroundColor: '#FEFFFF',
      borderRadius: 40,
      padding: 20,
      width: '100%',
    });
    expect(findNodes(renderer, 'native-dropdown')).toHaveLength(0);
    expect(collectText(renderer.root)).not.toContain('Cliente');
    expect(collectText(renderer.root)).not.toContain('Produtos');

    act(() => cards[0].props.onPress());
    expect(mockLightImpactHaptic).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/registrar-pedido-varejo');
  });

  it.each([
    ['light', '#FEFFFF'],
    ['dark', '#0C0C0E'],
  ] as const)('uses the shared action-card surface in %s mode', (mode, surface) => {
    mockResolvedMode = mode;
    const renderer = renderRegistrarLauncher();
    const [card] = findNodes(renderer, 'premium-card');

    expect(StyleSheet.flatten(card.props.style)).toMatchObject({
      backgroundColor: surface,
      borderRadius: 40,
      padding: 20,
      width: '100%',
    });
  });

  it('keeps the fixed native capsule hit shape on the Button label', () => {
    const nativeButtonSource = readFileSync(
      resolve(process.cwd(), 'src/components/native/NativeButton/NativeButtonSwiftUI.ios.tsx'),
      'utf8',
    );

    expect(nativeButtonSource).toMatch(
      /usesFixedFilledFrame \? \(\s*<Text[\s\S]+?frame\(\{ width: minWidth, height: minHeight, alignment: 'center' \}\),[\s\S]+?contentShape\(shapes\.capsule\(\)\),[\s\S]+?<\/Text>/,
    );
    expect(nativeButtonSource).toContain('...(isFilledVariant && !usesFixedFilledFrame');
    expect(nativeButtonSource).toContain('disabledModifier(true)');
    expect(nativeButtonSource).toContain('if (disabled && gateDisabledAction) return;');
    expect(nativeButtonSource).toContain(
      '...(disabled && !gateDisabledAction ? [disabledModifier(true)] : [])',
    );
    expect(nativeButtonSource).not.toContain('preserveDisabledAppearance');
    expect(nativeButtonSource).not.toContain('opacity');
  });

  it('blocks the opt-in disabled CTA before haptic without applying SwiftUI disabled', () => {
    const onPress = jest.fn();
    const props: NativeButtonProps = {
      accessibilityHint: 'Selecione um cliente para continuar.',
      accessibilityValue: 'Indisponível',
      backgroundColor: '#000000',
      color: '#FFFFFF',
      controlSize: 'large',
      disabled: true,
      gateDisabledAction: true,
      haptic: 'light',
      label: 'Continuar',
      minHeight: 58,
      minWidth: 327.6,
      onPress,
      variant: 'filled',
    };
    let renderer!: ReactTestRenderer;

    act(() => {
      renderer = create(createElement(NativeButtonSwiftUI, props));
    });

    const disabledButton = findNodes(renderer, 'swiftui-button')[0];
    expect(
      (disabledButton.props.modifiers as { name: string }[]).some(
        (modifier) => modifier.name === 'disabled',
      ),
    ).toBe(false);
    expect(disabledButton.props.modifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'accessibilityHint',
          value: 'Selecione um cliente para continuar.',
        }),
        expect.objectContaining({ name: 'accessibilityValue', value: 'Indisponível' }),
      ]),
    );

    act(() => disabledButton.props.onPress());
    expect(onPress).not.toHaveBeenCalled();
    expect(mockNativeButtonHaptic).not.toHaveBeenCalled();

    act(() => {
      renderer.update(
        createElement(NativeButtonSwiftUI, {
          ...props,
          accessibilityHint: undefined,
          accessibilityValue: undefined,
          disabled: false,
        }),
      );
    });

    const enabledButton = findNodes(renderer, 'swiftui-button')[0];
    act(() => enabledButton.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(mockNativeButtonHaptic).toHaveBeenCalledWith('light');
  });

  it('keeps the opt-in disabled primary button visually enabled while blocking its action', () => {
    const onPress = jest.fn();
    let renderer!: ReactTestRenderer;

    act(() => {
      renderer = create(
        createElement(RetailOrderPrimaryButton, {
          disabled: true,
          label: 'Adicionar',
          onPress,
          preserveDisabledAppearance: true,
        }),
      );
    });

    let button = findNodes(renderer, 'native-button')[0];
    expect(button.props.disabled).toBe(false);
    expect(button.props.haptic).toBe('none');
    act(() => button.props.onPress());
    expect(onPress).not.toHaveBeenCalled();

    act(() => {
      renderer.update(
        createElement(RetailOrderPrimaryButton, {
          disabled: false,
          label: 'Adicionar',
          onPress,
          preserveDisabledAppearance: true,
        }),
      );
    });

    button = findNodes(renderer, 'native-button')[0];
    expect(button.props.disabled).toBe(false);
    expect(button.props.haptic).toBe('light');
    act(() => button.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('starts at Cliente without a NativeSheet and uses the native-stack page shell', () => {
    const renderer = renderStep('client');
    const premiumScreen = findNodes(renderer, 'premium-screen')[0];

    expect(findNodes(renderer, 'native-sheet')).toHaveLength(0);
    expect(premiumScreen.props.overlayHeader).toBeDefined();
    expect(premiumScreen.props.overlayHeader.props.title).toBeNull();
    expect(premiumScreen.props.overlayHeaderContentOffset).toBe(44);
    expect(premiumScreen.props.progressiveBlur).toBe(true);
    expectRetailLargeTitle(renderer, 'Cliente');
    expect(premiumScreen.props.scrollViewProps).toBeUndefined();
    expectNoRetailStepIndicator(renderer);
    expect(collectText(renderer.root)).toContain('Selecione o cliente');
    const clientDropdown = findNodes(renderer, 'native-dropdown')[0];
    expect(clientDropdown.props.accessibilityLabel).toBe('Selecione o cliente');
    expect(clientDropdown.props.label).toBe('Selecionar');
    expect(clientDropdown.props.selectedValue).toBe('');
    expect(clientDropdown.props.items).toEqual([{ label: 'Cliente Varejo', value: 'client-1' }]);
    const continueButton = findButton(renderer, 'Continuar');
    expect(continueButton.props.disabled).toBe(true);
    expect(continueButton.props.gateDisabledAction).toBe(true);
    expect(continueButton.props.accessibilityHint).toBe('Selecione um cliente para continuar.');
    expect(continueButton.props.accessibilityValue).toBe('Indisponível');
    act(() => continueButton.props.onPress());
    expect(mockRouter.push).not.toHaveBeenCalled();

    act(() => clientDropdown.props.onValueChange('client-1'));
    const selectedDropdown = findNodes(renderer, 'native-dropdown')[0];
    expect(selectedDropdown.props.label).toBe('Cliente Varejo');
    expect(selectedDropdown.props.selectedValue).toBe('client-1');
    expect(collectText(renderer.root)).not.toContain('Rua Principal, 10');
    expect(collectText(renderer.root)).not.toContain('99999-0000');
    expect(findButton(renderer, 'Continuar').props.disabled).toBe(false);
    act(() => findButton(renderer, 'Continuar').props.onPress());
    expect(mockRouter.push).toHaveBeenLastCalledWith('/registrar-pedido-varejo/produtos');
    expect(findNodes(renderer, 'native-button').some((node) => node.props.label === 'Voltar')).toBe(
      false,
    );
    expect(premiumScreen.props.contentContainerStyle[1].marginTop).toBe(74);
    expect(premiumScreen.props.contentContainerStyle[1].paddingBottom).toBe(88);
    expect(findNodes(renderer, 'premium-card')[0].props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ marginTop: 26 })]),
    );
  });

  it('uses the shared Stack pipeline without a nested vertical ScrollView for Details and Summary', () => {
    const screenSource = readFileSync(
      resolve(process.cwd(), 'src/features/retail-orders/components/RetailOrderStepScreen.tsx'),
      'utf8',
    );

    expect(screenSource).toContain("step === 'details' || step === 'summary'");
    expect(screenSource).toContain('<ProgressiveCollapsibleScreen');
    expect(screenSource).toContain('contentGap={0}');
    expect(screenSource).toContain('contentTopInset={contentTopInset}');
    expect(screenSource).toContain('nativeHeader');
    expect(screenSource).not.toContain('nativeTabRoot');
    expect(screenSource).not.toContain('<ScrollView');
  });

  it.each(['details', 'summary'] as const)(
    'redirects an entry without a selected client from %s to the combined wizard',
    (step) => {
      renderStep(step);

      expect(mockRouter.replace).toHaveBeenCalledWith('/registrar-pedido-varejo');
    },
  );

  it('redirects Summary to the combined wizard when products are missing', () => {
    const renderer = renderStep('client');
    act(() => findNodes(renderer, 'native-dropdown')[0].props.onValueChange('client-1'));
    mockRouter.replace.mockClear();

    updateStep(renderer, 'summary');

    expect(mockRouter.replace).toHaveBeenCalledWith('/registrar-pedido-varejo');
  });

  it('pushes Produtos after selecting a client', async () => {
    const renderer = renderStep('client');
    await selectClientAndPushProducts(renderer);

    expectNoRetailStepIndicator(renderer);
    expect(findNodes(renderer, 'premium-screen')[0].props.overlayHeader.props.title).toBeNull();
    expectRetailLargeTitle(renderer, 'Produtos');
    expect(findNodes(renderer, 'premium-screen')[0].props.progressiveBlur).toBe(true);
    expect(findNodes(renderer, 'native-button').some((node) => node.props.label === 'Voltar')).toBe(
      false,
    );
  });

  it('prefetches active product cost contexts when the combined Registrar Retail opens', () => {
    mockPathname = '/registrar-pedido-varejo';
    renderCombinedRegistrar();

    expect(mockPrefetchForOrder).toHaveBeenCalledWith(['product-1', 'product-2'], '2026-09-15');
  });

  it('renders Cliente and Produtos together with the Details footer above only the safe area', () => {
    mockPathname = '/registrar-pedido-varejo';
    const renderer = renderCombinedRegistrar();
    const screen = findNodes(renderer, 'progressive-collapsible-screen')[0];
    const cards = findNodes(renderer, 'premium-card');
    const footer = findNodes(renderer, 'sticky-action-footer')[0];
    const blur = findNodes(renderer, 'progressive-blur')[0];

    expectRetailLargeTitle(renderer, 'Novo pedido');
    expect(screen.props.compactTitle).toBe('Novo pedido');
    expect(screen.props.nativeHeader).toBe(true);
    expect(cards).toHaveLength(2);
    expect(cards.map((card) => collectText(card).split(' ')[0])).toEqual(['Cliente', 'Produtos']);
    expect(
      findNodes(renderer, 'native-button').some((node) => node.props.label === 'Novo pedido'),
    ).toBe(false);
    expect(findNodes(renderer, 'search-bar')).toHaveLength(1);
    expect(findNodes(renderer, 'search-bar')[0].props.placeholder).toBe('Buscar cliente');
    expect(findNodes(renderer, 'native-dropdown')).toHaveLength(1);
    expect(findNodes(renderer, 'native-dropdown')[0].props.disabled).toBe(false);
    expect(screen.props.scrollViewProps.keyboardShouldPersistTaps).toBe('handled');
    expect(collectText(renderer.root)).toContain('Novo cliente');
    const continueButton = findButton(renderer, 'Continuar');
    expect(continueButton.props.disabled).toBe(true);
    expect(continueButton.props.gateDisabledAction).toBe(true);
    expect(continueButton.props.haptic).toBe('none');
    expect(footer.props.bottomOffset).toBeUndefined();
    expect(footer.props.height).toBe(82);
    expect(blur.props.height).toBe(82);
    expect(screen.props.scrollContentContainerStyle.paddingBottom).toBe(106);
    expect(screen.props.scrollContentContainerStyle.paddingHorizontal).toBe(0);
    expect(blur.props.style.bottom).toBe(0);
  });

  it('filters active Retail clients locally, ignoring case and accents, and reports no matches', () => {
    mockCatalog.clients = [
      { ...mockCatalog.clients[0], clientId: 'client-andre-1', name: 'André Marques' },
      { ...mockCatalog.clients[0], clientId: 'client-andre-2', name: 'André Silva' },
      { ...mockCatalog.clients[0], clientId: 'client-cafe', name: 'Café Portugal' },
    ];
    const renderer = renderCombinedRegistrar();

    expect(findNodes(renderer, 'search-bar')[0].props.placeholder).toBe('Buscar cliente');
    expect(findTestId(renderer, 'retail-client-result-client-andre-1')).toHaveLength(0);

    searchCombinedClient(renderer, '  ANDRE  ');
    expect(collectText(renderer.root)).toContain('André Marques');
    expect(collectText(renderer.root)).toContain('André Silva');
    expect(collectText(renderer.root)).not.toContain('Café Portugal');

    searchCombinedClient(renderer, 'cliente inexistente');
    expect(collectText(renderer.root)).toContain('Nenhum cliente encontrado');
  });

  it('selects a searched client through the existing handler and reflects the selected name', () => {
    mockCatalog.clients = [
      { ...mockCatalog.clients[0], clientId: 'client-andre', name: 'André Marques' },
    ];
    const renderer = renderCombinedRegistrar();

    selectCombinedClient(renderer, 'client-andre', 'andre');

    expect(observedFlow?.draft.clientId).toBe('client-andre');
    expect(observedFlow?.draft.deliveryAddressSnapshot).toBe('Rua Principal, 10');
    expect(observedFlow?.draft.deliveryFee).toBe('12,00');
    expect(findNodes(renderer, 'search-bar')[0].props.value).toBe('André Marques');
    expect(findTestId(renderer, 'retail-client-result-client-andre')).toHaveLength(0);
  });

  it('clears only the selected client from the SearchBar and preserves product draft data', async () => {
    mockCatalog.clients = [
      { ...mockCatalog.clients[0], clientId: 'client-1', name: 'Cliente Varejo' },
      {
        ...mockCatalog.clients[0],
        address: 'Rua Fernanda, 25',
        clientId: 'client-2',
        defaultDeliveryFee: 20,
        name: 'Fernanda Rigatti',
      },
    ];
    const renderer = renderCombinedRegistrar();
    selectCombinedClient(renderer);

    await act(async () => {
      await findNodes(renderer, 'native-dropdown')[0].props.onValueChange('product-1');
    });
    act(() => {
      observedFlow?.updateLineQuantity('product-1', '3');
    });

    expect(findNodes(renderer, 'search-bar')[0].props.value).toBe('Cliente Varejo');
    expect(observedFlow?.draft.clientId).toBe('client-1');
    const preservedLineItems = [...observedFlow!.draft.lineItems];
    const preservedTotals = observedFlow?.draftTotals;
    const preservedCostErrors = { ...observedFlow!.productCostErrors };

    act(() => findNodes(renderer, 'search-clear-button')[0].props.onPress());

    expect(findNodes(renderer, 'search-bar')[0].props.value).toBe('');
    expect(findNodes(renderer, 'search-bar')[0].props.placeholder).toBe('Buscar cliente');
    expect(observedFlow?.draft.clientId).toBe('');
    expect(observedFlow?.draft.deliveryAddressSnapshot).toBe('Rua Principal, 10');
    expect(observedFlow?.draft.deliveryFee).toBe('12,00');
    expect(observedFlow?.draft.lineItems).toEqual(preservedLineItems);
    expect(observedFlow?.draft.lineItems).toEqual([{ productId: 'product-1', quantity: '3' }]);
    expect(observedFlow?.draftTotals).toEqual(preservedTotals);
    expect(observedFlow?.productCostErrors).toEqual(preservedCostErrors);
    expect(findButton(renderer, 'Continuar').props.disabled).toBe(true);

    searchCombinedClient(renderer, 'Fernanda');
    act(() => findTestId(renderer, 'retail-client-result-client-2')[0].props.onPress());

    expect(observedFlow?.draft.clientId).toBe('client-2');
    expect(observedFlow?.draft.lineItems).toEqual(preservedLineItems);
    expect(findNodes(renderer, 'search-bar')[0].props.value).toBe('Fernanda Rigatti');
    expect(findButton(renderer, 'Continuar').props.disabled).toBe(false);
  });

  it('opens Retail client creation from the native toolbar using the Atacado symbol and label', () => {
    const renderer = renderCombinedRegistrar();
    const toolbarButton = findNodes(renderer, 'stack-toolbar-button')[0];

    expect(toolbarButton.props.accessibilityLabel).toBe('Adicionar cliente');
    expect(toolbarButton.props.separateBackground).toBe(false);
    expect(findNodes(renderer, 'stack-toolbar-icon')[0].props.sf).toBe('person.badge.plus');
    expect(collectText(renderer.root)).toContain('Novo cliente');
    act(() => toolbarButton.props.onPress());
    expect(mockRouter.push).toHaveBeenLastCalledWith('/registrar-pedido-varejo/novo-cliente');
  });

  it('keeps user-edited address and delivery fee when selecting a Retail client', () => {
    mockCatalog.clients = [
      { ...mockCatalog.clients[0], clientId: 'client-new', name: 'Ana Retail' },
    ];
    const renderer = renderCombinedRegistrar();
    act(() => {
      observedFlow?.updateDraft('deliveryAddressSnapshot', 'Endereço editado');
      observedFlow?.updateDraft('deliveryFee', '28,00');
    });

    selectCombinedClient(renderer, 'client-new', 'ana');

    expect(observedFlow?.draft.deliveryAddressSnapshot).toBe('Endereço editado');
    expect(observedFlow?.draft.deliveryFee).toBe('28,00');
  });

  it.each([
    ['light', '#FEFFFF'],
    ['dark', '#0C0C0E'],
  ] as const)('uses the semantic card surface in %s mode', (mode, expectedSurface) => {
    mockPathname = '/registrar-pedido-varejo';
    mockResolvedMode = mode;
    const renderer = renderCombinedRegistrar();
    const cards = findNodes(renderer, 'premium-card');

    expect(cards).toHaveLength(2);
    expect(StyleSheet.flatten(cards[0].props.style)?.backgroundColor).toBe(expectedSurface);
    expect(StyleSheet.flatten(cards[1].props.style)?.backgroundColor).toBe(expectedSurface);
  });

  it.each([
    ['light', '#F7F7F7'],
    ['dark', '#242426'],
  ] as const)(
    'uses the expected added-product surface and card radius in %s mode',
    async (mode, surface) => {
      mockResolvedMode = mode;
      const renderer = renderCombinedRegistrar();
      await act(async () => {
        await findNodes(renderer, 'native-dropdown')[0].props.onValueChange('product-1');
      });

      const productContainer = findNodes(renderer, 'View').find((node) => {
        const style = StyleSheet.flatten(node.props.style);
        return style?.padding === 12 && style?.gap === 12;
      });
      const productStyle = StyleSheet.flatten(productContainer?.props.style);

      expect(productContainer).toBeDefined();
      expect(productStyle).toMatchObject({
        backgroundColor: surface,
        borderRadius: 20,
      });
      expect(collectText(productContainer!)).toContain('Cesta Café');
      expect(findButton(renderer, 'Remover').props.accessibilityLabel).toBe('Remover Cesta Café');
    },
  );

  it('uses the shared client/product handlers, blocks invalid quantity and navigates only after validation', async () => {
    mockPathname = '/registrar-pedido-varejo';
    const renderer = renderCombinedRegistrar();
    selectCombinedClient(renderer);
    expect(observedFlow?.draft.clientId).toBe('client-1');
    expect(observedFlow?.draft.deliveryAddressSnapshot).toBe('Rua Principal, 10');
    expect(observedFlow?.draft.deliveryFee).toBe('12,00');

    const productDropdown = findNodes(renderer, 'native-dropdown')[0];
    expect(productDropdown.props.disabled).toBe(false);
    await act(async () => {
      await productDropdown.props.onValueChange('product-1');
    });
    await act(async () => {
      await findNodes(renderer, 'native-dropdown')[0].props.onValueChange('product-1');
    });
    expect(observedFlow?.draft.lineItems).toEqual([{ productId: 'product-1', quantity: '2' }]);
    expect(findNodes(renderer, 'native-text-field')[0].props.value).toBe('2');

    act(() => {
      findNodes(renderer, 'native-text-field')[0].props.onChangeText('0');
    });
    expect(findButton(renderer, 'Continuar').props.disabled).toBe(true);
    mockNativeButtonHaptic.mockClear();
    act(() => findButton(renderer, 'Continuar').props.onPress());
    expect(mockNativeButtonHaptic).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalledWith('/registrar-pedido-varejo/detalhes');

    act(() => {
      findNodes(renderer, 'native-text-field')[0].props.onChangeText('3');
    });
    expect(findButton(renderer, 'Continuar').props.disabled).toBe(false);
    mockNativeButtonHaptic.mockClear();
    await act(async () => {
      findButton(renderer, 'Continuar').props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockPrepareForOrder).toHaveBeenCalledWith(['product-1'], {
      referenceDate: '2026-09-15',
      refresh: true,
    });
    expect(mockNativeButtonHaptic).toHaveBeenCalledWith('light');
    expect(mockRouter.push).toHaveBeenLastCalledWith('/registrar-pedido-varejo/detalhes');

    act(() => findButton(renderer, 'Remover').props.onPress());
    expect(observedFlow?.draft.lineItems).toHaveLength(0);
    expect(findButton(renderer, 'Continuar').props.disabled).toBe(true);
  });

  it('allows adding a product before selecting a client and preserves it after selection', async () => {
    mockPathname = '/registrar-pedido-varejo';
    const renderer = renderCombinedRegistrar();
    const productDropdown = findNodes(renderer, 'native-dropdown')[0];

    expect(productDropdown.props.disabled).toBe(false);
    await act(async () => {
      await productDropdown.props.onValueChange('product-1');
    });
    expect(observedFlow?.draft.clientId).toBe('');
    expect(observedFlow?.draft.lineItems).toEqual([{ productId: 'product-1', quantity: '1' }]);
    expect(findButton(renderer, 'Continuar').props.disabled).toBe(true);

    selectCombinedClient(renderer);

    expect(observedFlow?.draft.clientId).toBe('client-1');
    expect(observedFlow?.draft.lineItems).toEqual([{ productId: 'product-1', quantity: '1' }]);
    expect(findButton(renderer, 'Continuar').props.disabled).toBe(false);
  });

  it('allows changing the selected client without removing products from the draft', async () => {
    mockCatalog.clients = [
      { ...mockCatalog.clients[0], clientId: 'client-1', name: 'Cliente Varejo' },
      { ...mockCatalog.clients[0], clientId: 'client-2', name: 'Outro Cliente' },
    ];
    const renderer = renderCombinedRegistrar();
    selectCombinedClient(renderer, 'client-1', 'Cliente');
    await act(async () => {
      await findNodes(renderer, 'native-dropdown')[0].props.onValueChange('product-1');
    });

    selectCombinedClient(renderer, 'client-2', 'Outro');

    expect(observedFlow?.draft.clientId).toBe('client-2');
    expect(observedFlow?.draft.lineItems).toEqual([{ productId: 'product-1', quantity: '1' }]);
  });

  it('keeps the combined CTA blocked with no products or while product cost validation is pending/failed', async () => {
    mockPathname = '/registrar-pedido-varejo';
    mockCatalog.products = [];
    const emptyRenderer = renderCombinedRegistrar();
    selectCombinedClient(emptyRenderer);
    expect(findButton(emptyRenderer, 'Continuar').props.disabled).toBe(true);
    expect(collectText(emptyRenderer.root)).toContain('Cadastre um produto Varejo');
    act(() => emptyRenderer.unmount());

    mockCatalog.products = products;
    let resolvePreparation!: (catalog: typeof mockOrderCatalog) => void;
    mockPrepareForOrder.mockImplementationOnce(
      () => new Promise<typeof mockOrderCatalog>((resolve) => (resolvePreparation = resolve)),
    );
    const renderer = renderCombinedRegistrar();
    let addProduct!: Promise<void>;
    await act(async () => {
      addProduct = findNodes(renderer, 'native-dropdown')[0].props.onValueChange('product-1');
      await Promise.resolve();
    });
    expect(observedFlow?.draft.clientId).toBe('');
    expect(observedFlow?.draft.lineItems).toHaveLength(1);
    expect(findButton(renderer, 'Continuar').props.disabled).toBe(true);
    selectCombinedClient(renderer);
    await act(async () => {
      resolvePreparation(mockOrderCatalog);
      await addProduct;
    });
    expect(findButton(renderer, 'Continuar').props.disabled).toBe(false);

    mockPrepareForOrder.mockResolvedValueOnce({
      ...mockOrderCatalog,
      products: [{ ...products[0], costMode: undefined }, products[1]],
    });
    await act(async () => {
      await findNodes(renderer, 'native-dropdown')[0].props.onValueChange('product-1');
    });
    expect(findButton(renderer, 'Continuar').props.disabled).toBe(true);
    expect(collectText(renderer.root)).toContain(
      'Configure o modo de custo deste produto no Catálogo Varejo.',
    );
    expect(mockRouter.push).not.toHaveBeenCalledWith('/registrar-pedido-varejo/detalhes');
  });

  it('preserves the draft from Novo pedido through Details and back, then clears on exit', async () => {
    mockPathname = '/registrar-pedido-varejo';
    const renderer = renderCombinedRegistrar();
    selectCombinedClient(renderer);
    await act(async () => {
      await findNodes(renderer, 'native-dropdown')[0].props.onValueChange('product-1');
    });
    expect(observedFlow?.draft.clientId).toBe('client-1');
    expect(observedFlow?.draft.lineItems).toHaveLength(1);

    mockPathname = '/registrar-pedido-varejo/novo-cliente';
    updateCombinedRegistrar(renderer);
    expect(observedFlow?.draft.clientId).toBe('client-1');
    expect(observedFlow?.draft.lineItems).toHaveLength(1);

    mockPathname = '/registrar-pedido-varejo/detalhes';
    updateCombinedRegistrar(renderer);
    expect(observedFlow?.draft.clientId).toBe('client-1');
    expect(observedFlow?.draft.lineItems).toHaveLength(1);

    mockPathname = '/registrar-pedido-varejo';
    updateCombinedRegistrar(renderer);
    expect(observedFlow?.draft.clientId).toBe('client-1');
    expect(observedFlow?.draft.lineItems).toHaveLength(1);

    mockPathname = '/registrar';
    updateCombinedRegistrar(renderer);
    expect(observedFlow?.draft.clientId).toBe('');
    expect(observedFlow?.draft.lineItems).toHaveLength(0);
  });

  it('clears a populated draft when AppMode changes from Retail to Wholesale', async () => {
    mockPathname = '/registrar-pedido-varejo';
    const renderer = renderCombinedRegistrar();
    selectCombinedClient(renderer);
    await act(async () => {
      await findNodes(renderer, 'native-dropdown')[0].props.onValueChange('product-1');
    });
    expect(observedFlow?.draft.clientId).toBe('client-1');
    expect(observedFlow?.draft.lineItems).toHaveLength(1);

    mockAppMode.mode = 'wholesale';
    updateCombinedRegistrar(renderer);
    expect(observedFlow?.draft.clientId).toBe('');
    expect(observedFlow?.draft.lineItems).toHaveLength(0);
  });

  it('does not prefetch product costs while idle on the Registrar tab', () => {
    mockPathname = '/registrar';
    renderCombinedRegistrar();

    expect(mockPrefetchForOrder).not.toHaveBeenCalled();
  });

  it('keeps the Products Continue CTA undimmed and gates it until a valid product is added', async () => {
    const renderer = renderStep('client');
    const clientContinueButton = findButton(renderer, 'Continuar');
    expectRetailPrimaryButton(clientContinueButton);
    expect(clientContinueButton.props.gateDisabledAction).toBe(true);
    const clientVisualProps = {
      backgroundColor: clientContinueButton.props.backgroundColor,
      color: clientContinueButton.props.color,
      controlSize: clientContinueButton.props.controlSize,
      haptic: clientContinueButton.props.haptic,
      horizontalPadding: clientContinueButton.props.horizontalPadding,
      minHeight: clientContinueButton.props.minHeight,
      minWidth: clientContinueButton.props.minWidth,
      variant: clientContinueButton.props.variant,
    };

    await selectClientAndPushProducts(renderer);
    const productsContinueButton = findButton(renderer, 'Continuar');
    expectRetailPrimaryButton(productsContinueButton);
    expect(productsContinueButton.props).toEqual(
      expect.objectContaining({
        accessibilityHint: 'Adicione ao menos um produto válido para continuar.',
        accessibilityValue: 'Indisponível',
        disabled: true,
        gateDisabledAction: true,
        ...clientVisualProps,
      }),
    );

    let nativeButtonRenderer!: ReactTestRenderer;
    act(() => {
      nativeButtonRenderer = create(
        createElement(NativeButtonSwiftUI, productsContinueButton.props as NativeButtonProps),
      );
    });
    const disabledNativeButton = findNodes(nativeButtonRenderer, 'swiftui-button')[0];
    expect(
      (disabledNativeButton.props.modifiers as { name: string }[]).some(
        (modifier) => modifier.name === 'disabled',
      ),
    ).toBe(false);

    mockRouter.push.mockClear();
    mockPrepareForOrder.mockClear();
    mockNativeButtonHaptic.mockClear();
    act(() => disabledNativeButton.props.onPress());
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(mockPrepareForOrder).not.toHaveBeenCalled();
    expect(mockNativeButtonHaptic).not.toHaveBeenCalled();
    expect(collectText(renderer.root)).not.toContain('Adicione ao menos um produto ao pedido.');

    await act(async () => {
      await findNodes(renderer, 'native-dropdown')[0].props.onValueChange('product-1');
    });

    const enabledContinueButton = findButton(renderer, 'Continuar');
    expectRetailPrimaryButton(enabledContinueButton);
    expect(enabledContinueButton.props).toEqual(
      expect.objectContaining({
        accessibilityHint: undefined,
        accessibilityValue: undefined,
        disabled: false,
        gateDisabledAction: true,
        ...clientVisualProps,
      }),
    );

    act(() => {
      nativeButtonRenderer.update(
        createElement(NativeButtonSwiftUI, enabledContinueButton.props as NativeButtonProps),
      );
    });
    mockPrepareForOrder.mockClear();
    mockNativeButtonHaptic.mockClear();
    await act(async () => {
      findNodes(nativeButtonRenderer, 'swiftui-button')[0].props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockNativeButtonHaptic).toHaveBeenCalledWith('light');
    expect(mockPrepareForOrder).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/registrar-pedido-varejo/detalhes');
  });

  it('uses the approved primary CTA pattern on all four Retail Order steps', async () => {
    const renderer = renderStep('client');
    expectNoRetailStepIndicator(renderer);
    expectRetailPrimaryButton(findButton(renderer, 'Continuar'));

    await selectClientAndPushProducts(renderer);
    expectNoRetailStepIndicator(renderer);
    await act(async () => {
      await findNodes(renderer, 'native-dropdown')[0].props.onValueChange('product-1');
    });
    expectRetailPrimaryButton(findButton(renderer, 'Continuar'));

    await act(async () => {
      findButton(renderer, 'Continuar').props.onPress();
      await Promise.resolve();
    });
    updateStep(renderer, 'details');
    expectNoRetailStepIndicator(renderer);
    expectRetailLargeTitle(renderer, 'Detalhes');
    expectRetailPrimaryButton(findButton(renderer, 'Ver resumo'));
    expect(findButton(renderer, 'Ver resumo').props).toEqual(
      expect.objectContaining({ gateDisabledAction: true }),
    );

    await act(async () => {
      findButton(renderer, 'Ver resumo').props.onPress();
      await Promise.resolve();
    });
    updateStep(renderer, 'summary');
    expectNoRetailStepIndicator(renderer);
    expectRetailLargeTitle(renderer, 'Resumo');
    expectRetailPrimaryButton(findButton(renderer, 'Finalizar pedido'));
  });

  it('adds products immediately from the native selector and resets it after each inclusion', async () => {
    const renderer = renderStep('client');
    await selectClientAndPushProducts(renderer);
    const productDropdown = findNodes(renderer, 'native-dropdown')[0];

    expect(productDropdown.props.accessibilityLabel).toBe('Selecionar produto');
    expect(productDropdown.props.label).toBe('Selecionar');
    expect(productDropdown.props.selectedValue).toBe('');
    expect(
      findNodes(renderer, 'native-button').some((node) => node.props.label === 'Adicionar produto'),
    ).toBe(false);

    mockNativeButtonHaptic.mockClear();
    await act(async () => {
      await productDropdown.props.onValueChange('');
    });
    expect(findNodes(renderer, 'native-text-field')).toHaveLength(0);
    expect(mockNativeButtonHaptic).not.toHaveBeenCalled();

    await act(async () => {
      await productDropdown.props.onValueChange('product-1');
    });
    expect(mockPrepareForOrder).toHaveBeenLastCalledWith(['product-1'], {
      referenceDate: '2026-09-15',
      refresh: false,
    });
    expect(findNodes(renderer, 'native-text-field')).toHaveLength(1);
    expect(findNodes(renderer, 'native-text-field')[0].props.value).toBe('1');
    expect(collectText(renderer.root)).toContain('Cesta Café');
    expect(findNodes(renderer, 'native-dropdown')[0].props.label).toBe('Selecionar');
    expect(findNodes(renderer, 'native-dropdown')[0].props.selectedValue).toBe('');
    expect(collectText(renderer.root)).not.toContain('Validando custo do produto…');

    await act(async () => {
      await findNodes(renderer, 'native-dropdown')[0].props.onValueChange('product-2');
    });
    expect(mockPrepareForOrder).toHaveBeenLastCalledWith(['product-2'], {
      referenceDate: '2026-09-15',
      refresh: false,
    });
    expect(findNodes(renderer, 'native-text-field')).toHaveLength(2);
    expect(collectText(renderer.root)).toContain('Cesta Chocolate');
    expect(findNodes(renderer, 'native-dropdown')[0].props.label).toBe('Selecionar');
    expect(findNodes(renderer, 'native-dropdown')[0].props.selectedValue).toBe('');

    await act(async () => {
      await findNodes(renderer, 'native-dropdown')[0].props.onValueChange('product-1');
    });
    expect(findNodes(renderer, 'native-text-field')).toHaveLength(2);
    expect(findNodes(renderer, 'native-text-field')[0].props.value).toBe('2');
  });

  it('keeps a cold cost validation internal while the selected product is already visible', async () => {
    let resolvePreparation!: (catalog: typeof mockOrderCatalog) => void;
    const pendingPreparation = new Promise<typeof mockOrderCatalog>((resolve) => {
      resolvePreparation = resolve;
    });
    mockPrepareForOrder.mockImplementationOnce(() => pendingPreparation);

    const renderer = renderStep('client');
    await selectClientAndPushProducts(renderer);

    let addProduct!: Promise<void>;
    await act(async () => {
      addProduct = findNodes(renderer, 'native-dropdown')[0].props.onValueChange('product-1');
      await Promise.resolve();
    });

    expect(collectText(renderer.root)).toContain('Cesta Café');
    expect(collectText(renderer.root)).not.toContain('Validando custo do produto…');
    expect(findButton(renderer, 'Continuar').props.disabled).toBe(true);

    await act(async () => {
      resolvePreparation(mockOrderCatalog);
      await addProduct;
    });

    expect(findButton(renderer, 'Continuar').props.disabled).toBe(false);
  });

  it('shows the cost problem in the product card and blocks Details', async () => {
    mockPrepareForOrder.mockResolvedValueOnce({
      ...mockOrderCatalog,
      products: [{ ...products[0], costMode: undefined }, products[1]],
    });
    const renderer = renderStep('client');
    await selectClientAndPushProducts(renderer);
    await act(async () => {
      await findNodes(renderer, 'native-dropdown')[0].props.onValueChange('product-1');
    });

    expect(collectText(renderer.root)).toContain(
      'Configure o modo de custo deste produto no Catálogo Varejo.',
    );
    expect(findButton(renderer, 'Continuar').props.disabled).toBe(true);
  });

  it('direct cost without a linked item points to the product configuration', async () => {
    const invalidProducts = [{ ...products[0], directCostItemId: undefined }, products[1]];
    mockCatalog.products = invalidProducts;
    mockPrepareForOrder.mockResolvedValueOnce({
      ...mockOrderCatalog,
      products: invalidProducts,
    });
    const renderer = renderStep('client');
    await selectClientAndPushProducts(renderer);
    await act(async () => {
      await findNodes(renderer, 'native-dropdown')[0].props.onValueChange('product-1');
    });

    expect(collectText(renderer.root)).toContain(
      'Selecione o item de custo direto no Catálogo Varejo.',
    );
  });

  it('direct cost without historical entry points to Costs with item and date', async () => {
    mockPrepareForOrder.mockResolvedValueOnce({
      ...mockOrderCatalog,
      costEntriesByItemId: new Map([['cost-1', []]]),
    });
    const renderer = renderStep('client');
    await selectClientAndPushProducts(renderer);
    await act(async () => {
      await findNodes(renderer, 'native-dropdown')[0].props.onValueChange('product-1');
    });

    expect(collectText(renderer.root)).toContain(
      'Não há custo histórico válido para Custo em 15/09/2026. Cadastre uma entrada em Custos com data igual ou anterior à data do pedido.',
    );
  });

  it('pushes Details only after the product cost is valid', async () => {
    const renderer = renderStep('client');
    await selectClientAndPushProducts(renderer);
    await addProductAndPushDetails(renderer);

    expect(findNodes(renderer, 'premium-screen')).toHaveLength(0);
    const screen = findNodes(renderer, 'progressive-collapsible-screen')[0];
    expect(screen.props).toEqual(
      expect.objectContaining({
        compactTitle: 'Detalhes',
        contentGap: 0,
        contentTopInset: 74,
        largeTitleContainerStyle: expect.objectContaining({ minHeight: 44 }),
        nativeHeader: true,
        scrollContentContainerStyle: { paddingBottom: 170 },
        scrollViewProps: { keyboardShouldPersistTaps: 'handled' },
      }),
    );
    expect(screen.props).not.toHaveProperty('nativeTabRoot');
    expectRetailLargeTitle(renderer, 'Detalhes');
    const detailCards = findNodes(renderer, 'premium-card');
    expect(detailCards).toHaveLength(4);
    expect(detailCards.map((card) => collectText(card))).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Pedido'),
        expect.stringContaining('Entrega'),
        expect.stringContaining('Informações opcionais'),
        expect.stringContaining('Valores'),
      ]),
    );
    detailCards.forEach((card) => {
      expect(card.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ width: '100%' }),
          expect.objectContaining({ backgroundColor: '#FEFFFF' }),
        ]),
      );
    });
    expect(collectText(renderer.root)).toContain('Data do pedido');
    expect(collectText(renderer.root)).toContain('Taxa de entrega cobrada');
    expect(collectText(renderer.root)).toContain('Custo real da entrega');
    expect(findNodes(renderer, 'native-date-picker')).toHaveLength(2);
    expect(findNodes(renderer, 'native-text-field')).toHaveLength(7);
    expectRetailPrimaryButton(findButton(renderer, 'Ver resumo'));
    const detailsFooter = findNodes(renderer, 'sticky-action-footer')[0];
    expect(
      detailsFooter.findAll(
        (node) => String(node.type) === 'native-button' && node.props.label === 'Ver resumo',
      ),
    ).toHaveLength(1);
    const bottomBlur = findNodes(renderer, 'progressive-blur');
    expect(bottomBlur).toHaveLength(1);
    expect(bottomBlur[0].props).toEqual(
      expect.objectContaining({
        edge: 'bottom',
        fadeStart: 8,
        height: 82,
        intensity: 30,
        style: { bottom: 0 },
      }),
    );
    expect(screen.props.scrollContentContainerStyle.paddingBottom).toBe(170);
    expect(
      detailCards.some(
        (card) =>
          card.findAll(
            (node) => String(node.type) === 'native-button' && node.props.label === 'Ver resumo',
          ).length > 0,
      ),
    ).toBe(false);
    expect(findNodes(renderer, 'native-button').some((node) => node.props.label === 'Voltar')).toBe(
      false,
    );
  });

  it('preserves the draft through Details and renders a non-empty Summary', async () => {
    const renderer = renderStep('client');
    await selectClientAndPushProducts(renderer);
    await addProductAndPushDetails(renderer);
    await act(async () => {
      findButton(renderer, 'Ver resumo').props.onPress();
      await Promise.resolve();
    });
    updateStep(renderer, 'summary');

    expect(findNodes(renderer, 'premium-screen')).toHaveLength(0);
    const summaryScreen = findNodes(renderer, 'progressive-collapsible-screen')[0];
    expect(summaryScreen.props).toEqual(
      expect.objectContaining({
        compactTitle: 'Resumo',
        contentGap: 0,
        contentTopInset: 74,
        nativeHeader: true,
        scrollContentContainerStyle: { paddingBottom: 88 },
      }),
    );
    expect(summaryScreen.props).not.toHaveProperty('nativeTabRoot');
    expect(collectText(renderer.root)).toContain('Cliente Varejo');
    expect(collectText(renderer.root)).toContain('Cesta Café');
    expect(collectText(renderer.root)).toContain('Subtotal dos produtos');
    expect(collectText(renderer.root)).toContain('Total cobrado');
    expect(collectText(renderer.root)).not.toContain('Não foi possível calcular o resumo');
    const summaryCard = findNodes(renderer, 'premium-card').find(
      (card) =>
        card.findAll(
          (node) =>
            String(node.type) === 'native-button' && node.props.label === 'Finalizar pedido',
        ).length > 0,
    );
    expect(summaryCard).toBeDefined();
  });

  it('finalizes from Summary without creating a payment, then resets and dismisses the wizard', async () => {
    const renderer = renderStep('client');
    await selectClientAndPushProducts(renderer);
    await addProductAndPushDetails(renderer);
    await act(async () => {
      findButton(renderer, 'Ver resumo').props.onPress();
      await Promise.resolve();
    });
    updateStep(renderer, 'summary');
    await act(async () => {
      findButton(renderer, 'Finalizar pedido').props.onPress();
      await Promise.resolve();
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const flowProviderSource = readFileSync(
      resolve(process.cwd(), 'src/features/retail-orders/components/RetailOrderFlowProvider.tsx'),
      'utf8',
    );
    expect(flowProviderSource).not.toContain('useRetailOrderPayments');
    expect(flowProviderSource).not.toContain('registerForOrder');
    expect(findNodes(renderer, 'native-dialog')[0].props.visible).toBe(true);
    await act(async () => {
      findNodes(renderer, 'native-dialog')[0].props.actions[0].onPress();
    });
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/registrar');
    expect(mockRouter.dismissAll).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalledWith('/registrar-pedido-varejo');
    expect(collectText(renderer.root)).not.toContain('Pagamento inicial');

    mockPathname = '/registrar';
    updateStep(renderer, 'client');
    expect(observedFlow?.draft.clientId).toBe('');
    expect(observedFlow?.draft.lineItems).toHaveLength(0);
  });

  it('keeps the draft in Summary when order creation fails', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Falha ao salvar'));
    const renderer = renderStep('client');
    await selectClientAndPushProducts(renderer);
    await addProductAndPushDetails(renderer);
    await act(async () => {
      findButton(renderer, 'Ver resumo').props.onPress();
      await Promise.resolve();
    });
    updateStep(renderer, 'summary');

    await act(async () => {
      findButton(renderer, 'Finalizar pedido').props.onPress();
      await Promise.resolve();
    });

    expect(findNodes(renderer, 'native-dialog')).toHaveLength(1);
    expect(findNodes(renderer, 'native-dialog')[0].props.visible).toBe(false);
    expect(collectText(renderer.root)).toContain('Falha ao salvar');
    expect(observedFlow?.draft.clientId).toBe('client-1');
    expect(observedFlow?.draft.lineItems).toHaveLength(1);
  });

  it('prevents double submit and keeps the draft visible after creation failure', async () => {
    let resolveCreate!: (orderId: string) => void;
    mockCreate.mockImplementationOnce(
      () => new Promise<string>((resolve) => (resolveCreate = resolve)),
    );
    const renderer = renderStep('client');
    await selectClientAndPushProducts(renderer);
    await addProductAndPushDetails(renderer);
    await act(async () => {
      findButton(renderer, 'Ver resumo').props.onPress();
      await Promise.resolve();
    });
    updateStep(renderer, 'summary');
    await act(async () => {
      findButton(renderer, 'Finalizar pedido').props.onPress();
      findButton(renderer, 'Finalizar pedido').props.onPress();
      await Promise.resolve();
    });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(findNodes(renderer, 'native-loading')[0]?.props.label).toBe('Salvando pedido…');

    await act(async () => {
      resolveCreate('order-1');
      await Promise.resolve();
    });
    expect(findNodes(renderer, 'native-dialog')[0].props.visible).toBe(true);
  });
});
