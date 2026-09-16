/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ReactNode } from 'react';

import RetailOrderRegistrarScreen from '@/features/retail-orders/components/RetailOrderRegistrarScreen';

const mockRouterPush = jest.fn();
const mockCreate = jest.fn<Promise<string>, [unknown, unknown]>().mockResolvedValue('order-1');
const mockPrepareForOrder = jest.fn().mockResolvedValue({});
const mockRegisterForOrder = jest
  .fn<Promise<string>, [string, unknown]>()
  .mockResolvedValue('payment-1');

const mockCatalog = {
  categories: [{ categoryId: 'category-1', label: 'Cestas' }],
  clients: [
    {
      active: true,
      clientId: 'client-1',
      defaultDeliveryFee: 12,
      name: 'Cliente Varejo',
      phone: '99999-0000',
    },
    {
      active: true,
      clientId: 'client-2',
      defaultDeliveryFee: 20,
      name: 'Outro Cliente',
    },
  ],
  error: undefined,
  loading: false,
  prepareForOrder: mockPrepareForOrder,
  products: [
    {
      active: true,
      categoryId: 'category-1',
      productId: 'product-1',
      productName: 'Cesta Café',
      standardSalePrice: 100,
    },
    {
      active: true,
      categoryId: 'category-1',
      productId: 'product-2',
      productName: 'Cesta Chocolate',
      standardSalePrice: 50,
    },
  ],
};
const defaultClients = mockCatalog.clients;
const defaultProducts = mockCatalog.products;

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn() },
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

