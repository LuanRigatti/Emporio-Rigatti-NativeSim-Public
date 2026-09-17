/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ReactNode } from 'react';

import {
  RetailOrderFlowProvider,
  type RetailOrderFlowStep,
} from '@/features/retail-orders/components/RetailOrderFlowProvider';
import { RetailOrderStepScreen } from '@/features/retail-orders/components/RetailOrderStepScreen';

const mockRouter = {
  dismissTo: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
};
const mockCreate = jest.fn<Promise<string>, [unknown, unknown]>().mockResolvedValue('order-1');
const mockPrepareForOrder = jest.fn().mockResolvedValue({});
const mockRegisterForOrder = jest
  .fn<Promise<string>, [string, unknown]>()
  .mockResolvedValue('payment-1');

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
  usePathname: () => '/registrar-pedido-varejo',
  useRouter: () => mockRouter,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

jest.mock('@/components/layout', () => ({
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

jest.mock('@/hooks/useRetailOrderPayments', () => ({
  useRetailOrderPayments: () => ({ registerForOrder: mockRegisterForOrder }),
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
        danger: '#FF0000',
        surface: '#FFFFFF',
        surfaceMuted: '#F2F2F7',
        textPrimary: '#111111',
        textSecondary: '#666666',
      },
      layout: { screenHorizontalPadding: 24, tabBarHeight: 64 },
      radius: { md: 12, xl: 24 },
      spacing: {
        lg: 20,
        md: 16,
        sm: 8,
        xl: 24,
        xs: 4,
        xxl: 32,
      },
      typography: {
        body: {},
        footnote: {},
        headline: {},
        title2: {},
      },
    },
  }),
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

function collectText(node: ReactTestInstance): string {
  return node.children
    .map((child) => (typeof child === 'string' ? child : collectText(child)))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderStep(step: RetailOrderFlowStep): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      createElement(RetailOrderFlowProvider, null, createElement(RetailOrderStepScreen, { step })),
    );
  });
  return renderer;
}

