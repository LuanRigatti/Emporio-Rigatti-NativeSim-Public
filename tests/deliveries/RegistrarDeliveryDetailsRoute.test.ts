/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ComponentType, type ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { Delivery } from '@/types/data';
import { consumeRecentlyAddedRegistrarDeliveryIds } from '@/features/deliveries/utils/registrarDelivery';

const mockUseLocalSearchParams = jest.fn();
const mockRouterBack = jest.fn();
const mockUseClients = jest.fn();
const mockUseDeliveries = jest.fn();
const mockCreate = jest.fn();
const mockResolvedMode: { value: 'dark' | 'light' } = { value: 'light' };

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockUseLocalSearchParams(),
  useRouter: () => ({ back: mockRouterBack }),
}));

jest.mock('@/components/layout', () => ({
  getNativeLargeTitleStyle: jest.fn(() => ({})),
  NativeGlassHeader: ({ title }: { title: string }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('native-header', { title });
  },
}));

jest.mock('@/components/premium', () => ({
  ProgressiveCollapsibleScreen: ({
    children,
    largeTitle,
  }: {
    children?: ReactNode;
    largeTitle?: ReactNode;
  }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('progressive-collapsible-screen', null, largeTitle, children);
  },
}));

jest.mock('@/components/premium/StickyActionFooter', () => ({
  StickyActionFooter: ({ children }: { children?: ReactNode }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('sticky-action-footer', null, children);
  },
}));

jest.mock('@/features/deliveries/components/RegistrarDeliveryFormFields', () => ({
  RegistrarDeliveryFormFieldsHost: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('registrar-delivery-fields', props);
  },
}));

jest.mock('@/features/deliveries/hooks/useRegistrarDeliverySheet', () => ({
  DEFAULT_REGISTRAR_DELIVERY_BUCKET_PRICE: 49.8,
}));

jest.mock('@/features/open-payments/components/OpenPaymentClientIcon', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('client-icon', props);
  },
}));

jest.mock('@/features/retail-orders/components/RetailOrderPrimaryButton', () => ({
  RetailOrderPrimaryButton: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('retail-primary-button', props);
  },
}));

jest.mock('@/hooks/useClients', () => ({ useClients: () => mockUseClients() }));
jest.mock('@/hooks/useDeliveries', () => ({
  useDeliveries: (...args: unknown[]) => mockUseDeliveries(...args),
}));
jest.mock('@/providers', () => ({
  useAppSafeAreaInsets: () => ({ bottom: 0 }),
}));
jest.mock('@/theme', () => ({
  getCardSurfaceColor: (_mode: string, lightSurface: string) => lightSurface,
  useAppTheme: () => ({
    resolvedMode: mockResolvedMode.value,
    theme: {
      colors: {
        background: '#FFFFFF',
        selectionContent: '#FFFFFF',
        selectionSurface: '#000000',
        surface: '#FFFFFF',
        textPrimary: '#000000',
        textSecondary: '#666666',
      },
      layout: { screenHorizontalPadding: 24, tabBarHeight: 0 },
      radius: { pill: 999 },
      spacing: { lg: 20, md: 16, sm: 8, xl: 24, xs: 4, xxl: 32, xxs: 2 },
      typography: {
        body: { fontSize: 16 },
        headline: { fontSize: 17, fontWeight: '600' },
      },
    },
  }),
}));
jest.mock('@/utils/data', () => ({
  todayIso: (date?: Date) =>
    date
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      : '2026-09-29',
}));
jest.mock('@/utils/presentation/testModeValues', () => ({
  useTestModePresentation: () => ({ enabled: false }),
}));

const { default: RegistrarDeliveryClientRoute } = require('@/app/registrar-entrega/[clientId]') as {
  default: ComponentType;
};

function createdDelivery(): Delivery {
  return {
    cliente: 'Mercado Central',
    data: '2026-09-30',
    entregue: false,
    id: 'delivery-new',
    quantidade: 3,
    status: 'Não Pago',
    valor: 149.4,
  };
}

