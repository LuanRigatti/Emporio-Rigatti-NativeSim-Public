/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ComponentType, type ReactNode } from 'react';
import { Text } from 'react-native';
import type { Delivery } from '@/types/data';

const mockUseDeliveries = jest.fn();

jest.mock('expo-router', () => {
  const React = require('react') as typeof import('react');
  const Toolbar = ({ children }: { children?: ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  const ToolbarMenu = ({ children }: { children?: ReactNode }) =>
    React.createElement('toolbar-menu', null, children);
  const ToolbarMenuAction = ({ children }: { children?: ReactNode }) =>
    React.createElement('toolbar-menu-action', null, children);

  return {
    Stack: {
      Toolbar: Object.assign(Toolbar, { Menu: ToolbarMenu, MenuAction: ToolbarMenuAction }),
    },
    useFocusEffect: jest.fn(),
    useRouter: () => ({ push: jest.fn() }),
  };
});

jest.mock('@expo/vector-icons/Ionicons', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'animated-view' },
  Easing: { out: jest.fn((value: unknown) => value), quad: 'quad' },
  FadeIn: { duration: jest.fn(() => ({ delay: jest.fn() })) },
  FadeOut: { duration: jest.fn(() => ({ delay: jest.fn() })) },
  LinearTransition: { duration: jest.fn() },
  useAnimatedStyle: jest.fn(() => ({})),
  useDerivedValue: jest.fn(() => ({ value: 0 })),
  withTiming: jest.fn((value: number) => value),
  createAnimatedComponent: (Component: unknown) => Component,
}));

jest.mock('@/components/layout', () => ({
  getNativeLargeTitleStyle: jest.fn(() => ({})),
  NativeGlassHeader: ({ rightActions, title }: { rightActions?: ReactNode; title: ReactNode }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('native-header', { title }, rightActions);
  },
}));

jest.mock('@/components/native', () => ({
  NativeCardContextMenu: ({ children }: { children?: ReactNode }) => children,
  NativeDailyDataSheet: () => null,
  NativeGlassIconButton: () => null,
}));

jest.mock('@/components/premium', () => ({
  AnimatedPressable: ({ children }: { children?: ReactNode }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('animated-pressable', null, children);
  },
  PremiumCard: ({ children }: { children?: ReactNode }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('premium-card', null, children);
  },
  PremiumScreen: ({
    children,
    overlayHeader,
  }: {
    children?: ReactNode;
    overlayHeader?: ReactNode;
  }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('premium-screen', null, overlayHeader, children);
  },
}));

jest.mock('@/features/deliveries/components/RegistrarDeliverySheet', () => ({
  RegistrarDeliverySheet: () => null,
}));

jest.mock('@/features/deliveries/hooks/useRegistrarDeliverySheet', () => ({
  useRegistrarDeliverySheet: () => ({
    dismissSheet: jest.fn(),
    handleDismiss: jest.fn(),
    handleVisibleChange: jest.fn(),
    openSheet: jest.fn(),
    recentlyAddedDeliveryIds: [],
    sheetVisible: false,
  }),
}));

jest.mock('@/features/open-payments/components/OpenPaymentClientIcon', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/features/retail-orders/components/RetailOrderRegistrarScreen', () => ({
  __esModule: true,
  RetailOrderRegistrarLauncher: () => null,
}));

