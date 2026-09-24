import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Dimensions, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { AttachHoldButton } from '@/features/home/components/chatgpt-attachments/composer/attach-hold-button';
import {
  getHoldTileCenterX,
  getHoldTrayMetrics,
} from '@/features/home/components/chatgpt-attachments/composer/hold-menu';
import { HOLD_MENU_GESTURE } from '@/features/home/components/chatgpt-attachments/composer/hold-menu.constants';
import type { LibraryPhoto } from '@/features/home/components/chatgpt-attachments/photos/use-photo-library';

const mockReact = React;
const mockView = View;
let mockGestureComposition: { toGestureArray: () => MockGesture[] } | null = null;
let mockDockCompletions: ((finished: boolean) => void)[] = [];
let mockSpringCompletions: ((finished: boolean) => void)[] = [];

interface MockGesture {
  handlerName: string;
  config: Record<string, unknown>;
  handlers: Record<string, ((...args: never[]) => void) | undefined>;
  enabled: (enabled: boolean) => MockGesture;
  hitSlop: (value: number) => MockGesture;
  activateAfterLongPress: (duration: number) => MockGesture;
  onBegin: (callback: (...args: never[]) => void) => MockGesture;
  onStart: (callback: (...args: never[]) => void) => MockGesture;
  onUpdate: (callback: (...args: never[]) => void) => MockGesture;
  onFinalize: (callback: (...args: never[]) => void) => MockGesture;
  onEnd: (callback: (...args: never[]) => void) => MockGesture;
}

jest.mock('react-native-gesture-handler', () => {
  const makeGesture = (name: string): MockGesture => {
    const gesture: MockGesture = {
      handlerName: `${name}GestureHandler`,
      config: {},
      handlers: {},
      enabled(enabled: boolean) {
        this.config.enabled = enabled;
        return this;
      },
      hitSlop(value: number) {
        this.config.hitSlop = value;
        return this;
      },
      activateAfterLongPress(duration: number) {
        this.config.activateAfterLongPress = duration;
        return this;
      },
      onBegin(callback: (...args: never[]) => void) {
        this.handlers.onBegin = callback;
        return this;
      },
      onStart(callback: (...args: never[]) => void) {
        this.handlers.onStart = callback;
        return this;
      },
      onUpdate(callback: (...args: never[]) => void) {
        this.handlers.onUpdate = callback;
        return this;
      },
      onFinalize(callback: (...args: never[]) => void) {
        this.handlers.onFinalize = callback;
        return this;
      },
      onEnd(callback: (...args: never[]) => void) {
        this.handlers.onEnd = callback;
        return this;
      },
    };
    return gesture;
  };

  return {
    Gesture: {
      Pan: () => makeGesture('Pan'),
      Tap: () => makeGesture('Tap'),
      Exclusive: (...gestures: MockGesture[]) => {
        const composed = { toGestureArray: () => gestures };
        mockGestureComposition = composed;
        return composed;
      },
    },
    GestureDetector: ({ children, gesture }: { children: React.ReactNode; gesture: unknown }) => {
      mockGestureComposition = gesture as typeof mockGestureComposition;
      return mockReact.createElement(mockView, { testID: 'gesture-detector' }, children);
    },
  };
});

