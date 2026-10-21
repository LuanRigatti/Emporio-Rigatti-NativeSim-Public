/* eslint-disable @typescript-eslint/no-require-imports */

import React from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mockRouterPush = jest.fn();
const mockLightImpactHaptic = jest.fn();

jest.mock('expo-router', () => {
  return {
    useRouter: () => ({ push: mockRouterPush }),
  };
});

jest.mock('@expo/vector-icons/Ionicons', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('ionicon', props);
  },
}));

jest.mock('@/components/layout', () => ({
  getNativeLargeTitleStyle: jest.fn(() => ({})),
  NativeGlassHeader: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('native-header', props);
  },
}));

jest.mock('@/components/premium', () => ({
  PremiumCard: ({ children, ...props }: { children?: React.ReactNode }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('premium-card', props, children);
  },
  ProgressiveCollapsibleScreen: ({
    children,
    largeTitle,
    ...props
  }: {
    children?: React.ReactNode;
    largeTitle?: React.ReactNode;
  }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('progressive-screen', props, largeTitle, children);
  },
}));

jest.mock('@/providers', () => ({
  useAppSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

jest.mock('@/theme', () => ({
  getCardSurfaceColor: () => '#FFFFFF',
  useAppTheme: () => ({
    theme: {
      colors: {
        background: '#F8F7F5',
        textPrimary: '#111111',
        textSecondary: '#666666',
        surface: '#FFFFFF',
      },
      layout: { screenHorizontalPadding: 24, tabBarHeight: 80 },
      radius: { xl: 24 },
      sizes: { iconMedium: 24 },
      spacing: { lg: 20, md: 16, sm: 8, xl: 24, xs: 8, xxl: 32, xxs: 4 },
      typography: { footnote: {}, headline: {} },
    },
  }),
}));

jest.mock('@/utils/haptics', () => ({ triggerLightImpactHaptic: mockLightImpactHaptic }));

const { RegistrarDeliveryLandingScreen } =
  require('@/features/deliveries/components/RegistrarDeliveryLandingScreen') as {
    RegistrarDeliveryLandingScreen: () => React.ReactElement;
  };

function renderLanding(): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(React.createElement(RegistrarDeliveryLandingScreen));
  });
  return renderer;
}

describe('RegistrarDeliveryLandingScreen', () => {
  beforeEach(() => {
    mockRouterPush.mockClear();
    mockLightImpactHaptic.mockClear();
  });

  it('shows only the Clientes action under the Entrega title', () => {
    const renderer = renderLanding();

    expect(
      renderer.root.findAll((node) => String(node.type) === 'native-header')[0].props.title,
    ).toBe('Entrega');
    expect(
      renderer.root.findAll((node) => String(node.type) === 'progressive-screen')[0].props
        .compactTitle,
    ).toBe('Entrega');
    const cards = renderer.root.findAll((node) => String(node.type) === 'premium-card');
    expect(cards).toHaveLength(1);
    expect(cards[0].findAllByType(Text).map((node) => node.props.children)).toContain('Clientes');
    expect(cards[0].props.accessibilityLabel).toBe('Abrir clientes para registrar entrega');

    act(() => cards[0].props.onPress());

    expect(mockLightImpactHaptic).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledWith('/registrar-entrega/clientes');
    act(() => renderer.unmount());
  });

  it('does not expose a manual Live Activity toolbar action', () => {
    const renderer = renderLanding();
    expect(
      renderer.root.findAll((node) => String(node.type) === 'stack-toolbar-button'),
    ).toHaveLength(0);
    expect(mockLightImpactHaptic).not.toHaveBeenCalled();
    act(() => renderer.unmount());
  });
});
