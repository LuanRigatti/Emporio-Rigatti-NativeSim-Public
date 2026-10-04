import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet, TextInput, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import {
  Composer,
  type ComposerProps,
} from '@/features/home/components/chatgpt-attachments/composer/composer';

const mockReact = React;
const mockView = View;

jest.mock('expo-image', () => ({ Image: () => null }));
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

describe('Composer search controls', () => {
  let renderer!: ReactTestRenderer;
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
    holdMenuEnabled: true,
    onHoldPhotoSelect: jest.fn(),
    onHoldPhotoDockSettled: jest.fn(),
    onRemove: jest.fn(),
  };

  beforeEach(() => {
    submit.mockClear();
  });

  afterEach(() => {
    if (renderer) act(() => renderer.unmount());
  });

  it('removes intensity controls while keeping the input, plus action, and search submit', () => {
    act(() => {
      renderer = create(React.createElement(Composer, props));
    });

    const searchInput = renderer.root.findByType(TextInput);
    const sendButton = renderer.root.findByProps({ testID: 'composer-send-button' });

    expect(
      renderer.root.findAllByProps({ testID: 'composer-model-intensity-button' }),
    ).toHaveLength(0);
    expect(
      renderer.root.findAllByProps({ accessibilityLabel: 'Intensidade do modelo' }),
    ).toHaveLength(0);
    expect(renderer.root.findByProps({ testID: 'composer-plus' })).toBeTruthy();
    expect(StyleSheet.flatten(searchInput.props.style)).toMatchObject({ flex: 1, minWidth: 0 });
    expect(sendButton.props.accessibilityLabel).toBe('Pesquisar');
    expect(sendButton.props.onLongPress).toBeUndefined();

    act(() => sendButton.props.onPress());

    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith('Consulta de teste');
  });
});
