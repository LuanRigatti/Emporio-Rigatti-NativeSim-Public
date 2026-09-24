import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { AttachmentPanel } from '@/features/home/components/chatgpt-attachments/panel/attachment-panel';

const mockReact = React;
const mockView = View;

function getContainingPointerEvents(node: ReactTestInstance) {
  let ancestor: ReactTestInstance | null = node;
  while (ancestor && ancestor.props.pointerEvents === undefined) ancestor = ancestor.parent;
  return ancestor?.props.pointerEvents;
}

jest.mock('expo-blur', () => ({
  BlurView: () => null,
}));
jest.mock('react-native-reanimated', () => {
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
    Extrapolation: { CLAMP: 'clamp' },
    interpolate: (_value: number, _input: number[], output: number[]) => output[0],
    useAnimatedStyle: (factory: () => object) => factory(),
    useDerivedValue: (factory: () => unknown) => ({ get: factory }),
  };
});
jest.mock('@/theme', () => ({ useAppTheme: () => ({ resolvedMode: 'dark' }) }));
jest.mock('@/features/home/components/chatgpt-attachments/glass', () => ({
  PanelMaterial: ({ variant, duration }: { variant: string; duration: number }) =>
    mockReact.createElement('PanelMaterialMock', {
      testID: 'shared-panel-material',
      accessibilityLabel: `${variant}:${duration}`,
    }),
}));

describe('AttachmentPanel continuous surface', () => {
  let renderer: ReactTestRenderer;

  afterEach(() => {
    if (renderer) act(() => renderer.unmount());
  });

  it('keeps one material and both menu/grid layers mounted while interaction morphs', () => {
    const shared = (value: number) => ({ get: () => value }) as unknown as SharedValue<number>;
    const drivers = {
      open: shared(1),
      morph: shared(0),
      menuOpacity: shared(1),
      gridOpacity: shared(0),
      blur: shared(0),
      composerBottom: shared(700),
    };
    const renderPanel = (interactive: 'menu' | 'grid' | 'none') =>
      mockReact.createElement(AttachmentPanel, {
        ...drivers,
        screenHeight: 800,
        gridWidth: 360,
        gridHeight: 600,
        interactive,
        glass: true,
        glassDuration: 0.4,
        menu: mockReact.createElement(mockView, { testID: 'menu-layer' }),
        grid: mockReact.createElement(mockView, { testID: 'grid-layer' }),
      });

    act(() => {
      renderer = create(renderPanel('menu'));
    });
    const originalMaterial = renderer.root.findByProps({ testID: 'shared-panel-material' });

    expect(renderer.root.findAllByProps({ testID: 'shared-panel-material' })).toHaveLength(1);
    expect(originalMaterial.props.accessibilityLabel).toBe('regular:0.4');
    expect(renderer.root.findByProps({ testID: 'menu-layer' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'grid-layer' })).toBeTruthy();
    expect(getContainingPointerEvents(renderer.root.findByProps({ testID: 'menu-layer' }))).toBe(
      'auto',
    );
    expect(getContainingPointerEvents(renderer.root.findByProps({ testID: 'grid-layer' }))).toBe(
      'none',
    );

    act(() => renderer.update(renderPanel('grid')));

    expect(renderer.root.findAllByProps({ testID: 'shared-panel-material' })).toHaveLength(1);
    expect(renderer.root.findByProps({ testID: 'shared-panel-material' })).toBe(originalMaterial);
    expect(renderer.root.findByProps({ testID: 'menu-layer' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'grid-layer' })).toBeTruthy();
    expect(getContainingPointerEvents(renderer.root.findByProps({ testID: 'menu-layer' }))).toBe(
      'none',
    );
    expect(getContainingPointerEvents(renderer.root.findByProps({ testID: 'grid-layer' }))).toBe(
      'auto',
    );
  });
});
