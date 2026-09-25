import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet, View } from 'react-native';
import { ModelIntensityOverlay } from '@/features/home/components/chatgpt-attachments/composer/model-intensity-overlay';

const mockReact = React;
const mockView = View;

jest.mock('expo-backdrop', () => ({
  ProgressiveBlurView: (props: Record<string, unknown>) =>
    mockReact.createElement(mockView, { ...props, testID: 'progressive-blur' } as never),
}));
jest.mock('react-native', () => {
  const actual = jest.requireActual<typeof import('react-native')>('react-native');
  const mocked = Object.create(actual) as typeof actual;
  Object.defineProperty(mocked, 'findNodeHandle', { value: jest.fn(() => 901) });
  return mocked;
});
jest.mock('react-native-keyboard-controller', () => ({
  OverKeyboardView: ({ children, visible }: { children: React.ReactNode; visible: boolean }) =>
    mockReact.createElement(mockView, { testID: 'over-keyboard-view', visible } as never, children),
}));
jest.mock('react-native-reanimated', () => {
  const ReactModule = jest.requireActual<typeof React>('react');
  const actualReactNative = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    View: actualReactNative.View,
    default: { View: actualReactNative.View },
    Easing: {
      out: (value: unknown) => value,
      poly: () => (value: unknown) => value,
      quad: {},
    },
    useAnimatedStyle: (factory: () => object) => factory(),
    useSharedValue: (initial: number) => {
      const value = ReactModule.useRef(initial);
      return {
        get: () => value.current,
        set: (next: number) => {
          value.current = next;
        },
      };
    },
    withTiming: (value: number) => value,
  };
});
jest.mock('@/theme', () => ({
  useAppTheme: () => ({
    resolvedMode: 'light',
    theme: { colors: { primary: '#0A84FF' } },
  }),
}));
jest.mock('native-model-intensity-slider', () => ({
  nativeModelIntensitySliderAvailable: true,
  NativeModelIntensitySlider: (props: Record<string, unknown>) =>
    mockReact.createElement(mockView, {
      ...props,
      testID: 'native-model-intensity-slider',
    } as never),
}));

describe('ModelIntensityOverlay lifecycle', () => {
  let renderer!: ReactTestRenderer;
  const onSelectedStepChange = jest.fn();
  const onTransitionComplete = jest.fn();
  const onDismissRequest = jest.fn();
  const onGeometryReady = jest.fn();
  const onInteractionCommitted = jest.fn();
  const composerBottom = { get: () => 620 } as never;
  const strip = { get: () => 0 } as never;

  const renderOverlay = (active: boolean, blocked = false, mounted = true) =>
    React.createElement(ModelIntensityOverlay, {
      active,
      attachmentStripVisible: false,
      blocked,
      composerBottom,
      mounted,
      originViewTag: 777,
      screenHeight: 844,
      screenWidth: 390,
      selectedStep: 'medium',
      strip,
      onDismissRequest,
      onGeometryReady,
      onInteractionCommitted,
      onSelectedStepChange,
      onTransitionComplete,
    });

  afterEach(() => {
    onSelectedStepChange.mockClear();
    onTransitionComplete.mockClear();
    onDismissRequest.mockClear();
    onGeometryReady.mockClear();
    onInteractionCommitted.mockClear();
    if (renderer) act(() => renderer.unmount());
  });

  it('keeps the native slider on its own over-keyboard layer and sends only semantic steps', () => {
    act(() => {
      renderer = create(renderOverlay(true));
    });

    const host = renderer.root.findByProps({ testID: 'over-keyboard-view' });
    const nativeSlider = renderer.root.findByProps({ testID: 'native-model-intensity-slider' });
    expect(host.props.visible).toBe(true);
    expect(nativeSlider.props.selectedStep).toBe('medium');
    expect(nativeSlider.props.expanded).toBe(true);
    expect(StyleSheet.flatten(nativeSlider.props.style)).toMatchObject({
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
    expect(nativeSlider.props.originViewTag).toBe(777);
    expect(nativeSlider.props.targetViewTag).toBe(901);
    expect(nativeSlider.props.geometryRevision).toBeGreaterThan(0);
    const targetFrame = renderer.root.findByProps({ testID: 'model-intensity-target-frame' });
    expect(targetFrame.props.collapsable).toBe(false);
    expect(targetFrame.props.pointerEvents).toBe('none');
    expect(StyleSheet.flatten(targetFrame.props.style)).toMatchObject({
      width: 320,
      height: 92,
    });
    expect(nativeSlider.props.onGeometryReady).toBe(onGeometryReady);
    const blur = renderer.root.findByProps({ testID: 'progressive-blur' });
    expect(blur.props).toMatchObject({
      edge: 'top',
      intensity: 22,
      scrollFallback: false,
      tintColor: 'transparent',
    });
    expect(blur.props.startOffset).toBeGreaterThan(0);
    const localBackdropFrame = renderer.root
      .findAllByType(View)
      .map((view) => StyleSheet.flatten(view.props.style))
      .find((style) => style?.height === 260);
    expect(localBackdropFrame).toMatchObject({ top: 448, height: 260 });
    const dismissTarget = renderer.root.findByProps({ testID: 'model-intensity-dismiss-target' });
    expect(dismissTarget.props).toMatchObject({
      pointerEvents: 'auto',
    });
    expect(StyleSheet.flatten(dismissTarget.props.style)).toMatchObject({
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
    act(() => dismissTarget.props.onPress());
    expect(onDismissRequest).toHaveBeenCalledTimes(1);

    act(() => nativeSlider.props.onStepChange({ nativeEvent: { step: 'high' } }));
    expect(onSelectedStepChange).toHaveBeenCalledWith('high');
    act(() => nativeSlider.props.onInteractionCommitted({ nativeEvent: { step: 'high' } }));
    expect(onInteractionCommitted).toHaveBeenCalledWith('high');
    act(() => nativeSlider.props.onDismissRequest({ nativeEvent: {} }));
    expect(onDismissRequest).toHaveBeenCalledTimes(2);
  });

  it('reverses the native expansion on close and unmounts only after its completion event', () => {
    act(() => {
      renderer = create(renderOverlay(true));
    });
    act(() => renderer.update(renderOverlay(false)));

    const nativeSlider = renderer.root.findByProps({ testID: 'native-model-intensity-slider' });
    expect(nativeSlider.props.expanded).toBe(false);
    expect(renderer.root.findByProps({ testID: 'over-keyboard-view' }).props.visible).toBe(true);
    expect(
      renderer.root.findByProps({ testID: 'model-intensity-dismiss-target' }).props.pointerEvents,
    ).toBe('none');

    act(() => nativeSlider.props.onTransitionComplete({ nativeEvent: { expanded: false } }));
    expect(onTransitionComplete).toHaveBeenCalledWith(false);
    act(() => renderer.update(renderOverlay(false, false, false)));
    expect(renderer.root.findAllByProps({ testID: 'native-model-intensity-slider' })).toHaveLength(
      0,
    );
    expect(renderer.root.findByProps({ testID: 'over-keyboard-view' }).props.visible).toBe(false);
  });

  it('removes the overlay immediately when another attachment interaction takes ownership', () => {
    act(() => {
      renderer = create(renderOverlay(true));
    });
    act(() => renderer.update(renderOverlay(false, true)));

    expect(renderer.root.findAllByProps({ testID: 'native-model-intensity-slider' })).toHaveLength(
      0,
    );
    expect(renderer.root.findByProps({ testID: 'over-keyboard-view' }).props.visible).toBe(false);
  });
});
