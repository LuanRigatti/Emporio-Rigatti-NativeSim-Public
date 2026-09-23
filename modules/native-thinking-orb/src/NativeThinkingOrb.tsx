import React from 'react';
import type { NativeThinkingOrbProps } from './NativeThinkingOrb.types';
import NativeThinkingOrbView from './NativeThinkingOrbView';

export default function NativeThinkingOrb({
  colorScheme,
  fallbackColor,
  size = 20,
  state = 'searching',
  style,
  testID,
}: NativeThinkingOrbProps) {
  return (
    <NativeThinkingOrbView
      colorScheme={colorScheme}
      fallbackColor={fallbackColor}
      size={size}
      state={state}
      style={[{ height: size, width: size }, style]}
      testID={testID}
    />
  );
}
