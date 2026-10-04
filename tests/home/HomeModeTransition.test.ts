/* eslint-disable @typescript-eslint/no-require-imports */

import { createElement, Fragment } from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { readFileSync } from 'node:fs';

import { AppLogo } from '@/components/branding/AppLogo';
import { HomeModeTransitionHost } from '@/features/home/components/HomeModeTransitionHost';
import {
  clearHomeModeTransition,
  getHomeModeTransition,
  useHomeModeTransition,
} from '@/features/home/hooks/useHomeModeTransition';
import { AppModeProvider, useAppMode } from '@/providers/AppModeProvider';
import type { AppMode } from '@/types/appMode';

type RecordedAnimation = {
  target: number;
  duration: number;
  easing: unknown;
  setCurrentValue: (value: number) => void;
  complete: (finished: boolean) => void;
};

const mockAnimations: RecordedAnimation[] = [];
const mockAnimatedStyleCallbacks: (() => unknown)[] = [];
const mockSave = jest.fn<Promise<void>, [string, AppMode]>(() => Promise.resolve());
let mockInitialMode: AppMode = 'wholesale';
let mockResolvedMode: 'light' | 'dark' = 'light';
let mockReduceMotionEnabled = false;
const mockEasingInOut = jest.fn((curve: string) => `inOut(${curve})`);
const mockEasingOut = jest.fn((curve: string) => `out(${curve})`);

jest.mock('react-native-reanimated', () => {
  const React = require('react') as typeof import('react');
  const { View } = require('react-native') as typeof import('react-native');
  const cubic = 'cubic';

  return {
    __esModule: true,
    default: { View },
    Easing: {
      cubic,
      inOut: (curve: string) => mockEasingInOut(curve),
      out: (curve: string) => mockEasingOut(curve),
    },
    cancelAnimation: jest.fn(),
    runOnJS: (callback: unknown) => callback,
    useAnimatedStyle: (callback: () => unknown) => {
      mockAnimatedStyleCallbacks.push(callback);
      return callback();
    },
    useSharedValue: (initial: number) => {
      const shared = React.useRef<{ value: number } | null>(null);
      if (!shared.current) {
        let value = initial;
        shared.current = {
          get value() {
            return value;
          },
          set value(next: number) {
            if (typeof next === 'number') {
              value = next;
              return;
            }

            const animation = next as unknown as {
              target: number;
              config: { duration: number; easing: unknown };
              callback?: (finished: boolean) => void;
            };
            mockAnimations.push({
              target: animation.target,
              duration: animation.config.duration,
              easing: animation.config.easing,
              setCurrentValue: (nextValue) => {
                value = nextValue;
              },
              complete: (finished) => {
                if (finished) value = animation.target;
                animation.callback?.(finished);
              },
            });
          },
        };
      }
      return shared.current;
    },
    withTiming: (
      target: number,
      config: { duration: number; easing: unknown },
      callback?: (finished: boolean) => void,
    ) => ({ target, config, callback }),
  };
});

jest.mock('react-native/Libraries/Modal/Modal', () => {
  const React = require('react') as typeof import('react');

  function MockModal({
    children,
    onShow,
    visible,
    ...props
  }: {
    children?: React.ReactNode;
    onShow?: () => void;
    visible: boolean;
    [key: string]: unknown;
  }) {
    React.useLayoutEffect(() => {
      if (visible) onShow?.();
    }, [onShow, visible]);

    return React.createElement('native-fullscreen-modal', { ...props, visible }, children);
  }

  return { __esModule: true, default: MockModal };
});

