/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const mockAppMode = { mode: 'wholesale' as 'wholesale' | 'retail' };
const mockRouterPush = jest.fn();
const mockLightImpactHaptic = jest.fn();
let mockResolvedMode: 'light' | 'dark' = 'light';
const mockUseClients = jest.fn(() => ({ clients: [] }));
const mockUseDeliveries = jest.fn(() => ({ create: jest.fn(), deliveries: [] }));
const mockUseCostSettings = jest.fn(() => ({
  addFieldValue: jest.fn(),
  deleteDailyData: jest.fn(),
  getLatestDailyValue: jest.fn(),
  getValues: jest.fn(() => undefined),
  setFieldValue: jest.fn(),
}));

jest.mock('expo-router', () => ({
  Stack: {},
  useFocusEffect: jest.fn(),
  useRouter: () => ({ push: mockRouterPush }),
}));

jest.mock('@expo/vector-icons/Ionicons', () => ({
  __esModule: true,
  default: ({ color, name, size }: { color: string; name: string; size: number }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('ionicon', { color, name, size });
  },
}));

jest.mock('react-native-reanimated', () => {
  const Animated = { View: 'animated-view' };
  return {
    __esModule: true,
    default: Animated,
    Easing: { linear: jest.fn() },
    FadeIn: { duration: jest.fn(() => ({ delay: jest.fn() })) },
    FadeOut: { duration: jest.fn(() => ({ delay: jest.fn() })) },
    LinearTransition: {},
    useAnimatedStyle: jest.fn(() => ({})),
    useDerivedValue: jest.fn(() => ({ value: 0 })),
    withTiming: jest.fn((value: number) => value),
    createAnimatedComponent: (Component: unknown) => Component,
  };
});

jest.mock('@/components/layout', () => ({
  getNativeLargeTitleStyle: (spacingXxs: number) => ({ marginLeft: -(spacingXxs * 2) }),
  NativeGlassHeader: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('native-header', props);
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
  PremiumCard: ({
    accessibilityLabel,
    children,
    onPress,
    style,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    onPress?: () => void;
    style?: unknown;
  }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('premium-card', { accessibilityLabel, onPress, style }, children);
  },
  PremiumScreen: ({ children }: { children?: ReactNode }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('premium-screen', null, children);
  },
  ProgressiveCollapsibleScreen: ({
    children,
    largeTitle,
  }: {
    children?: ReactNode;
    largeTitle?: ReactNode;
  }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('premium-screen', null, largeTitle, children);
  },
}));
jest.mock('@/components/premium/StickyActionFooter', () => ({
  StickyActionFooter: ({ children }: { children?: ReactNode }) => children,
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
    sheetVisible: false,
  }),
}));
jest.mock('@/features/open-payments/components/OpenPaymentClientIcon', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/features/retail-orders/components/RetailOrderRegistrarScreen', () => ({
  __esModule: true,
  RetailOrderRegistrarLauncher: () => {
    const React = require('react') as typeof import('react');
    return React.createElement('retail-order-registrar-launcher');
  },
}));
jest.mock('@/features/retail-orders/components/RetailOrderStepScreen', () => ({
  RetailOrderCombinedRegistrarScreen: () => {
    const React = require('react') as typeof import('react');
    return React.createElement('retail-order-combined-screen');
  },
}));
jest.mock('@/hooks/useClients', () => ({ useClients: mockUseClients }));
jest.mock('@/hooks/useDeliveries', () => ({ useDeliveries: mockUseDeliveries }));
jest.mock('@/hooks/useCostSettings', () => ({ useCostSettings: mockUseCostSettings }));
jest.mock('@/providers', () => ({
  useAppMode: () => mockAppMode,
  useAppSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));
jest.mock('@/theme', () => ({
  getCardSurfaceColor: (mode: 'light' | 'dark', surface: string) =>
    mode === 'dark' ? '#242426' : surface,
  getLiquidGlassTint: () => undefined,
  registrarDeliveryDarkLiquidGlassTint: '#000000',
  useAppTheme: () => ({
    resolvedMode: mockResolvedMode,
    theme: {
      animations: { duration: { fast: 100 } },
      colors: {
        background: mockResolvedMode === 'dark' ? '#000000' : '#FFFFFF',
        danger: '#FF0000',
        surface: '#FCFCFC',
        textPrimary: mockResolvedMode === 'dark' ? '#FFFFFF' : '#000000',
        textSecondary: mockResolvedMode === 'dark' ? '#AAAAAA' : '#666666',
      },
      layout: { screenHorizontalPadding: 24 },
      radius: { xl: 22 },
      shadows: { card: {}, none: {} },
      sizes: { iconMedium: 24, touchTargetMinimum: 44 },
      spacing: { lg: 20, md: 16, sm: 12, xl: 24, xs: 4, xxl: 32, xxxl: 40, xxs: 2 },
      typography: { body: {}, caption: {}, footnote: {}, headline: {}, title3: {} },
    },
  }),
}));
jest.mock('@/utils/data', () => ({
  formatCurrency: (value: number) => String(value),
  normalizeMoney: jest.fn(),
  todayIso: () => '2026-09-15',
}));
jest.mock('@/services/data', () => ({ toHistoryDelivery: jest.fn() }));
jest.mock('@/utils/haptics', () => ({
  triggerLightImpactHaptic: mockLightImpactHaptic,
  triggerSelectionHaptic: jest.fn(),
}));
jest.mock('@/utils/presentation/testModeValues', () => ({
  useTestModePresentation: () => ({ enabled: false, text: (value: string) => value }),
}));

const PrototypeRegistrar = require('@/app/(tabs)/registrar/index')
  .default as typeof import('@/app/(tabs)/registrar/index').default;

function renderRegistrar(): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(createElement(PrototypeRegistrar));
  });
  return renderer;
}