describe('Registrar Atacado client details route', () => {
  let renderer: ReactTestRenderer;

  beforeEach(() => {
    mockResolvedMode.value = 'light';
    consumeRecentlyAddedRegistrarDeliveryIds();
    mockUseLocalSearchParams.mockReturnValue({ clientId: 'client:market' });
    mockRouterBack.mockClear();
    mockCreate.mockReset().mockResolvedValue(createdDelivery());
    mockUseClients.mockReturnValue({
      clients: [
        {
          address: 'Rua Central, 10',
          canonicalName: 'Mercado Central',
          clientId: 'client:market',
          currentPrice: 49.8,
        },
      ],
      loading: false,
    });
    mockUseDeliveries.mockReturnValue({ create: mockCreate });
  });

  it('reuses the delivery fields and confirmation logic, then returns to the client list', async () => {
    await act(async () => {
      renderer = create(createElement(RegistrarDeliveryClientRoute));
    });

    expect(renderer.root.find((node) => String(node.type) === 'native-header').props.title).toBe(
      'Entregas',
    );
    const clientName = renderer.root
      .findAllByType(Text)
      .find((node) => node.props.children === 'Mercado Central');
    expect(clientName).toBeDefined();
    expect(StyleSheet.flatten(clientName?.parent?.props.style)).toMatchObject({
      backgroundColor: '#FFFFFF',
      borderCurve: 'continuous',
      borderRadius: 999,
      gap: 8,
      overflow: 'hidden',
      paddingHorizontal: 16,
      paddingVertical: 8,
      width: '100%',
    });
    const clientIcon = renderer.root.find((node) => String(node.type) === 'client-icon');
    expect(clientIcon.props).toEqual({
      backgroundColor: '#FFFFFF',
      iconColor: '#000000',
      iconName: 'person',
    });

    let fields = renderer.root.find((node) => String(node.type) === 'registrar-delivery-fields');
    expect(fields.props.totalValue).toBe(49.8);
    act(() => {
      fields.props.onDateChange(new Date(2026, 8, 30));
      fields.props.onQuantityChange(3, 'up');
    });
    fields = renderer.root.find((node) => String(node.type) === 'registrar-delivery-fields');
    expect(fields.props.quantity).toBe(3);
    expect(fields.props.totalValue).toBeCloseTo(149.4);

    const action = renderer.root.find((node) => String(node.type) === 'retail-primary-button');
    expect(action.props.label).toBe('Adicionar');
    expect(action.props.disabled).toBe(false);
    await act(async () => {
      action.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockUseDeliveries).toHaveBeenCalledWith({ mode: 'today', date: '2026-09-29' });
    expect(mockCreate.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        address: 'Rua Central, 10',
        addressConfirmed: true,
        clientId: 'client:market',
        clientName: 'Mercado Central',
        date: '2026-09-30',
        delivered: false,
        invoiceStatus: 'a_emitir',
        quantity: 3,
        status: 'Não Pago',
        valueWasManuallyChanged: false,
        historicalUnitPrice: 49.8,
      }),
    );
    expect(mockCreate.mock.calls[0][0].value).toBeCloseTo(149.4);
    expect(mockRouterBack).toHaveBeenCalledTimes(1);
    expect(consumeRecentlyAddedRegistrarDeliveryIds()).toEqual(['delivery-new']);
    expect(
      renderer.root.findAll((node) => String(node.type) === 'registrar-delivery-sheet'),
    ).toHaveLength(0);

    mockResolvedMode.value = 'dark';
    act(() => renderer.update(createElement(RegistrarDeliveryClientRoute)));
    expect(renderer.root.find((node) => String(node.type) === 'client-icon').props).toEqual({
      backgroundColor: '#000000',
      iconColor: '#FFFFFF',
      iconName: 'person',
    });
  });
});