jest.mock('@/providers/SessionProvider', () => ({
  useSession: () => ({ user: { id: 'user-one' } }),
}));
jest.mock('@/providers', () => jest.requireActual('@/providers/AppModeProvider'));
jest.mock('@/services/preferences/AppModeStorage', () => ({
  appModeStorage: {
    getCached: () => mockInitialMode,
    load: async () => mockInitialMode,
    save: (uid: string, mode: AppMode) => mockSave(uid, mode),
  },
}));
jest.mock('@/theme', () => ({
  useAppTheme: () => ({
    reduceMotionEnabled: mockReduceMotionEnabled,
    resolvedMode: mockResolvedMode,
    theme: {
      colors: {
        background: mockResolvedMode === 'dark' ? '#000000' : '#FAF8F7',
        textPrimary: mockResolvedMode === 'dark' ? '#F5F7FA' : '#111827',
      },
      spacing: { xs: 8, xl: 24 },
      typography: { headline: { fontSize: 17, fontWeight: '600' } },
    },
  }),
}));

function ModeTransitionConsumer({ targetMode }: { targetMode: AppMode }) {
  const appMode = useAppMode();
  const { requestModeTransition } = useHomeModeTransition(appMode);

  return createElement(
    Fragment,
    null,
    createElement('root-stack-containing-native-tabs', { mode: appMode.mode }),
    createElement('request-mode-transition', {
      onPress: (nextMode: AppMode = targetMode) => requestModeTransition(nextMode),
    }),
  );
}

async function renderTransition(targetMode: AppMode) {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      createElement(
        AppModeProvider,
        null,
        createElement(
          Fragment,
          null,
          createElement(ModeTransitionConsumer, { targetMode }),
          createElement(HomeModeTransitionHost),
        ),
      ),
    );
  });
  return renderer;
}

function findAnimation(duration: number) {
  const animation = mockAnimations.find((candidate) => candidate.duration === duration);
  expect(animation).toBeDefined();
  return animation!;
}

function completeAnimation(duration: number, finished = true) {
  const animationIndex = mockAnimations.findIndex((candidate) => candidate.duration === duration);
  expect(animationIndex).toBeGreaterThanOrEqual(0);
  const [animation] = mockAnimations.splice(animationIndex, 1);
  act(() => animation!.complete(finished));
  return animation!;
}

function findByTypeName(root: ReactTestInstance, typeName: string) {
  return root.findAll((node) => String(node.type) === typeName)[0];
}