describe('Registrar app mode routing', () => {
  beforeEach(() => {
    mockAppMode.mode = 'wholesale';
    mockResolvedMode = 'light';
    mockRouterPush.mockClear();
    mockLightImpactHaptic.mockClear();
    mockUseClients.mockClear();
    mockUseDeliveries.mockClear();
    mockUseCostSettings.mockClear();
  });

  it('keeps the existing wholesale Registrar experience', () => {
    const renderer = renderRegistrar();

    expect(
      renderer.root.findAll((node) => String(node.type) === 'retail-order-registrar'),
    ).toHaveLength(0);
    expect(renderer.root.findAll((node) => String(node.type) === 'native-header')).toHaveLength(1);
  });

  it('renders the Retail Registrar launcher instead of the combined order form', () => {
    mockAppMode.mode = 'retail';
    const renderer = renderRegistrar();

    expect(
      renderer.root.findAll((node) => String(node.type) === 'retail-order-registrar-launcher'),
    ).toHaveLength(1);
    expect(
      renderer.root.findAll((node) => String(node.type) === 'retail-order-combined-screen'),
    ).toHaveLength(0);
    expect(renderer.root.findAll((node) => String(node.type) === 'native-header')).toHaveLength(0);
  });

  it.each([
    ['light', '#FCFCFC', '#FFFFFF'],
    ['dark', '#242426', '#000000'],
  ] as const)('renders two shared Registrar cards in %s mode', (mode, surface, iconBackground) => {
    mockResolvedMode = mode;
    const renderer = renderRegistrar();
    const cards = renderer.root.findAll((node) => String(node.type) === 'premium-card');

    expect(cards).toHaveLength(2);
    expect(
      cards.map((card) => card.findAllByType(Text).map((text) => text.props.children)),
    ).toEqual([['Registrar Entrega'], ['Registrar Dados']]);
    expect(
      cards.map((card) =>
        card.findAll((node) => String(node.type) === 'ionicon').map((icon) => icon.props.name),
      ),
    ).toEqual([
      ['cube-outline', 'chevron-forward'],
      ['calendar-outline', 'chevron-forward'],
    ]);

    for (const card of cards) {
      expect(StyleSheet.flatten(card.props.style)).toMatchObject({
        backgroundColor: surface,
        borderRadius: 38,
        padding: 20,
        width: '100%',
      });
      const iconCircle = card
        .findAllByType(View)
        .find((view) => StyleSheet.flatten(view.props.style)?.height === 54);
      expect(StyleSheet.flatten(iconCircle?.props.style)).toMatchObject({
        alignItems: 'center',
        backgroundColor: iconBackground,
        borderRadius: 27,
        height: 54,
        justifyContent: 'center',
        width: 54,
      });
    }

    const cardList = renderer.root
      .findAllByType(View)
      .find((view) => StyleSheet.flatten(view.props.style)?.gap === 12);
    expect(cardList).toBeDefined();
    act(() => renderer.unmount());
  });

  it('preserves each Registrar route, haptic, and card accessibility label', () => {
    const renderer = renderRegistrar();
    const cards = renderer.root.findAll((node) => String(node.type) === 'premium-card');

    expect(cards.map((card) => card.props.accessibilityLabel)).toEqual([
      'Abrir Registrar Entrega',
      'Abrir Registrar Dados',
    ]);
    act(() => cards[0].props.onPress());
    act(() => cards[1].props.onPress());

    expect(mockLightImpactHaptic).toHaveBeenCalledTimes(2);
    expect(mockRouterPush.mock.calls).toEqual([['/registrar-entrega'], ['/registrar-dados']]);
    act(() => renderer.unmount());
  });

  it('switches only the Registrar content to the Retail launcher', () => {
    mockAppMode.mode = 'retail';
    const renderer = renderRegistrar();

    expect(
      renderer.root.findAll((node) => String(node.type) === 'retail-order-registrar-launcher'),
    ).toHaveLength(1);
    expect(
      renderer.root.findAll((node) => String(node.type) === 'retail-order-combined-screen'),
    ).toHaveLength(0);
    expect(renderer.root.findAll((node) => String(node.type) === 'native-header')).toHaveLength(0);
    expect(mockUseClients).not.toHaveBeenCalled();
    expect(mockUseDeliveries).not.toHaveBeenCalled();
    expect(mockUseCostSettings).not.toHaveBeenCalled();
  });

  it('returns to the wholesale experience when the mode changes back', () => {
    mockAppMode.mode = 'retail';
    const renderer = renderRegistrar();

    mockAppMode.mode = 'wholesale';
    act(() => renderer.update(createElement(PrototypeRegistrar)));

    expect(
      renderer.root.findAll((node) => String(node.type) === 'retail-order-registrar-launcher'),
    ).toHaveLength(0);
    expect(
      renderer.root.findAll((node) => String(node.type) === 'retail-order-combined-screen'),
    ).toHaveLength(0);
    expect(renderer.root.findAll((node) => String(node.type) === 'native-header')).toHaveLength(1);
  });
});
