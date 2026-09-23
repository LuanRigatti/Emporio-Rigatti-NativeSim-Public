import React from 'react';
import { ActivityIndicator } from 'react-native';

import type { NativeThinkingOrbProps } from './NativeThinkingOrb.types';

export default function NativeThinkingOrbFallback({
  fallbackColor,
  size = 20,
  style,
  testID,
}: NativeThinkingOrbProps) {
  return (
    <ActivityIndicator
      color={fallbackColor}
      size="small"
      style={[{ height: size, width: size }, style]}
      testID={testID}
    />
  );
}