jest.mock('expo-image', () => ({
  Image: Object.assign(
    ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
      mockReact.createElement(mockView, props, children),
    { prefetch: jest.fn(() => Promise.resolve(true)) },
  ),
}));
jest.mock('expo-backdrop', () => ({
  GaussianBlurView: ({ children }: { children?: React.ReactNode }) =>
    mockReact.createElement(mockView, null, children),
  ProgressiveBlurView: () => mockReact.createElement(mockView),
}));
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: () => mockReact.createElement(mockView),
}));
jest.mock('react-native-keyboard-controller', () => ({
  OverKeyboardView: ({ children, visible }: { children: React.ReactNode; visible: boolean }) =>
    mockReact.createElement(
      mockView,
      { testID: 'over-keyboard-view', accessibilityLabel: visible ? 'visible' : 'hidden' },
      children,
    ),
}));
jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (callback: (...args: never[]) => void, ...args: never[]) => callback(...args),
}));
jest.mock('react-native-reanimated', () => {
  const actualReact = jest.requireActual<typeof React>('react');
  const actualReactNative = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    View: actualReactNative.View,
    default: { View: actualReactNative.View },
    Easing: {
      bezier: () => 'bezier-easing',
      out: (value: unknown) => value,
      poly: () => (value: unknown) => value,
      quad: {},
    },
    Extrapolation: { CLAMP: 'clamp' },
    interpolate: (value: number, input: number[], output: number[]) => {
      const progress = (value - input[0]) / (input[input.length - 1] - input[0]);
      return output[0] + (output[output.length - 1] - output[0]) * progress;
    },
    useAnimatedReaction: (
      prepare: () => unknown,
      react: (value: unknown, previous: null) => void,
    ) => {
      actualReact.useEffect(() => react(prepare(), null), []);
    },
    useAnimatedStyle: (prepare: () => unknown) => prepare(),
    useSharedValue: (initialValue: unknown) => {
      const reference = actualReact.useRef<{
        value: unknown;
        get: () => unknown;
        set: (next: unknown) => void;
      } | null>(null);
      if (!reference.current) {
        const shared = {
          value: initialValue,
          get() {
            return this.value;
          },
          set(next: unknown) {
            shared.value = next;
          },
        };
        reference.current = shared;
      }
      return reference.current;
    },
    withDelay: (_delay: number, animation: unknown) => animation,
    withSpring: (toValue: unknown, _config?: unknown, callback?: (finished: boolean) => void) => {
      if (callback) mockSpringCompletions.push(callback);
      return toValue;
    },
    withTiming: (toValue: unknown, _config?: unknown, callback?: (finished: boolean) => void) => {
      if (callback) mockDockCompletions.push(callback);
      return toValue;
    },
  };
});
jest.mock('@/theme', () => ({
  useAppTheme: () => ({ resolvedMode: 'light', theme: { colors: { textPrimary: '#111111' } } }),
}));
jest.mock('@/features/home/components/chatgpt-attachments/AttachmentIcon', () => ({
  AttachmentIcon: () => null,
}));