describe('Home AppMode splash transition', () => {
  beforeEach(() => {
    mockAnimations.length = 0;
    mockAnimatedStyleCallbacks.length = 0;
    mockSave.mockClear();
    mockEasingInOut.mockClear();
    mockEasingOut.mockClear();
    mockInitialMode = 'wholesale';
    mockResolvedMode = 'light';
    mockReduceMotionEnabled = false;
    const staleTransition = getHomeModeTransition();
    if (staleTransition) clearHomeModeTransition(staleTransition.id);
  });

  it.each([
    ['light', 'wholesale', 'retail', '#FAF8F7'],
    ['dark', 'wholesale', 'retail', '#000000'],
    ['light', 'retail', 'wholesale', '#FAF8F7'],
    ['dark', 'retail', 'wholesale', '#000000'],
  ] as const)(
    'covers the full app and applies %s mode transition from %s to %s after the exact Splash entrance',
    async (colorScheme, sourceMode, targetMode, backgroundColor) => {
      mockInitialMode = sourceMode;
      mockResolvedMode = colorScheme;
      const renderer = await renderTransition(targetMode);

      act(() => {
        findByTypeName(renderer.root, 'request-mode-transition').props.onPress();
      });

      expect(findByTypeName(renderer.root, 'root-stack-containing-native-tabs').props.mode).toBe(
        sourceMode,
      );
      const modal = findByTypeName(renderer.root, 'native-fullscreen-modal');
      expect(modal.props).toMatchObject({
        animationType: 'none',
        navigationBarTranslucent: true,
        presentationStyle: 'overFullScreen',
        statusBarTranslucent: true,
        transparent: true,
        visible: true,
      });
      const surface = renderer.root.findByProps({ testID: 'home-mode-transition-surface' });
      expect(StyleSheet.flatten(surface.props.style)).toMatchObject({
        backgroundColor,
        opacity: 1,
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      });
      expect(modal.children).toHaveLength(1);
      const modalChild = modal.children[0];
      if (typeof modalChild === 'string') throw new Error('Modal child must be the surface View.');
      expect(modalChild.props.testID).toBe('home-mode-transition-surface');
      expect(surface.findAllByType(AppLogo)).toHaveLength(1);
      const logo = renderer.root.findByType(AppLogo);
      expect(logo.props).toMatchObject({ size: 540, variant: 'splash' });
      const composition = renderer.root.findByProps({
        testID: 'home-mode-transition-composition',
      });
      expect(StyleSheet.flatten(composition.props.style)).toMatchObject({
        opacity: 0,
        transform: [{ translateY: 26 }],
      });
      expect(
        StyleSheet.flatten(
          renderer.root.findByProps({ testID: 'home-mode-transition-logo-position' }).props.style,
        ).transform,
      ).toEqual([{ translateY: 37 }]);
      expect(mockAnimations).toHaveLength(1);
      expect(findAnimation(1000)).toMatchObject({
        target: 1,
        duration: 1000,
      });
      expect(findAnimation(1000).easing).toBe('inOut(cubic)');
      expect(mockEasingInOut).toHaveBeenCalledWith('cubic');
      const targetLabel = renderer.root.findByProps({
        testID: 'home-mode-transition-target-label',
      });
      expect(targetLabel.findByType(Text).props.children).toBe(
        targetMode === 'wholesale' ? 'Atacado' : 'Varejo',
      );
      expect(StyleSheet.flatten(targetLabel.props.style)).toMatchObject({
        top: '52.8%',
        marginTop: 24,
      });
      expect(targetLabel.parent?.props.testID).toBe('home-mode-transition-composition');
      expect(StyleSheet.flatten(targetLabel.findByType(Text).props.style)).toMatchObject({
        color: colorScheme === 'dark' ? '#F5F7FA' : '#111827',
        fontSize: 17,
        fontWeight: '600',
      });
      findAnimation(1000).setCurrentValue(0.5);
      const halfwayCompositionStyles = mockAnimatedStyleCallbacks
        .map((getStyle) => getStyle())
        .filter((style) => {
          if (!style || typeof style !== 'object') return false;
          const animatedStyle = style as {
            opacity?: number;
            transform?: { translateY?: number }[];
          };
          return animatedStyle.opacity === 0.5 && animatedStyle.transform?.[0]?.translateY === 13;
        });
      expect(halfwayCompositionStyles.length).toBeGreaterThan(0);
      halfwayCompositionStyles.forEach((style) => {
        expect(style).toEqual({ opacity: 0.5, transform: [{ translateY: 13 }] });
      });
      expect(mockSave).not.toHaveBeenCalled();

      completeAnimation(1000);
      expect(mockSave.mock.calls).toEqual([['user-one', targetMode]]);
      expect(findByTypeName(renderer.root, 'root-stack-containing-native-tabs').props.mode).toBe(
        targetMode,
      );
      expect(getHomeModeTransition()?.phase).toBe('revealing');
      expect(
        renderer.root.findAll((node) => String(node.type) === 'native-fullscreen-modal'),
      ).toHaveLength(1);
      expect(findAnimation(300)).toMatchObject({ target: 0, duration: 300 });
      expect(findAnimation(300).easing).toBe('out(cubic)');
      expect(mockEasingOut).toHaveBeenCalledWith('cubic');
      const getOverlayStyle = mockAnimatedStyleCallbacks[mockAnimatedStyleCallbacks.length - 1];
      for (const opacity of [0.8, 0.4, 0]) {
        findAnimation(300).setCurrentValue(opacity);
        expect(getOverlayStyle()).toEqual({ opacity });
        expect(
          renderer.root.findAll((node) => String(node.type) === 'native-fullscreen-modal'),
        ).toHaveLength(1);
      }

      completeAnimation(300);
      expect(getHomeModeTransition()).toBeNull();
      expect(
        renderer.root.findAll((node) => String(node.type) === 'native-fullscreen-modal'),
      ).toHaveLength(0);

      act(() => renderer.unmount());
    },
  );

  it('matches the active SplashFallback Reduce Motion behavior without changing its 1000 ms animation', async () => {
    mockReduceMotionEnabled = true;
    const renderer = await renderTransition('retail');

    act(() => findByTypeName(renderer.root, 'request-mode-transition').props.onPress());

    expect(findAnimation(1000)).toMatchObject({ target: 1, duration: 1000 });
    completeAnimation(1000);
    expect(findByTypeName(renderer.root, 'root-stack-containing-native-tabs').props.mode).toBe(
      'retail',
    );
    expect(findAnimation(300)).toMatchObject({ target: 0, duration: 300 });
    completeAnimation(300);
    act(() => renderer.unmount());
  });

  it('keeps the Modal mounted when the reveal animation is cancelled before completion', async () => {
    const renderer = await renderTransition('retail');

    act(() => findByTypeName(renderer.root, 'request-mode-transition').props.onPress());
    completeAnimation(1000);
    completeAnimation(300, false);

    expect(getHomeModeTransition()?.phase).toBe('revealing');
    expect(
      renderer.root.findAll((node) => String(node.type) === 'native-fullscreen-modal'),
    ).toHaveLength(1);

    act(() => renderer.unmount());
  });

  it('supports repeated switches in both directions and restores interaction after each reveal', async () => {
    const renderer = await renderTransition('retail');
    const request = findByTypeName(renderer.root, 'request-mode-transition');

    act(() => request.props.onPress());
    completeAnimation(1000);
    expect(findByTypeName(renderer.root, 'root-stack-containing-native-tabs').props.mode).toBe(
      'retail',
    );
    expect(getHomeModeTransition()?.phase).toBe('revealing');
    expect(
      renderer.root.findAll((node) => String(node.type) === 'native-fullscreen-modal'),
    ).toHaveLength(1);
    expect(findAnimation(300)).toMatchObject({ target: 0, duration: 300 });
    completeAnimation(300);
    expect(getHomeModeTransition()).toBeNull();
    expect(
      renderer.root.findAll((node) => String(node.type) === 'native-fullscreen-modal'),
    ).toHaveLength(0);

    const reverseRequest = findByTypeName(renderer.root, 'request-mode-transition');
    act(() => reverseRequest.props.onPress('wholesale'));
    completeAnimation(1000);
    expect(findByTypeName(renderer.root, 'root-stack-containing-native-tabs').props.mode).toBe(
      'wholesale',
    );
    expect(getHomeModeTransition()?.phase).toBe('revealing');
    expect(findAnimation(300)).toMatchObject({ target: 0, duration: 300 });
    completeAnimation(300);
    expect(mockSave.mock.calls).toEqual([
      ['user-one', 'retail'],
      ['user-one', 'wholesale'],
    ]);
    expect(
      renderer.root.findAll((node) => String(node.type) === 'native-fullscreen-modal'),
    ).toHaveLength(0);

    act(() => renderer.unmount());
  });

  it('keeps the fullscreen host outside the Root Stack and Dashboard trees', () => {
    const rootLayout = readFileSync('src/app/_layout.tsx', 'utf8');
    const dashboard = readFileSync('src/app/(tabs)/dashboard/index.tsx', 'utf8');
    const navigationStart = rootLayout.indexOf('<NavigationThemeProvider');
    const navigationEnd = rootLayout.indexOf('</NavigationThemeProvider>', navigationStart);
    const hostStart = rootLayout.indexOf('<HomeModeTransitionHost />');
    const keyboardEnd = rootLayout.indexOf('</KeyboardProvider>', navigationEnd);

    expect(navigationStart).toBeGreaterThan(-1);
    expect(navigationEnd).toBeGreaterThan(navigationStart);
    expect(hostStart).toBeGreaterThan(navigationEnd);
    expect(hostStart).toBeLessThan(keyboardEnd);
    expect(dashboard).not.toContain('HomeModeTransitionOverlay');
  });
});