function updateStep(renderer: ReactTestRenderer, step: RetailOrderFlowStep) {
  act(() => {
    renderer.update(
      createElement(RetailOrderFlowProvider, null, createElement(RetailOrderStepScreen, { step })),
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
    findNodes(renderer, 'native-dropdown')[0].props.onValueChange('product-1');
    await Promise.resolve();
  });
  await act(async () => {
    findButton(renderer, 'Adicionar produto').props.onPress();
    await Promise.resolve();
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
    mockRouter.dismissTo.mockClear();
    mockRouter.push.mockClear();
    mockRouter.replace.mockClear();
    mockCreate.mockClear().mockResolvedValue('order-1');
    mockPrepareForOrder.mockClear().mockResolvedValue(mockOrderCatalog);
    mockRegisterForOrder.mockClear().mockResolvedValue('payment-1');
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

  it('starts at Cliente without a NativeSheet and uses the native-stack page shell', () => {
    const renderer = renderStep('client');
    const premiumScreen = findNodes(renderer, 'premium-screen')[0];

    expect(findNodes(renderer, 'native-sheet')).toHaveLength(0);
    expect(premiumScreen.props.overlayHeader).toBeDefined();
    expect(premiumScreen.props.overlayHeader.props.title).toBe('Cliente');
    expect(premiumScreen.props.progressiveBlur).toBe(true);
    expect(premiumScreen.props.scrollViewProps).toBeUndefined();
    expect(collectText(renderer.root)).toContain('Etapa 1 de 5');
    expect(findNodes(renderer, 'native-button').some((node) => node.props.label === 'Voltar')).toBe(
      false,
    );
    expect(premiumScreen.props.contentContainerStyle[1].paddingTop).toBeUndefined();
    expect(premiumScreen.props.contentContainerStyle[1].paddingBottom).toBe(88);
    expect(findNodes(renderer, 'premium-card')[0].props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ marginTop: 16 })]),
    );
  });

  it('pushes Produtos after selecting a client', async () => {
    const renderer = renderStep('client');
    await selectClientAndPushProducts(renderer);

    expect(collectText(renderer.root)).toContain('Etapa 2 de 5');
    expect(findNodes(renderer, 'premium-screen')[0].props.overlayHeader.props.title).toBe(
      'Produtos',
    );
    expect(findNodes(renderer, 'premium-screen')[0].props.progressiveBlur).toBe(true);
    expect(findNodes(renderer, 'native-button').some((node) => node.props.label === 'Voltar')).toBe(
      false,
    );
  });

  it('does not create a line item until the product is explicitly added', async () => {
    const renderer = renderStep('client');
    await selectClientAndPushProducts(renderer);

    await act(async () => {
      findNodes(renderer, 'native-dropdown')[0].props.onValueChange('product-1');
      await Promise.resolve();
    });
    expect(findNodes(renderer, 'native-text-field')).toHaveLength(0);

    await act(async () => {
      findButton(renderer, 'Adicionar produto').props.onPress();
      await Promise.resolve();
    });
    expect(findNodes(renderer, 'native-text-field')).toHaveLength(1);
    expect(collectText(renderer.root)).toContain('Cesta Café');
  });

  it('shows the cost problem in the product card and blocks Details', async () => {
    mockPrepareForOrder.mockResolvedValueOnce({
      ...mockOrderCatalog,
      products: [{ ...products[0], costMode: undefined }, products[1]],
    });
    const renderer = renderStep('client');
    await selectClientAndPushProducts(renderer);
    await act(async () => {
      findNodes(renderer, 'native-dropdown')[0].props.onValueChange('product-1');
      await Promise.resolve();
    });
    await act(async () => {
      findButton(renderer, 'Adicionar produto').props.onPress();
      await Promise.resolve();
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
      findNodes(renderer, 'native-dropdown')[0].props.onValueChange('product-1');
      await Promise.resolve();
    });
    await act(async () => {
      findButton(renderer, 'Adicionar produto').props.onPress();
      await Promise.resolve();
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
      findNodes(renderer, 'native-dropdown')[0].props.onValueChange('product-1');
      await Promise.resolve();
    });
    await act(async () => {
      findButton(renderer, 'Adicionar produto').props.onPress();
      await Promise.resolve();
    });

    expect(collectText(renderer.root)).toContain(
      'Não há custo histórico válido para Custo em 15/09/2026. Cadastre uma entrada em Custos com data igual ou anterior à data do pedido.',
    );
  });

  it('pushes Details only after the product cost is valid', async () => {
    const renderer = renderStep('client');
    await selectClientAndPushProducts(renderer);
    await addProductAndPushDetails(renderer);

    expect(findNodes(renderer, 'premium-screen')[0].props.overlayHeader.props.title).toBe(
      'Detalhes do pedido',
    );
    expect(collectText(renderer.root)).toContain('Data do pedido');
    expect(collectText(renderer.root)).toContain('Taxa de entrega cobrada');
    expect(collectText(renderer.root)).toContain('Custo real da entrega');
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

  it('pushes Payment with its financial context and has no content Back button', async () => {
    const renderer = renderStep('client');
    await selectClientAndPushProducts(renderer);
    await addProductAndPushDetails(renderer);
    await act(async () => {
      findButton(renderer, 'Ver resumo').props.onPress();
      await Promise.resolve();
    });
    updateStep(renderer, 'summary');
    await act(async () => {
      findButton(renderer, 'Continuar para pagamento').props.onPress();
      await Promise.resolve();
    });
    updateStep(renderer, 'payment');

    expect(collectText(renderer.root)).toContain('Total do pedido');
    expect(collectText(renderer.root)).toContain('A receber após este pagamento');
    expect(findNodes(renderer, 'native-button').some((node) => node.props.label === 'Voltar')).toBe(
      false,
    );
  });

  it('confirms without payment, shows success, and dismisses the wizard to Registrar', async () => {
    const renderer = renderStep('client');
    await selectClientAndPushProducts(renderer);
    await addProductAndPushDetails(renderer);
    await act(async () => {
      findButton(renderer, 'Ver resumo').props.onPress();
      await Promise.resolve();
    });
    updateStep(renderer, 'summary');
    await act(async () => {
      findButton(renderer, 'Continuar para pagamento').props.onPress();
      await Promise.resolve();
    });
    updateStep(renderer, 'payment');
    await act(async () => {
      findButton(renderer, 'Confirmar pedido').props.onPress();
      await Promise.resolve();
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockRegisterForOrder).not.toHaveBeenCalled();
    expect(findNodes(renderer, 'native-dialog')[0].props.visible).toBe(true);
    await act(async () => {
      findNodes(renderer, 'native-dialog')[0].props.actions[0].onPress();
    });
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/registrar');
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
      findButton(renderer, 'Continuar para pagamento').props.onPress();
      await Promise.resolve();
    });
    updateStep(renderer, 'payment');
    const paymentAmount = findNodes(renderer, 'native-text-field').find(
      (field) => field.props.accessibilityLabel === 'Valor do pagamento inicial',
    );
    act(() => paymentAmount?.props.onChangeText('30'));
    await act(async () => {
      findButton(renderer, 'Confirmar pedido').props.onPress();
      findButton(renderer, 'Confirmar pedido').props.onPress();
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

  it('preserves the pending order after payment failure and retries only the payment', async () => {
    mockRegisterForOrder.mockRejectedValueOnce(new Error('Falha no pagamento'));
    const renderer = renderStep('client');
    await selectClientAndPushProducts(renderer);
    await addProductAndPushDetails(renderer);
    await act(async () => {
      findButton(renderer, 'Ver resumo').props.onPress();
      await Promise.resolve();
    });
    updateStep(renderer, 'summary');
    await act(async () => {
      findButton(renderer, 'Continuar para pagamento').props.onPress();
      await Promise.resolve();
    });
    updateStep(renderer, 'payment');
    const paymentAmount = findNodes(renderer, 'native-text-field').find(
      (field) => field.props.accessibilityLabel === 'Valor do pagamento inicial',
    );
    act(() => paymentAmount?.props.onChangeText('1'));

    await act(async () => {
      findButton(renderer, 'Confirmar pedido').props.onPress();
      await Promise.resolve();
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockRegisterForOrder).toHaveBeenCalledTimes(1);
    expect(findNodes(renderer, 'native-dialog')[0].props.visible).toBe(false);
    expect(collectText(renderer.root)).toContain(
      'O pedido foi criado, mas o pagamento não foi registrado.',
    );
    expect(paymentAmount?.props.value).toBe('1');
    expect(findButton(renderer, 'Tentar registrar pagamento')).toBeDefined();

    mockRegisterForOrder.mockResolvedValueOnce('payment-retry');
    await act(async () => {
      findButton(renderer, 'Tentar registrar pagamento').props.onPress();
      await Promise.resolve();
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockRegisterForOrder).toHaveBeenCalledTimes(2);
    expect(findNodes(renderer, 'native-dialog')[0].props.visible).toBe(true);
    expect(
      findNodes(renderer, 'native-button').some(
        (button) => button.props.label === 'Tentar registrar pagamento',
      ),
    ).toBe(false);
  });
});
