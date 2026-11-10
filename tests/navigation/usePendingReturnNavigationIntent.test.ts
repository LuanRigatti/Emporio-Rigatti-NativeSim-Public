import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { NativeStackNavigationProp } from 'expo-router';

import {
  observeRootTabsTransition,
  type RootTabsTransitionPhase,
} from '@/utils/navigation/rootTabsTransition';
import {
  useCancelPendingReturnIntentsOnGestureCancel,
  usePendingReturnNavigationIntent,
} from '@/utils/navigation/usePendingReturnNavigationIntent';

type NavigationEvent = {
  data?: { closing?: boolean };
};
type NavigationListener = (event: NavigationEvent) => void;
type NavigationState = { index: number; routes: { name: string }[] };
type MockNavigation = {
  addListener: (event: string, listener: NavigationListener) => () => void;
  getState: () => NavigationState;
  isFocused: () => boolean;
  emit: (event: string, data?: NavigationEvent['data']) => void;
  listenerCount: () => number;
  setState: (state: NavigationState) => void;
  setFocused: (focused: boolean) => void;
};

function createNavigation(initialRoute: string, focused: boolean): MockNavigation {
  const listeners = new Map<string, Set<NavigationListener>>();
  let state: NavigationState = { index: 0, routes: [{ name: initialRoute }] };
  let isFocused = focused;

  return {
    addListener: (event, listener) => {
      const eventListeners = listeners.get(event) ?? new Set<NavigationListener>();
      eventListeners.add(listener);
      listeners.set(event, eventListeners);
      return () => {
        eventListeners.delete(listener);
        if (eventListeners.size === 0) listeners.delete(event);
      };
    },
    emit: (event, data) => {
      for (const listener of listeners.get(event) ?? []) listener({ data });
    },
    getState: () => state,
    isFocused: () => isFocused,
    listenerCount: () => [...listeners.values()].reduce((count, set) => count + set.size, 0),
    setFocused: (focusedValue) => {
      isFocused = focusedValue;
    },
    setState: (nextState) => {
      state = nextState;
    },
  };
}

type RenderOptions = {
  navigation: MockNavigation;
  sourceRoute: string;
  outgoingRoutes: string[];
  key: string;
  rootTabsTransition?: boolean;
  currentRoute?: () => string | undefined;
  sourceActive?: () => boolean;
};

const rerenderHarnesses = new WeakMap<ReactTestRenderer, () => void>();
const mockExecute = jest.fn();

function renderIntentHarness(options: RenderOptions): ReactTestRenderer {
  const Harness = () => {
    const request = usePendingReturnNavigationIntent({
      expectedOutgoingRouteNames: options.outgoingRoutes,
      getCurrentRouteName:
        options.currentRoute ??
        (() => options.navigation.getState().routes[options.navigation.getState().index]?.name),
      isSourceActive: options.sourceActive,
      navigation: options.navigation as unknown as NativeStackNavigationProp<
        Record<string, object | undefined>
      >,
      rootTabsTransition: options.rootTabsTransition,
      sourceRouteName: options.sourceRoute,
    });

    return React.createElement('intent-button', {
      onPress: () =>
        request({
          key: options.key,
          execute: (deferred) => mockExecute(deferred, options.key),
        }),
    });
  };

  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(React.createElement(Harness));
  });
  rerenderHarnesses.set(renderer, () => {
    act(() => renderer.update(React.createElement(Harness)));
  });
  return renderer;
}

function renderGestureCancelListener(
  navigation: MockNavigation,
  routeName: string,
): ReactTestRenderer {
  const Harness = () => {
    useCancelPendingReturnIntentsOnGestureCancel(
      navigation as unknown as NativeStackNavigationProp<Record<string, object | undefined>>,
      routeName,
    );
    return null;
  };
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(React.createElement(Harness));
  });
  return renderer;
}

function tap(renderer: ReactTestRenderer): void {
  act(() => renderer.root.find((node) => String(node.type) === 'intent-button').props.onPress());
}

function transition(listener: MockNavigation, phase: RootTabsTransitionPhase): void {
  if (phase === 'entering') listener.emit('transitionStart', { closing: false });
  if (phase === 'leaving') listener.emit('transitionStart', { closing: true });
  if (phase === 'settled') listener.emit('transitionEnd', { closing: false });
  if (phase === 'idle') listener.emit('transitionEnd', { closing: true });
}

