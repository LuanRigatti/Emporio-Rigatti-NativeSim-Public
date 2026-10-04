/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ComponentType, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

const mockUseKeyboardLift = jest.fn((bottomInset: number) => ({
  liftedBy: { get: () => bottomInset + 12 },
  style: { transform: [{ translateY: -(bottomInset + 12) }] },
}));

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'animated-view' },
}));

jest.mock('@/components/keyboard/useKeyboardLift', () => ({
  useKeyboardLift: (bottomInset: number) => mockUseKeyboardLift(bottomInset),
}));

jest.mock('@/components/ui/progressive-blur', () => ({
  ProgressiveBlur: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('progressive-blur', props);
  },
}));

jest.mock('@/config/featureFlags', () => ({ ENABLE_PROGRESSIVE_BLUR: true }));
jest.mock('@/providers', () => ({ useAppSafeAreaInsets: () => ({ bottom: 34 }) }));
jest.mock('@/theme', () => ({
  useAppTheme: () => ({
    resolvedMode: 'light',
    theme: { spacing: { sm: 8 } },
  }),
}));

const { StickyActionFooter } = require('@/components/premium/StickyActionFooter') as {
  StickyActionFooter: typeof import('@/components/premium/StickyActionFooter').StickyActionFooter;
};
const TestableStickyActionFooter = StickyActionFooter as ComponentType<
  Omit<Parameters<typeof StickyActionFooter>[0], 'children'> & { children?: ReactNode }
>;

function renderFooter(keyboardAware = false): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      createElement(
        TestableStickyActionFooter,
        {
          contentContainerStyle: { paddingHorizontal: 24 },
          height: 100,
          keyboardAware,
        },
        createElement('search-field'),
      ),
    );
  });
  return renderer;
}

describe('StickyActionFooter keyboard option', () => {
  it('moves its blur and content with the shared keyboard lift geometry', () => {
    const renderer = renderFooter(true);
    const liftedFooter = renderer.root.find((node) => String(node.type) === 'animated-view');

    expect(mockUseKeyboardLift).toHaveBeenCalledWith(34);
    expect(StyleSheet.flatten(liftedFooter.props.style)).toMatchObject({
      transform: [{ translateY: -46 }],
    });
    expect(liftedFooter.findAll((node) => String(node.type) === 'progressive-blur')).toHaveLength(
      1,
    );
    const progressiveBlur = liftedFooter.find((node) => String(node.type) === 'progressive-blur');
    expect(progressiveBlur.props.height).toBe(146);
    expect(StyleSheet.flatten(progressiveBlur.props.style)).toEqual({ bottom: -46 });
    expect(liftedFooter.findAll((node) => String(node.type) === 'search-field')).toHaveLength(1);
    expect(StyleSheet.flatten(liftedFooter.findByType(View).props.style)).toMatchObject({
      paddingBottom: 0,
      paddingHorizontal: 24,
    });
  });

  it('keeps existing static footer layout when keyboard awareness is omitted', () => {
    const renderer = renderFooter();

    expect(mockUseKeyboardLift).not.toHaveBeenCalled();
    expect(renderer.root.findAll((node) => String(node.type) === 'animated-view')).toHaveLength(0);
    expect(renderer.root.findAllByType(View)).toHaveLength(2);
    const progressiveBlur = renderer.root.find((node) => String(node.type) === 'progressive-blur');
    expect(progressiveBlur.props.height).toBe(100);
    expect(StyleSheet.flatten(progressiveBlur.props.style)).toEqual({ bottom: 0 });
    expect(renderer.root.findAll((node) => String(node.type) === 'search-field')).toHaveLength(1);
  });

  it('keeps the footer anchored at the screen bottom with its existing height', () => {
    const renderer = renderFooter();
    const footer = renderer.root.findByType(View);

    expect(StyleSheet.flatten(footer.props.style)).toMatchObject({ bottom: 0, height: 100 });
  });
});