jest.mock('@/hooks/useClients', () => ({ useClients: () => ({ clients: [] }) }));
jest.mock('@/hooks/useDeliveries', () => ({ useDeliveries: mockUseDeliveries }));
jest.mock('@/hooks/useCostSettings', () => ({ useCostSettings: jest.fn() }));
jest.mock('@/providers', () => ({
  useAppMode: () => ({ mode: 'wholesale' }),
  useAppSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));
jest.mock('@/theme', () => ({
  getCardSurfaceColor: () => '#FFFFFF',
  getLiquidGlassTint: () => undefined,
  registrarDeliveryDarkLiquidGlassTint: '#000000',
  useAppTheme: () => ({
    reduceMotionEnabled: false,
    resolvedMode: 'light',
    theme: {
      animations: { duration: { standard: 200 } },
      colors: {
        background: '#FFFFFF',
        danger: '#FF0000',
        surface: '#FFFFFF',
        textPrimary: '#000000',
        textSecondary: '#666666',
      },
      layout: { screenHorizontalPadding: 24, tabBarHeight: 0 },
      radius: { xl: 24 },
      sizes: { iconMedium: 24, touchTargetMinimum: 44 },
      spacing: { md: 16, sm: 8, xl: 24, xs: 4, xxl: 32, xxs: 2 },
      typography: {
        body: { lineHeight: 20 },
        callout: { lineHeight: 18 },
        footnote: { lineHeight: 14 },
        headline: { fontWeight: '600', lineHeight: 22 },
      },
    },
  }),
}));

jest.mock('@/utils/data', () => ({
  formatCurrency: (value: number) => String(value),
  normalizeMoney: jest.fn(),
  todayIso: () => '2026-09-23',
}));

jest.mock('@/services/data', () => ({
  toHistoryDelivery: (delivery: Delivery) => ({
    ...delivery,
    quantidadeBaldes: delivery.quantidade,
  }),
}));

jest.mock('@/utils/haptics', () => ({
  triggerLightImpactHaptic: jest.fn(),
  triggerSelectionHaptic: jest.fn(),
}));

jest.mock('@/utils/presentation/testModeValues', () => ({
  useTestModePresentation: () => ({
    enabled: false,
    quantity: (value: number, singular = 'balde', plural = 'baldes') =>
      `${value} ${value === 1 ? singular : plural}`,
    text: (value: string) => value,
  }),
}));

const { RegistrarDeliveryScreen } = require('@/app/(tabs)/registrar/index') as {
  RegistrarDeliveryScreen: ComponentType<{ showLargeTitle?: boolean }>;
};

function delivery(id: string, quantidade: number): Delivery {
  return {
    cliente: `Cliente ${id}`,
    data: '2026-09-23',
    entregue: false,
    id,
    quantidade,
    status: 'Não Pago',
    valor: 0,
  };
}

function renderScreen(deliveries: Delivery[]): ReactTestRenderer {
  mockUseDeliveries.mockReturnValue({
    allDeliveries: deliveries,
    create: jest.fn(),
    remove: jest.fn(),
  });

  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(createElement(RegistrarDeliveryScreen, { showLargeTitle: true }));
  });
  return renderer;
}

function deliveryTitleHeader(renderer: ReactTestRenderer): ReactTestInstance {
  const header = renderer.root
    .findAll((node) => String(node.type) === 'native-header')
    .find((node) => node.props.title === 'Entregas');
  if (!header) throw new Error('O título Entregas não foi renderizado.');
  return header;
}

function totalLabel(renderer: ReactTestRenderer): string | undefined {
  const label = deliveryTitleHeader(renderer).findAllByType(Text)[0];
  return label?.props.children;
}

describe('Registrar Atacado delivery bucket total', () => {
  beforeEach(() => {
    mockUseDeliveries.mockClear();
  });

  it('keeps the title and omits the total when no deliveries are visible', () => {
    const renderer = renderScreen([]);
    const header = deliveryTitleHeader(renderer);

    expect(header.props.title).toBe('Entregas');
    expect(header.findAllByType(Text)).toHaveLength(0);
  });

  it('shows the singular label for a single visible bucket', () => {
    const renderer = renderScreen([delivery('one', 1)]);

    expect(totalLabel(renderer)).toBe('1 balde');
  });

  it('sums quantities from the currently visible deliveries and updates with the list', () => {
    const renderer = renderScreen([
      delivery('first', 2),
      delivery('second', 3),
      delivery('third', 6),
    ]);

    expect(totalLabel(renderer)).toBe('11 baldes');
    expect(mockUseDeliveries).toHaveBeenCalledWith({ mode: 'today', date: '2026-09-23' });

    mockUseDeliveries.mockReturnValue({
      allDeliveries: [delivery('updated', 4)],
      create: jest.fn(),
      remove: jest.fn(),
    });
    act(() => {
      renderer.update(createElement(RegistrarDeliveryScreen, { showLargeTitle: true }));
    });

    expect(totalLabel(renderer)).toBe('4 baldes');
  });
});