describe('usePendingReturnNavigationIntent', () => {
  beforeEach(() => mockExecute.mockClear());

  it.each(['back button', 'gesture'])(
    'executes the first touch after a native %s return once focus and route are current',
    () => {
      const navigation = createNavigation('registrar-entrega/clientes', false);
      const renderer = renderIntentHarness({
        navigation,
        sourceRoute: 'registrar-entrega',
        outgoingRoutes: ['registrar-entrega/clientes'],
        key: 'clients',
      });

      act(() => transition(navigation, 'entering'));
      tap(renderer);
      expect(mockExecute).not.toHaveBeenCalled();

      act(() => transition(navigation, 'settled'));
      expect(mockExecute).not.toHaveBeenCalled();

      navigation.setState({ index: 0, routes: [{ name: 'registrar-entrega' }] });
      navigation.setFocused(true);
      act(() => {
        navigation.emit('state');
        navigation.emit('focus');
      });

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(true, 'clients');
      act(() => renderer.unmount());
    },
  );

  it('consolidates five rapid taps into one navigation after return completes', () => {
    const navigation = createNavigation('registrar-entrega/clientes', false);
    const renderer = renderIntentHarness({
      navigation,
      sourceRoute: 'registrar-entrega',
      outgoingRoutes: ['registrar-entrega/clientes'],
      key: 'clients',
    });

    act(() => {
      transition(navigation, 'entering');
      const button = renderer.root.find((node) => String(node.type) === 'intent-button');
      for (let count = 0; count < 5; count += 1) button.props.onPress();
    });
    expect(mockExecute).not.toHaveBeenCalled();

    act(() => transition(navigation, 'settled'));
    navigation.setState({ index: 0, routes: [{ name: 'registrar-entrega' }] });
    navigation.setFocused(true);
    act(() => {
      navigation.emit('state');
      navigation.emit('focus');
    });

    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledWith(true, 'clients');
    act(() => renderer.unmount());
  });

  it('consolidates five same-client form taps while returning to Clientes', () => {
    const navigation = createNavigation('registrar-entrega/[clientId]', false);
    const renderer = renderIntentHarness({
      navigation,
      sourceRoute: 'registrar-entrega/clientes',
      outgoingRoutes: ['registrar-entrega/[clientId]'],
      key: 'synthetic-client-id',
    });

    act(() => transition(navigation, 'entering'));
    act(() => {
      const button = renderer.root.find((node) => String(node.type) === 'intent-button');
      for (let count = 0; count < 5; count += 1) button.props.onPress();
    });
    navigation.setState({ index: 0, routes: [{ name: 'registrar-entrega/clientes' }] });
    navigation.setFocused(true);
    act(() => {
      transition(navigation, 'settled');
      navigation.emit('state');
      navigation.emit('focus');
    });

    expect(mockExecute).toHaveBeenCalledTimes(1);
    act(() => renderer.unmount());
  });

  it('waits for native transition end when JavaScript focus updates first', () => {
    const navigation = createNavigation('registrar-entrega/clientes', false);
    const renderer = renderIntentHarness({
      navigation,
      sourceRoute: 'registrar-entrega',
      outgoingRoutes: ['registrar-entrega/clientes'],
      key: 'clients',
    });

    act(() => transition(navigation, 'entering'));
    tap(renderer);
    navigation.setState({ index: 0, routes: [{ name: 'registrar-entrega' }] });
    navigation.setFocused(true);
    act(() => {
      navigation.emit('state');
      navigation.emit('focus');
    });
    expect(mockExecute).not.toHaveBeenCalled();

    act(() => transition(navigation, 'settled'));
    expect(mockExecute).toHaveBeenCalledTimes(1);
    act(() => renderer.unmount());
  });

  it('queues a touch on an active source until its incoming transition ends', () => {
    const navigation = createNavigation('registrar-entrega', true);
    const renderer = renderIntentHarness({
      navigation,
      sourceRoute: 'registrar-entrega',
      outgoingRoutes: ['registrar-entrega/clientes'],
      key: 'clients',
    });

    act(() => transition(navigation, 'entering'));
    tap(renderer);
    expect(mockExecute).not.toHaveBeenCalled();

    act(() => transition(navigation, 'settled'));
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledWith(true, 'clients');
    act(() => renderer.unmount());
  });

  it('cancels a pending intent when a return gesture reverses', () => {
    const navigation = createNavigation('registrar-entrega/clientes', false);
    const renderer = renderIntentHarness({
      navigation,
      sourceRoute: 'registrar-entrega',
      outgoingRoutes: ['registrar-entrega/clientes'],
      key: 'clients',
    });

    act(() => transition(navigation, 'entering'));
    tap(renderer);
    act(() => transition(navigation, 'leaving'));
    navigation.setState({ index: 0, routes: [{ name: 'registrar-entrega' }] });
    navigation.setFocused(true);
    act(() => {
      navigation.emit('state');
      transition(navigation, 'settled');
      navigation.emit('focus');
    });

    expect(mockExecute).not.toHaveBeenCalled();
    act(() => renderer.unmount());
  });

  it('resets a route after gestureCancel so the next touch executes immediately', () => {
    const navigation = createNavigation('registrar-entrega/clientes', true);
    const renderer = renderIntentHarness({
      navigation,
      sourceRoute: 'registrar-entrega/clientes',
      outgoingRoutes: ['registrar-entrega/[clientId]'],
      key: 'form',
    });

    act(() => navigation.emit('transitionStart', { closing: true }));
    tap(renderer);
    expect(mockExecute).not.toHaveBeenCalled();

    act(() => navigation.emit('gestureCancel'));
    tap(renderer);
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledWith(false, 'form');
    act(() => renderer.unmount());
  });

  it('cancels a source intent when the destination reports gestureCancel', () => {
    const sourceNavigation = createNavigation('registrar-entrega/clientes', false);
    const sourceRenderer = renderIntentHarness({
      navigation: sourceNavigation,
      sourceRoute: 'registrar-entrega',
      outgoingRoutes: ['registrar-entrega/clientes'],
      key: 'clients',
    });
    const destinationNavigation = createNavigation('registrar-entrega/clientes', true);
    const destinationRenderer = renderGestureCancelListener(
      destinationNavigation,
      'registrar-entrega/clientes',
    );

    act(() => transition(sourceNavigation, 'entering'));
    tap(sourceRenderer);
    act(() => destinationNavigation.emit('gestureCancel'));
    sourceNavigation.setState({ index: 0, routes: [{ name: 'registrar-entrega' }] });
    sourceNavigation.setFocused(true);
    act(() => {
      sourceNavigation.emit('state');
      sourceNavigation.emit('focus');
    });

    expect(mockExecute).not.toHaveBeenCalled();
    act(() => destinationRenderer.unmount());
    act(() => sourceRenderer.unmount());
  });

  it('replaces a pending destination and never executes the stale key', () => {
    const navigation = createNavigation('registrar-entrega/[clientId]', false);
    const options: RenderOptions = {
      navigation,
      sourceRoute: 'registrar-entrega/clientes',
      outgoingRoutes: ['registrar-entrega/[clientId]'],
      key: 'client-a',
    };
    const renderer = renderIntentHarness(options);

    act(() => transition(navigation, 'entering'));
    tap(renderer);
    options.key = 'client-b';
    rerenderHarnesses.get(renderer)?.();
    tap(renderer);

    navigation.setState({ index: 0, routes: [{ name: 'registrar-entrega/clientes' }] });
    navigation.setFocused(true);
    act(() => {
      navigation.emit('state');
      transition(navigation, 'settled');
      navigation.emit('focus');
    });

    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledWith(true, 'client-b');
    act(() => renderer.unmount());
  });

  it('cancels a pending intent when navigation changes to an unrelated route', () => {
    const navigation = createNavigation('registrar-entrega/clientes', false);
    const renderer = renderIntentHarness({
      navigation,
      sourceRoute: 'registrar-entrega',
      outgoingRoutes: ['registrar-entrega/clientes'],
      key: 'clients',
    });

    act(() => transition(navigation, 'entering'));
    tap(renderer);
    navigation.setState({ index: 0, routes: [{ name: 'em-aberto' }] });
    act(() => navigation.emit('state'));
    navigation.setState({ index: 0, routes: [{ name: 'registrar-entrega' }] });
    navigation.setFocused(true);
    act(() => {
      transition(navigation, 'settled');
      navigation.emit('focus');
    });

    expect(mockExecute).not.toHaveBeenCalled();
    act(() => renderer.unmount());
  });

  it('cancels a pending intent on unmount and cleans up listeners', () => {
    const navigation = createNavigation('registrar-entrega/clientes', false);
    const renderer = renderIntentHarness({
      navigation,
      sourceRoute: 'registrar-entrega',
      outgoingRoutes: ['registrar-entrega/clientes'],
      key: 'clients',
    });
    expect(navigation.listenerCount()).toBeGreaterThan(0);

    act(() => transition(navigation, 'entering'));
    tap(renderer);
    act(() => renderer.unmount());
    expect(navigation.listenerCount()).toBe(0);
    navigation.setState({ index: 0, routes: [{ name: 'registrar-entrega' }] });
    navigation.setFocused(true);
    act(() => {
      transition(navigation, 'settled');
      navigation.emit('focus');
    });

    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('observes the `(tabs)` root transition for its nested Home route', () => {
    const rootNavigation = createNavigation('registrar-entrega', false);
    const homeNavigation = createNavigation('dashboard', false);
    const stopObserving = observeRootTabsTransition(
      rootNavigation as unknown as NativeStackNavigationProp<Record<string, object | undefined>>,
    );
    const renderer = renderIntentHarness({
      navigation: homeNavigation,
      sourceRoute: '(tabs)',
      outgoingRoutes: ['registrar-entrega'],
      key: 'registrar_landing',
      rootTabsTransition: true,
      currentRoute: () => rootNavigation.getState().routes[rootNavigation.getState().index]?.name,
      sourceActive: () =>
        homeNavigation.isFocused() &&
        rootNavigation.getState().routes[rootNavigation.getState().index]?.name === '(tabs)',
    });

    act(() => transition(rootNavigation, 'entering'));
    act(() => {
      const button = renderer.root.find((node) => String(node.type) === 'intent-button');
      for (let count = 0; count < 5; count += 1) button.props.onPress();
    });
    expect(mockExecute).not.toHaveBeenCalled();

    rootNavigation.setState({ index: 0, routes: [{ name: '(tabs)' }] });
    homeNavigation.setFocused(true);
    act(() => {
      rootNavigation.emit('state');
      homeNavigation.emit('focus');
    });
    expect(mockExecute).not.toHaveBeenCalled();

    act(() => transition(rootNavigation, 'settled'));
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledWith(true, 'registrar_landing');

    act(() => renderer.unmount());
    stopObserving();
  });
});
