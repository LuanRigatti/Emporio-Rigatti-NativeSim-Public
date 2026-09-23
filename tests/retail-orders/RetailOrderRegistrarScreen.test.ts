/* eslint-disable @typescript-eslint/no-require-imports */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ReactNode, useEffect } from 'react';

import NativeButtonSwiftUI from '@/components/native/NativeButton/NativeButtonSwiftUI.ios';
import { RetailOrderRegistrarLauncher } from '@/features/retail-orders/components/RetailOrderRegistrarScreen';
import {
  RetailOrderFlowProvider,
  type RetailOrderFlowContextValue,
  type RetailOrderFlowStep,
  useRetailOrderFlow,
} from '@/features/retail-orders/components/RetailOrderFlowProvider';
import { RetailOrderStepScreen } from '@/features/retail-orders/components/RetailOrderStepScreen';
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
}));

jest.mock('@/providers', () => ({
  useAppSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

jest.mock('@/hooks/useRetailOrderCatalog', () => ({
  useRetailOrderCatalog: () => mockCatalog,
}));

jest.mock('@/hooks/useRetailOrders', () => ({
  useRetailOrders: () => ({ create: mockCreate }),
}));

jest.mock('@/theme', () => ({
  getCardSurfaceColor: jest.fn(() => '#FFFFFF'),
  useAppTheme: () => ({
    resolvedMode: 'light',
    theme: {
      colors: {
        background: '#F7F7F7',
        contrastContent: '#FFFFFF',
        contrastSurface: '#000000',
        danger: '#FF0000',
        surface: '#FFFFFF',
        surfaceMuted: '#F2F2F7',
        textPrimary: '#111111',
        textSecondary: '#666666',
      },
      layout: { screenHorizontalPadding: 24, tabBarHeight: 64 },
      radius: { md: 12, xl: 24 },
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
  triggerLightImpactHaptic: jest.fn(),
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
    observedFlow = undefined;
    mockRouter.dismissAll.mockClear();
    mockRouter.dismissTo.mockClear();
    mockRouter.push.mockClear();
    mockRouter.replace.mockClear();
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

  it('centers the initial retail card and uses the confirm-sized native CTA', () => {
    const renderer = renderRegistrarLauncher();
    const card = findNodes(renderer, 'premium-card').find((node) =>
      collectText(node).includes('Novo pedido'),
    );
    if (!card) throw new Error('Card inicial do Varejo não encontrado');

    expect(collectText(card)).toContain('Novo pedido');
    expect(collectText(card)).not.toContain('Novo pedido Varejo');
    expect(collectText(card)).not.toContain('Selecione cliente, produtos e condições da venda.');
    expect(card.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          paddingHorizontal: 20,
          paddingVertical: 16,
        }),
      ]),
    );

    const button = findButton(renderer, 'Novo pedido');
    expectRetailPrimaryButton(button);

    act(() => button.props.onPress());
    expect(mockRouter.push).toHaveBeenLastCalledWith('/registrar-pedido-varejo');
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

  it('preserves the safe redirect for an invalid deep entry', () => {
    renderStep('details');

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

  it('prefetches active product cost contexts when Produtos opens', () => {
    mockPathname = '/registrar-pedido-varejo/produtos';
    renderStep('products');

    expect(mockPrefetchForOrder).toHaveBeenCalledWith(['product-1', 'product-2'], '2026-09-15');
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

    expect(findNodes(renderer, 'premium-screen')[0].props.overlayHeader.props.title).toBeNull();
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
          expect.objectContaining({ backgroundColor: '#FFFFFF' }),
        ]),
      );
    });
    expect(collectText(renderer.root)).toContain('Data do pedido');
    expect(collectText(renderer.root)).toContain('Taxa de entrega cobrada');
    expect(collectText(renderer.root)).toContain('Custo real da entrega');
    expect(findNodes(renderer, 'native-date-picker')).toHaveLength(2);
    expect(findNodes(renderer, 'native-text-field')).toHaveLength(7);
    expectRetailPrimaryButton(findButton(renderer, 'Ver resumo'));
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
    expect(
      findNodes(renderer, 'premium-screen')[0].props.contentContainerStyle[1].paddingBottom,
    ).toBe(170);
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

    expect(collectText(renderer.root)).toContain('Cliente Varejo');
    expect(collectText(renderer.root)).toContain('Cesta Café');
    expect(collectText(renderer.root)).toContain('Subtotal dos produtos');
    expect(collectText(renderer.root)).toContain('Total cobrado');
    expect(collectText(renderer.root)).not.toContain('Não foi possível calcular o resumo');
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
    expect(mockRouter.dismissAll).toHaveBeenCalledTimes(1);
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalledWith('/registrar-pedido-varejo');
    expect(observedFlow?.draft.clientId).toBe('client-1');
    expect(observedFlow?.draft.lineItems).toHaveLength(1);
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
