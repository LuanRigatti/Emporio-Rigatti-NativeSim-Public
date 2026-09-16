/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ReactNode } from 'react';

const mockAppMode = { mode: 'wholesale' as 'wholesale' | 'retail' };
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
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@expo/vector-icons/Ionicons', () => ({
  __esModule: true,
  default: () => null,
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
  PremiumCard: ({ children }: { children?: ReactNode }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('premium-card', null, children);
  },
  PremiumScreen: ({ children }: { children?: ReactNode }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('premium-screen', null, children);
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
    sheetVisible: false,
  }),
}));
jest.mock('@/features/open-payments/components/OpenPaymentClientIcon', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/features/retail-orders/components/RetailOrderRegistrarScreen', () => ({
  __esModule: true,
  default: () => {
    const React = require('react') as typeof import('react');
    return React.createElement('retail-order-registrar');
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
  getCardSurfaceColor: () => '#FFFFFF',
  getLiquidGlassTint: () => undefined,
  registrarDeliveryDarkLiquidGlassTint: '#000000',
  useAppTheme: () => ({
    resolvedMode: 'light',
    theme: {
      animations: { duration: { fast: 100 } },
      colors: {
        background: '#FFFFFF',
        danger: '#FF0000',
        surface: '#FFFFFF',
        textPrimary: '#000000',
        textSecondary: '#666666',
      },
      layout: { screenHorizontalPadding: 24 },
      radius: { xl: 24 },
      shadows: { card: {}, none: {} },
      sizes: { iconMedium: 24, touchTargetMinimum: 44 },
      spacing: { lg: 20, md: 16, sm: 8, xl: 24, xs: 4, xxl: 32, xxxl: 40, xxs: 2 },
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
  triggerLightImpactHaptic: jest.fn(),
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

  it('switches only the Registrar content to the retail flow', () => {
    mockAppMode.mode = 'retail';
    const renderer = renderRegistrar();

    expect(
      renderer.root.findAll((node) => String(node.type) === 'retail-order-registrar'),
    ).toHaveLength(1);
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
      renderer.root.findAll((node) => String(node.type) === 'retail-order-registrar'),
    ).toHaveLength(0);
    expect(renderer.root.findAll((node) => String(node.type) === 'native-header')).toHaveLength(1);
  });
});
