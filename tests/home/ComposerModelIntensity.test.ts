import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet, TextInput, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import {
  Composer,
  type ComposerProps,
} from '@/features/home/components/chatgpt-attachments/composer/composer';
import { triggerSelectionHaptic } from '@/utils/haptics';

const mockReact = React;
const mockView = View;

jest.mock('react-native', () => {
  const actual = jest.requireActual<typeof import('react-native')>('react-native');
  const mocked = Object.create(actual) as typeof actual;
  Object.defineProperty(mocked, 'findNodeHandle', { value: jest.fn(() => 321) });
  return mocked;
});
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('@expo/vector-icons/Ionicons', () => () => null);
jest.mock('react-native-reanimated', () => {
  const actualReactNative = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    View: actualReactNative.View,
    default: { View: actualReactNative.View },
    Easing: {
      out: (value: unknown) => value,
      quad: {},
      poly: () => ({}),
    },
    FadeOut: { duration: jest.fn(() => ({})) },
    LinearTransition: { duration: jest.fn(() => ({})) },
    useAnimatedReaction: jest.fn(),
    useAnimatedStyle: (factory: () => object) => factory(),
  };
});
jest.mock('react-native-worklets', () => ({ scheduleOnRN: jest.fn() }));
jest.mock('@/utils/haptics', () => ({ triggerSelectionHaptic: jest.fn() }));
jest.mock('@/theme', () => ({
  useAppTheme: () => ({
    resolvedMode: 'light',
    theme: {
      colors: {
        background: '#FFFFFF',
        backgroundSecondary: '#F4F4F4',
        contrastContent: '#FFFFFF',
        contrastSurface: '#000000',
        glassSurface: '#FFFFFF',
        primary: '#0A84FF',
        textPrimary: '#111111',
        textSecondary: '#777777',
      },
      typography: { footnote: { fontSize: 13 } },
    },
  }),
}));
jest.mock('@/features/home/components/chatgpt-attachments/glass', () => ({
  Glass: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) =>
    mockReact.createElement(mockView, props, children),
}));
jest.mock('@/features/home/components/chatgpt-attachments/AttachmentIcon', () => ({
  AttachmentIcon: () => null,
}));
jest.mock('@/features/home/components/chatgpt-attachments/composer/attach-hold-button', () => ({
  AttachHoldButton: () => mockReact.createElement(mockView, { testID: 'composer-plus' }),
}));

describe('Composer model intensity control', () => {
  let renderer!: ReactTestRenderer;
  const toggle = jest.fn();
  const submit = jest.fn();
  const sharedValue = (value: number) =>
    ({
      value,
      get: () => value,
      set: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      modify: jest.fn(),
    }) as unknown as SharedValue<number>;

  const props: ComposerProps = {
    attachments: [],
    recentPhotos: [],
    strip: sharedValue(0),
    plusOut: sharedValue(0),
    composerBottom: sharedValue(600),
    screenWidth: 390,
    pendingIds: [],
    holdMenuPendingIds: [],
    value: 'Consulta de teste',
    onChangeText: jest.fn(),
    onFocusChange: jest.fn(),
    onSubmit: submit,
    onRemoveDateAttachment: jest.fn(),
    onPlusTap: jest.fn(),
    onToggleModelIntensity: toggle,
    modelIntensityOriginHidden: false,
    modelIntensityExpanded: false,
    modelIntensityLabel: '5.6 Medium',
    modelIntensityDisabled: false,
    holdMenuEnabled: true,
    onHoldPhotoSelect: jest.fn(),
    onHoldPhotoDockSettled: jest.fn(),
    onRemove: jest.fn(),
  };

  const collectAccessibilityLabels = (node: unknown, labels: string[] = []): string[] => {
    if (Array.isArray(node)) {
      node.forEach((child) => collectAccessibilityLabels(child, labels));
      return labels;
    }

    if (!node || typeof node !== 'object') return labels;

    const jsonNode = node as {
      props?: { accessibilityLabel?: unknown };
      children?: unknown[] | null;
    };
    if (typeof jsonNode.props?.accessibilityLabel === 'string') {
      labels.push(jsonNode.props.accessibilityLabel);
    }
    jsonNode.children?.forEach((child) => collectAccessibilityLabels(child, labels));
    return labels;
  };

  beforeEach(() => {
    toggle.mockClear();
    submit.mockClear();
    jest.mocked(triggerSelectionHaptic).mockClear();
  });

  afterEach(() => {
    if (renderer) act(() => renderer.unmount());
  });

  it('places an accessible 44pt control before Search without wrapping the plus gesture or input', () => {
    act(() => {
      renderer = create(React.createElement(Composer, props));
    });

    const plus = renderer.root.findByProps({ testID: 'composer-plus' });
    const searchInput = renderer.root.findByType(TextInput);
    const intensityButton = renderer.root.findByProps({
      testID: 'composer-model-intensity-button',
    });
    const accessibilityLabels = collectAccessibilityLabels(renderer.toJSON());
    expect(accessibilityLabels.indexOf('Intensidade do modelo')).toBeLessThan(
      accessibilityLabels.indexOf('Pesquisar'),
    );
    expect(plus.props.testID).toBe('composer-plus');
    expect(StyleSheet.flatten(intensityButton.props.style)).toMatchObject({
      width: 44,
      height: 44,
      flexShrink: 0,
    });
    expect(intensityButton.props.accessibilityLabel).toBe('Intensidade do modelo');
    expect(intensityButton.props.collapsable).toBe(false);

    act(() => intensityButton.props.onPress());
    expect(toggle).toHaveBeenCalledWith(321);
    expect(triggerSelectionHaptic).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();

    act(() => {
      renderer.update(
        React.createElement(Composer, {
          ...props,
          modelIntensityExpanded: true,
          modelIntensityLabel: '5.6 High',
        }),
      );
    });
    expect(renderer.root.findByType(TextInput)).toBe(searchInput);
    expect(renderer.root.findByProps({ testID: 'composer-plus' })).toBe(plus);
  });
});
