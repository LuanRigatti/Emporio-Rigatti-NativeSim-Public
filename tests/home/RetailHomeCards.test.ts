/* eslint-disable @typescript-eslint/no-require-imports */

import { createElement, type ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet, Text, View } from 'react-native';

const mockRouterPush = jest.fn();
const mockRouterNavigate = jest.fn();
const mockHaptic = jest.fn();
let mockResolvedMode: 'light' | 'dark' = 'light';
const mockMetrics = {
  error: null as string | null,
  hasData: true,
  loading: false,
  receivable: 125,
  refreshing: false,
  reload: jest.fn(),
  todayProfit: 80,
  todayRevenue: 350,
};

jest.mock('@expo/vector-icons/Ionicons', () => ({
  __esModule: true,
  default: ({ color, name, size }: { color: string; name: string; size: number }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('ionicon', { color, name, size });
  },
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: mockRouterNavigate, push: mockRouterPush }),
}));
jest.mock('@/components/layout', () => ({ NativeGlassHeader: () => null }));
jest.mock('@/components/navigation/HomeToolbar', () => ({ HomeToolbar: () => null }));
jest.mock('@/components/premium', () => ({
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
  ProgressiveCollapsibleScreen: ({ children }: { children?: ReactNode }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('progressive-screen', null, children);
  },
}));
jest.mock('@/features/home/components/HomeModeTitle', () => ({ default: () => null }));
jest.mock('@/features/home/components/HomeModeTitleCompactRN', () => ({ default: () => null }));
jest.mock('@/hooks/useRetailHomeMetrics', () => ({
  useRetailHomeMetrics: () => mockMetrics,
}));
jest.mock('@/providers', () => ({ useAppSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('@/theme', () => ({
  getCardSurfaceColor: (mode: 'light' | 'dark', surface: string) =>
    mode === 'dark' ? '#242426' : surface,
  useAppTheme: () => {
    const dark = mockResolvedMode === 'dark';
    return {
      resolvedMode: mockResolvedMode,
      theme: {
        colors: {
          background: dark ? '#000000' : '#FFFFFF',
          danger: '#FF0000',
          surface: '#FCFCFC',
          textPrimary: dark ? '#FFFFFF' : '#111111',
          textSecondary: dark ? '#AAAAAA' : '#666666',
        },
        layout: { screenHorizontalPadding: 24, tabBarHeight: 80 },
        radius: { pill: 999, xl: 22 },
        spacing: { lg: 20, md: 16, sm: 12, xl: 24, xxs: 4, xxxl: 40, xxl: 32 },
        typography: {
          body: {},
          footnote: { fontSize: 13 },
          headline: { fontSize: 17, fontWeight: '600' },
        },
      },
    };
  },
}));
jest.mock('@/utils/haptics', () => ({ triggerLightImpactHaptic: mockHaptic }));
jest.mock('@/utils/presentation/testModeValues', () => ({
  useTestModePresentation: () => ({ currency: (value: number) => `R$ ${value}` }),
}));

const { RetailHome } = require('@/features/home/components/RetailHome') as {
  RetailHome: (props: { modeSelector: { mode: 'retail'; open: () => void } }) => ReactNode;
};

function renderRetailHome(): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      createElement(RetailHome, {
        modeSelector: { mode: 'retail', open: jest.fn() },
      }),
    );
  });
  return renderer;
}

describe('Retail Home shortcut cards', () => {
  beforeEach(() => {
    mockResolvedMode = 'light';
    mockRouterPush.mockClear();
    mockRouterNavigate.mockClear();
    mockHaptic.mockClear();
  });

  it.each([
    ['light', '#FCFCFC'],
    ['dark', '#242426'],
  ] as const)('uses the Atacado card surface in %s mode', (mode, expectedBackground) => {
    mockResolvedMode = mode;
    const renderer = renderRetailHome();
    const cards = renderer.root.findAll((node) => String(node.type) === 'premium-card');

    expect(cards).toHaveLength(4);
    for (const card of cards) {
      expect(StyleSheet.flatten(card.props.style)).toMatchObject({
        backgroundColor: expectedBackground,
        borderRadius: 38,
        padding: 20,
        width: '100%',
      });

      const icon = card
        .findAllByType(View)
        .find((view) => StyleSheet.flatten(view.props.style)?.height === 54);
      expect(StyleSheet.flatten(icon?.props.style)?.backgroundColor).toBe(
        mode === 'dark' ? '#000000' : '#FFFFFF',
      );
    }

    const cardList = renderer.root
      .findAllByType(View)
      .find((view) => StyleSheet.flatten(view.props.style)?.gap === 12);
    const screenMargins = renderer.root
      .findAllByType(View)
      .find((view) => StyleSheet.flatten(view.props.style)?.paddingHorizontal === 24);
    expect(cardList).toBeDefined();
    expect(screenMargins).toBeDefined();
    act(() => renderer.unmount());
  });

  it('keeps the four labels and existing Retail metric values', () => {
    const renderer = renderRetailHome();
    const cards = renderer.root.findAll((node) => String(node.type) === 'premium-card');
    const cardText = cards.map((card) =>
      card.findAllByType(Text).map((node) => node.props.children),
    );

    expect(cardText).toEqual([
      ['Registrar Pedido', 'Novo pedido'],
      ['A receber', 'R$ 125'],
      ['Faturamento hoje', 'R$ 350'],
      ['Lucro hoje', 'R$ 80'],
    ]);

    expect(
      cards.map((card) =>
        card.findAll((node) => String(node.type) === 'ionicon').map((icon) => icon.props.name),
      ),
    ).toEqual([
      ['cart-outline', 'chevron-forward'],
      ['cash-outline'],
      ['trending-up-outline'],
      ['bar-chart-outline'],
    ]);
    expect(cards.slice(1).every((card) => card.props.onPress === undefined)).toBe(true);
    act(() => renderer.unmount());
  });

  it('uses the shared Atacado row and icon-circle geometry', () => {
    const renderer = renderRetailHome();
    const cards = renderer.root.findAll((node) => String(node.type) === 'premium-card');

    for (const card of cards) {
      const views = card.findAllByType(View);
      const row = views.find((view) => StyleSheet.flatten(view.props.style)?.minHeight === 54);
      const icon = views.find((view) => StyleSheet.flatten(view.props.style)?.height === 54);

      expect(StyleSheet.flatten(row?.props.style)).toMatchObject({
        alignItems: 'center',
        flexDirection: 'row',
        minHeight: 54,
        width: '100%',
      });
      expect(StyleSheet.flatten(icon?.props.style)).toMatchObject({
        alignItems: 'center',
        borderRadius: 27,
        height: 54,
        justifyContent: 'center',
        width: 54,
      });
    }

    act(() => renderer.unmount());
  });

  it('keeps Registrar Pedido navigation and haptic on the existing action only', () => {
    const renderer = renderRetailHome();
    const cards = renderer.root.findAll((node) => String(node.type) === 'premium-card');

    expect(cards[0].props.accessibilityLabel).toBe('Abrir Registrar Pedido Varejo');
    act(() => cards[0].props.onPress());

    expect(mockHaptic).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledWith('/registrar-pedido-varejo');
    expect(mockRouterNavigate).not.toHaveBeenCalled();
    expect(cards.slice(1).every((card) => card.props.onPress === undefined)).toBe(true);
    act(() => renderer.unmount());
  });
});