jest.mock('@/components/layout', () => ({
  NativeGlassHeader: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('native-glass-header', props);
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
  NativeSheet: ({ children, ...props }: { children?: ReactNode }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('native-sheet', props, children);
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
        contrastContent: '#FFFFFF',
        contrastSurface: '#000000',
        danger: '#FF0000',
        surface: '#FFFFFF',
        textPrimary: '#111111',
        textSecondary: '#666666',
      },
      radius: { xl: 24 },
      spacing: {
        lg: 20,
        md: 16,
        sm: 8,
        xl: 24,
        xs: 4,
        xxl: 32,
        xxs: 2,
        xxxl: 40,
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

jest.mock('@/utils/data', () => ({
  formatCurrency: (value: number) => `R$ ${value.toFixed(2)}`,
  normalizeClientKey: (value: string) => value.trim().toLowerCase(),
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
  todayIso: jest.fn(() => '2026-09-15'),
}));

jest.mock('@/utils/haptics', () => ({
  triggerLightImpactHaptic: jest.fn(),
}));

function findNodes(renderer: ReactTestRenderer, type: string): ReactTestInstance[] {
  return renderer.root.findAll((node) => String(node.type) === type);
}

function findButton(renderer: ReactTestRenderer, label: string): ReactTestInstance {
  const button = findNodes(renderer, 'native-button').find((node) => node.props.label === label);
  if (!button) throw new Error(`Botão não encontrado: ${label}`);
  return button;
}

function renderScreen(): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(createElement(RetailOrderRegistrarScreen));
  });
  return renderer;
}

async function openAndGoToDetails(renderer: ReactTestRenderer): Promise<void> {
  await act(async () => {
    findButton(renderer, 'Novo pedido').props.onPress();
    await Promise.resolve();
  });
  const clientPicker = findNodes(renderer, 'native-dropdown')[0];
  await act(async () => {
    clientPicker.props.onValueChange('client-1');
    await Promise.resolve();
  });
  expect(findNodes(renderer, 'native-dropdown')[0].props.label).toBe('Cliente Varejo');
  await act(async () => {
    findButton(renderer, 'Continuar').props.onPress();
    await Promise.resolve();
  });

  const productPicker = findNodes(renderer, 'native-dropdown')[0];
  await act(async () => {
    productPicker.props.onValueChange('product-1');
    await Promise.resolve();
  });
  await act(async () => {
    findButton(renderer, 'Adicionar produto').props.onPress();
    await Promise.resolve();
  });
  await act(async () => {
    findButton(renderer, 'Continuar').props.onPress();
    await Promise.resolve();
  });
}

async function goToPayment(renderer: ReactTestRenderer): Promise<void> {
  await openAndGoToDetails(renderer);
  await act(async () => {
    findButton(renderer, 'Ver resumo').props.onPress();
    await Promise.resolve();
  });
  await act(async () => {
    findButton(renderer, 'Continuar').props.onPress();
    await Promise.resolve();
  });
}

describe('RetailOrderRegistrarScreen', () => {
  beforeEach(() => {
    mockCatalog.clients = defaultClients;
    mockCatalog.products = defaultProducts;
    mockRouterPush.mockClear();
    mockCreate.mockClear().mockResolvedValue('order-1');
    mockPrepareForOrder.mockClear().mockResolvedValue({});
    mockRegisterForOrder.mockClear().mockResolvedValue('payment-1');
  });

  it('uses the client default delivery fee as the initial suggestion', async () => {
    const renderer = renderScreen();
    await openAndGoToDetails(renderer);

    const deliveryFee = findNodes(renderer, 'native-text-field').find(
      (field) => field.props.accessibilityLabel === 'Taxa de entrega cobrada',
    );
    expect(deliveryFee?.props.value).toBe('12');
  });

  it('does not overwrite manual fee or address edits when the client changes', async () => {
    const renderer = renderScreen();
    await openAndGoToDetails(renderer);
    const deliveryFee = findNodes(renderer, 'native-text-field').find(
      (field) => field.props.accessibilityLabel === 'Taxa de entrega cobrada',
    );
    const deliveryAddress = findNodes(renderer, 'native-text-field').find(
      (field) => field.props.accessibilityLabel === 'Endereço de entrega',
    );
    act(() => deliveryFee?.props.onChangeText('25'));
    act(() => deliveryAddress?.props.onChangeText('Rua manual, 20'));

    await act(async () => {
      findButton(renderer, 'Voltar').props.onPress();
      await Promise.resolve();
    });
    await act(async () => {
      findButton(renderer, 'Voltar').props.onPress();
      await Promise.resolve();
    });
    await act(async () => {
      findNodes(renderer, 'native-dropdown')[0].props.onValueChange('client-2');
      await Promise.resolve();
    });
    await act(async () => {
      findButton(renderer, 'Continuar').props.onPress();
      await Promise.resolve();
    });
    await act(async () => {
      findButton(renderer, 'Continuar').props.onPress();
      await Promise.resolve();
    });

    const nextDeliveryFee = findNodes(renderer, 'native-text-field').find(
      (field) => field.props.accessibilityLabel === 'Taxa de entrega cobrada',
    );
    const nextDeliveryAddress = findNodes(renderer, 'native-text-field').find(
      (field) => field.props.accessibilityLabel === 'Endereço de entrega',
    );
    expect(nextDeliveryFee?.props.value).toBe('25');
    expect(nextDeliveryAddress?.props.value).toBe('Rua manual, 20');
  });

  it('guides the user to Retail clients when no active client exists', () => {
    mockCatalog.clients = [];
    const renderer = renderScreen();
    const button = findButton(renderer, 'Abrir Clientes Varejo');

    expect(button.props.color).toBe('#FFFFFF');
    expect(button.props.glassTint).toBe('#000000');

    act(() => button.props.onPress());

    expect(mockRouterPush).toHaveBeenCalledWith('/clientes-varejo');
  });

  it('guides the user to the Retail catalog when no active product exists', () => {
    mockCatalog.products = [];
    const renderer = renderScreen();
    const button = findButton(renderer, 'Abrir Catálogo Varejo');

    act(() => button.props.onPress());

    expect(mockRouterPush).toHaveBeenCalledWith('/catalogo-varejo');
  });

  it('supports multiple products, builds the order and registers an optional initial payment', async () => {
    const renderer = renderScreen();
    await act(async () => {
      findButton(renderer, 'Novo pedido').props.onPress();
      await Promise.resolve();
    });
    await act(async () => {
      findNodes(renderer, 'native-dropdown')[0].props.onValueChange('client-1');
      await Promise.resolve();
    });
    await act(async () => {
      findButton(renderer, 'Continuar').props.onPress();
      await Promise.resolve();
    });
    await act(async () => {
      findNodes(renderer, 'native-dropdown')[0].props.onValueChange('product-1');
      await Promise.resolve();
    });
    expect(findNodes(renderer, 'native-dropdown')[0].props.label).toContain('Cesta Café');
    await act(async () => {
      findButton(renderer, 'Adicionar produto').props.onPress();
      await Promise.resolve();
    });
    await act(async () => {
      findNodes(renderer, 'native-dropdown')[0].props.onValueChange('product-2');
      await Promise.resolve();
    });
    await act(async () => {
      findButton(renderer, 'Adicionar produto').props.onPress();
      await Promise.resolve();
    });
    expect(findNodes(renderer, 'native-text-field')).toHaveLength(2);
    await act(async () => {
      findButton(renderer, 'Continuar').props.onPress();
      await Promise.resolve();
    });
    await act(async () => {
      findButton(renderer, 'Ver resumo').props.onPress();
      await Promise.resolve();
    });
    await act(async () => {
      findButton(renderer, 'Continuar').props.onPress();
      await Promise.resolve();
    });
    expect(
      findNodes(renderer, 'native-dropdown').find(
        (node) => node.props.accessibilityLabel === 'Forma do pagamento inicial',
      )?.props.label,
    ).toBe('Pix');

    const paymentAmount = findNodes(renderer, 'native-text-field').find(
      (field) => field.props.accessibilityLabel === 'Valor do pagamento inicial',
    );
    act(() => paymentAmount?.props.onChangeText('30'));
    await act(async () => {
      findButton(renderer, 'Confirmar pedido').props.onPress();
      await Promise.resolve();
    });

    expect(mockPrepareForOrder).toHaveBeenCalledWith(['product-1', 'product-2']);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'client-1',
        deliveryFee: 12,
        lineItems: [
          { productId: 'product-1', quantity: 1 },
          { productId: 'product-2', quantity: 1 },
        ],
      }),
      {},
    );
    expect(mockRegisterForOrder).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({ amount: 30, method: 'Pix' }),
    );
    expect(findNodes(renderer, 'native-sheet')[0].props.visible).toBe(false);
    expect(findNodes(renderer, 'native-dialog')[0].props.visible).toBe(true);
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('can confirm without a payment and keeps the draft visible when creation fails', async () => {
    const renderer = renderScreen();
    await goToPayment(renderer);
    mockCreate.mockRejectedValueOnce(new Error('Falha de rede'));
    const paymentAmount = findNodes(renderer, 'native-text-field').find(
      (field) => field.props.accessibilityLabel === 'Valor do pagamento inicial',
    );
    act(() => paymentAmount?.props.onChangeText('30'));

    await act(async () => {
      findButton(renderer, 'Confirmar pedido').props.onPress();
      await Promise.resolve();
    });

    expect(mockRegisterForOrder).not.toHaveBeenCalled();
    expect(findNodes(renderer, 'native-sheet')[0].props.visible).toBe(true);
    expect(paymentAmount?.props.value).toBe('30');
    expect(findButton(renderer, 'Confirmar pedido')).toBeDefined();
  });

  it('does not submit twice while the order persistence is pending', async () => {
    let resolveCreate!: (orderId: string) => void;
    mockCreate.mockImplementationOnce(
      () => new Promise<string>((resolve) => (resolveCreate = resolve)),
    );
    const renderer = renderScreen();
    await goToPayment(renderer);

    await act(async () => {
      findButton(renderer, 'Sem pagamento agora').props.onPress();
      await Promise.resolve();
    });
    await act(async () => {
      findButton(renderer, 'Sem pagamento agora').props.onPress();
      await Promise.resolve();
    });
    expect(mockCreate).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCreate('order-1');
      await Promise.resolve();
    });
  });
});
