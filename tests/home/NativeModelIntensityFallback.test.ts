import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import NativeModelIntensitySliderFallback from '../../modules/native-model-intensity-slider/src/NativeModelIntensitySliderFallback';
import type { NativeModelIntensitySliderProps } from '../../modules/native-model-intensity-slider/src/NativeModelIntensitySlider.types';

describe('Native model intensity fallback lifecycle', () => {
  let renderer!: ReactTestRenderer;
  const onTransitionComplete = jest.fn();
  const props: NativeModelIntensitySliderProps = {
    accentColor: '#0A84FF',
    colorScheme: 'light',
    expanded: true,
    onTransitionComplete,
    selectedStep: 'medium',
    style: { width: 320, height: 92 },
  };

  afterEach(() => {
    onTransitionComplete.mockClear();
    if (renderer) act(() => renderer.unmount());
  });

  it('signals the close completion and hides its notice without inventing an initial transition', () => {
    act(() => {
      renderer = create(React.createElement(NativeModelIntensitySliderFallback, props));
    });
    expect(onTransitionComplete).not.toHaveBeenCalled();
    expect(renderer.toJSON()).not.toBeNull();

    act(() => {
      renderer.update(
        React.createElement(NativeModelIntensitySliderFallback, { ...props, expanded: false }),
      );
    });

    expect(onTransitionComplete).toHaveBeenCalledTimes(1);
    expect(onTransitionComplete.mock.calls[0][0].nativeEvent.expanded).toBe(false);
    expect(renderer.toJSON()).toBeNull();
  });
});