describe('AttachHoldButton photo hold menu integration', () => {
  let renderer: ReactTestRenderer;
  const photos: LibraryPhoto[] = Array.from({ length: 5 }, (_, index) => ({
    id: `photo-${index}`,
    kind: 'photo',
  }));
  const onPress = jest.fn();
  const onPhotoSelect = jest.fn();
  const onDockSettled = jest.fn();
  const composerBottom = { get: () => 700, set: jest.fn() } as unknown as SharedValue<number>;
  const strip = { get: () => 0, set: jest.fn() } as unknown as SharedValue<number>;
  const plusOut = { get: () => 0, set: jest.fn() } as unknown as SharedValue<number>;

  const mount = (holdEnabled = true) => {
    act(() => {
      renderer = create(
        mockReact.createElement(AttachHoldButton, {
          photos,
          attachmentCount: 0,
          holdEnabled,
          plusOut,
          composerBottom,
          strip,
          screenWidth: Dimensions.get('window').width,
          onPress,
          onPhotoSelect,
          onDockSettled,
        }),
      );
    });
  };

  const currentGestures = () => {
    if (!mockGestureComposition) throw new Error('Plus gesture did not mount.');
    return mockGestureComposition.toGestureArray();
  };

  const photoTiles = () => [
    ...new Set(
      renderer.root
        .findAll((node) => /^hold-menu-photo-\d+$/.test(String(node.props.testID)))
        .map((node) => node.props.testID),
    ),
  ];

  const holdMenuIsVisible = () =>
    renderer.root.findByProps({ testID: 'over-keyboard-view' }).props.accessibilityLabel ===
    'visible';

  beforeEach(() => {
    mockGestureComposition = null;
    mockDockCompletions = [];
    mockSpringCompletions = [];
    onPress.mockReset();
    onPhotoSelect.mockReset();
    onDockSettled.mockReset();
  });

  afterEach(() => {
    if (renderer) act(() => renderer.unmount());
  });

  it('keeps the four-photo hold menu hidden until long-press begins, then docks the hovered photo', () => {
    mount();
    const [hold, tap] = currentGestures();
    const touch = { absoluteX: 40, absoluteY: 620, x: 25, y: 15 };

    expect(renderer.root.findByProps({ testID: 'composer-plus-button' }).props.hitSlop).toBe(
      HOLD_MENU_GESTURE.buttonHitSlop,
    );
    expect(tap.handlerName).toBe('TapGestureHandler');
    expect(hold.config.activateAfterLongPress).toBe(HOLD_MENU_GESTURE.holdDuration);
    expect(holdMenuIsVisible()).toBe(false);
    expect(photoTiles()).toHaveLength(4);

    act(() => hold.handlers.onBegin?.(touch as never));
    act(() => hold.handlers.onStart?.(touch as never));

    expect(holdMenuIsVisible()).toBe(true);
    expect(photoTiles()).toHaveLength(4);

    const width = Dimensions.get('window').width;
    const tray = getHoldTrayMetrics(4, width, 620);
    const drag = { absoluteX: getHoldTileCenterX(2, tray), absoluteY: tray.centerY };
    act(() => hold.handlers.onUpdate?.(drag as never));
    act(() => hold.handlers.onFinalize?.(drag as never, true as never));

    expect(onPhotoSelect).toHaveBeenCalledTimes(1);
    expect(onPhotoSelect).toHaveBeenCalledWith(photos[2]);
    expect(onPress).not.toHaveBeenCalled();
    expect(holdMenuIsVisible()).toBe(true);
    expect(mockDockCompletions).toHaveLength(1);

    act(() => mockDockCompletions[0](true));

    expect(onDockSettled).toHaveBeenCalledWith(photos[2].id);
    expect(holdMenuIsVisible()).toBe(false);
  });

  it('cancels release outside a tile and clears the temporary menu state', () => {
    mount();
    const [hold] = currentGestures();
    const touch = { absoluteX: 40, absoluteY: 620, x: 25, y: 15 };

    act(() => hold.handlers.onBegin?.(touch as never));
    act(() => hold.handlers.onStart?.(touch as never));
    act(() => hold.handlers.onUpdate?.({ absoluteX: -100, absoluteY: -100 } as never));
    act(() =>
      hold.handlers.onFinalize?.({ absoluteX: -100, absoluteY: -100 } as never, true as never),
    );
    act(() => mockSpringCompletions[0]?.(true));

    expect(onPhotoSelect).not.toHaveBeenCalled();
    expect(onDockSettled).not.toHaveBeenCalled();
    expect(holdMenuIsVisible()).toBe(false);
  });

  it('cleans up when the Pan is cancelled before hold recognition', () => {
    mount();
    const [hold] = currentGestures();
    const touch = { absoluteX: 40, absoluteY: 620, x: 25, y: 15 };

    act(() => hold.handlers.onBegin?.(touch as never));
    expect(holdMenuIsVisible()).toBe(true);

    act(() => hold.handlers.onFinalize?.(touch as never, false as never));
    act(() => mockSpringCompletions[0]?.(true));

    expect(onPhotoSelect).not.toHaveBeenCalled();
    expect(onPress).not.toHaveBeenCalled();
    expect(holdMenuIsVisible()).toBe(false);
  });

  it('supports tap, close, hold selection, then another tap without stale state', () => {
    let traditionalMenuOpen = false;
    onPress.mockImplementation(() => {
      traditionalMenuOpen = !traditionalMenuOpen;
    });
    mount();
    let [hold, tap] = currentGestures();
    act(() => tap.handlers.onEnd?.({} as never, true as never));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(traditionalMenuOpen).toBe(true);

    act(() =>
      renderer.update(
        mockReact.createElement(AttachHoldButton, {
          photos,
          attachmentCount: 0,
          holdEnabled: false,
          plusOut,
          composerBottom,
          strip,
          screenWidth: Dimensions.get('window').width,
          onPress,
          onPhotoSelect,
          onDockSettled,
        }),
      ),
    );
    [hold, tap] = currentGestures();
    expect(hold.config.enabled).toBe(false);
    act(() => tap.handlers.onEnd?.({} as never, true as never));
    expect(onPress).toHaveBeenCalledTimes(2);
    expect(traditionalMenuOpen).toBe(false);

    act(() =>
      renderer.update(
        mockReact.createElement(AttachHoldButton, {
          photos,
          attachmentCount: 0,
          holdEnabled: true,
          plusOut,
          composerBottom,
          strip,
          screenWidth: Dimensions.get('window').width,
          onPress,
          onPhotoSelect,
          onDockSettled,
        }),
      ),
    );
    [hold, tap] = currentGestures();
    const touch = { absoluteX: 40, absoluteY: 620, x: 25, y: 15 };
    act(() => hold.handlers.onBegin?.(touch as never));
    act(() => hold.handlers.onStart?.(touch as never));
    const tray = getHoldTrayMetrics(4, Dimensions.get('window').width, 620);
    const drag = { absoluteX: getHoldTileCenterX(0, tray), absoluteY: tray.centerY };
    act(() => hold.handlers.onUpdate?.(drag as never));
    act(() => hold.handlers.onFinalize?.(drag as never, true as never));
    act(() => mockDockCompletions[0](true));
    act(() => mockSpringCompletions[0]?.(true));

    act(() => tap.handlers.onEnd?.({} as never, true as never));

    expect(onPhotoSelect).toHaveBeenCalledTimes(1);
    expect(onDockSettled).toHaveBeenCalledWith(photos[0].id);
    expect(onPress).toHaveBeenCalledTimes(3);
    expect(traditionalMenuOpen).toBe(true);
    expect(holdMenuIsVisible()).toBe(false);
  });
});
