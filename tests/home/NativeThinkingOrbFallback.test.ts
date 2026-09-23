import React from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import NativeThinkingOrbViewIOS from '../../modules/native-thinking-orb/src/NativeThinkingOrbView.ios';

jest.mock('expo', () => ({
  requireNativeView: jest.fn(),
  requireOptionalNativeModule: jest.fn(() => null),
}));

describe('NativeThinkingOrb iOS fallback', () => {
  let renderer!: ReactTestRenderer;

  afterEach(() => {
    if (renderer) {
      act(() => renderer.unmount());
    }
  });

  it('uses the existing ActivityIndicator when the optional native module is unavailable', () => {
    act(() => {
      renderer = create(
        React.createElement(NativeThinkingOrbViewIOS, {
          colorScheme: 'dark',
          fallbackColor: '#667085',
          size: 20,
          state: 'searching',
        }),
      );
    });

    const spinner = renderer.root.findByType(ActivityIndicator);
    expect(spinner.props).toMatchObject({
      color: '#667085',
      size: 'small',
    });
    expect(StyleSheet.flatten(spinner.props.style)).toMatchObject({
      height: 20,
      width: 20,
    });
  });
});
