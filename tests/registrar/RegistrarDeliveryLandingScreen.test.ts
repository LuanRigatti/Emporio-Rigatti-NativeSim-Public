/* eslint-disable @typescript-eslint/no-require-imports */

import React from 'react';
import { Platform, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mockLightImpactHaptic = jest.fn();
const mockTransitionEndListeners = new Map<
  string,
  (event: { data: { closing: boolean } }) => void
>();
const mockTransitionCallbacks = new Map<
  string,
  Set<(event: { data: { closing: boolean } }) => void>
>();
const mockNavigationState: { value: { index: number; routes: { name: string }[] } } = {
  value: { index: 0, routes: [{ name: 'registrar-entrega' }] },
};
const mockRouterPush = jest.fn();
let mockFocusEffectCallback: (() => void | (() => void)) | null = null;
let mockFocusCleanup: (() => void) | null = null;
const mockNavigationAddListener = jest.fn(
  (event: string, listener: (event: { data: { closing: boolean } }) => void) => {
    const callbacks = mockTransitionCallbacks.get(event) ?? new Set();
    callbacks.add(listener);
    mockTransitionCallbacks.set(event, callbacks);
    mockTransitionEndListeners.set(event, (value) => {
      for (const callback of callbacks) callback(value);
    });
    return jest.fn(() => {
      callbacks.delete(listener);
      if (callbacks.size === 0) {
        mockTransitionEndListeners.delete(event);
        mockTransitionCallbacks.delete(event);
      }
    });
  },
);

jest.mock('expo-router', () => {
  const React = require('react') as typeof import('react');
  return {
    useFocusEffect: (effect: () => void | (() => void)) =>
      React.useEffect(() => {
        mockFocusEffectCallback = effect;
        mockFocusCleanup = effect() ?? null;
        return () => {
          mockFocusCleanup?.();
          mockFocusCleanup = null;
          mockFocusEffectCallback = null;
        };
      }, [effect]),
    useNavigation: () => ({
      addListener: mockNavigationAddListener,
      getState: () => mockNavigationState.value,
      isFocused: () =>
        mockNavigationState.value.routes[mockNavigationState.value.index]?.name ===
        'registrar-entrega',
    }),
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
    mockRouterPush.mockImplementation((href: string) => {
      if (href === '/registrar-entrega/clientes') {
        const routes = [
          ...mockNavigationState.value.routes,
          { name: 'registrar-entrega/clientes' },
        ];
        mockNavigationState.value = {
          index: routes.length - 1,
          routes,
        };
      }
    });
    mockLightImpactHaptic.mockClear();
    mockFocusEffectCallback = null;
    mockFocusCleanup = null;
    mockNavigationAddListener.mockClear();
    mockTransitionEndListeners.clear();
    mockTransitionCallbacks.clear();
    mockNavigationState.value = { index: 0, routes: [{ name: 'registrar-entrega' }] };
  });

  afterEach(() => jest.restoreAllMocks());

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

  it('pushes the native client route only once for rapid repeated taps', () => {
    const renderer = renderLanding();
    const action = renderer.root.findAll((node) => String(node.type) === 'premium-card')[0];

    act(() => {
      action.props.onPress();
      action.props.onPress();
    });

    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    expect(mockLightImpactHaptic).toHaveBeenCalledTimes(1);
    act(() => renderer.unmount());
  });

  it('releases the navigation guard on Web after a focus return without transition events', () => {
    const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const renderer = renderLanding();
    const action = renderer.root.findAll((node) => String(node.type) === 'premium-card')[0];

    act(() => action.props.onPress());
    expect(mockRouterPush).toHaveBeenCalledTimes(1);

    act(() => mockFocusCleanup?.());
    mockNavigationState.value = { index: 0, routes: [{ name: 'registrar-entrega' }] };
    act(() => {
      mockFocusCleanup = mockFocusEffectCallback?.() ?? null;
    });
    act(() => action.props.onPress());

    expect(mockRouterPush).toHaveBeenCalledTimes(2);
    act(() => renderer.unmount());
    if (originalPlatformDescriptor) {
      Object.defineProperty(Platform, 'OS', originalPlatformDescriptor);
    } else {
      Reflect.deleteProperty(Platform, 'OS');
    }
  });

  it.each(['gesture return', 'back button return'])(
    'accepts the first tap after a cold-start push returns through the %s state',
    () => {
      const renderer = renderLanding();
      const action = renderer.root.findAll((node) => String(node.type) === 'premium-card')[0];
      const transitionStart = mockTransitionEndListeners.get('transitionStart');
      const transitionEnd = mockTransitionEndListeners.get('transitionEnd');

      expect(transitionStart).toBeDefined();
      expect(transitionEnd).toBeDefined();

      act(() => {
        action.props.onPress();
        action.props.onPress();
      });
      expect(mockRouterPush).toHaveBeenCalledTimes(1);

      act(() => {
        transitionStart?.({ data: { closing: true } });
        transitionEnd?.({ data: { closing: false } });
        action.props.onPress();
      });
      expect(mockRouterPush).toHaveBeenCalledTimes(1);

      act(() => {
        transitionEnd?.({ data: { closing: true } });
        action.props.onPress();
      });
      expect(mockRouterPush).toHaveBeenCalledTimes(1);

      mockNavigationState.value = { index: 0, routes: [{ name: 'registrar-entrega' }] };
      act(() => {
        action.props.onPress();
        action.props.onPress();
      });

      expect(mockRouterPush).toHaveBeenCalledTimes(2);
      expect(mockLightImpactHaptic).toHaveBeenCalledTimes(2);
      expect(
        mockNavigationState.value.routes.filter(
          (route) => route.name === 'registrar-entrega/clientes',
        ),
      ).toHaveLength(1);

      act(() => renderer.unmount());
      expect(mockTransitionEndListeners.size).toBe(0);
    },
  );

  it('queues the first Clientes touch during return and consolidates five fast taps', () => {
    const renderer = renderLanding();
    const action = renderer.root.findAll((node) => String(node.type) === 'premium-card')[0];
    const transitionStart = mockTransitionEndListeners.get('transitionStart');
    const transitionEnd = mockTransitionEndListeners.get('transitionEnd');

    act(() => action.props.onPress());
    expect(mockRouterPush).toHaveBeenCalledTimes(1);

    act(() => transitionEnd?.({ data: { closing: true } }));
    act(() => transitionStart?.({ data: { closing: false } }));
    mockNavigationState.value = {
      index: 1,
      routes: [
        { name: 'registrar-entrega' },
        { name: 'registrar-entrega/clientes' },
      ],
    };
    act(() => {
      for (let count = 0; count < 5; count += 1) action.props.onPress();
    });
    expect(mockRouterPush).toHaveBeenCalledTimes(1);

    act(() => transitionEnd?.({ data: { closing: false } }));
    mockNavigationState.value = { index: 0, routes: [{ name: 'registrar-entrega' }] };
    act(() => {
      mockTransitionCallbacks.get('state')?.forEach((listener) => listener({ data: { closing: false } }));
      mockTransitionCallbacks.get('focus')?.forEach((listener) => listener({ data: { closing: false } }));
    });

    expect(mockRouterPush).toHaveBeenCalledTimes(2);
    expect(mockRouterPush).toHaveBeenLastCalledWith('/registrar-entrega/clientes');
    expect(
      mockNavigationState.value.routes.filter(
        (route) => route.name === 'registrar-entrega/clientes',
      ),
    ).toHaveLength(1);
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
