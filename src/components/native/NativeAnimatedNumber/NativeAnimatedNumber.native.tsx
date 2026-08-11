import { Text as RNText } from 'react-native';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';

import type { NativeAnimatedNumberProps } from './NativeAnimatedNumber.types';

export default function NativeAnimatedNumberNative({
  color,
  animationEnabled = true,
  fontSize = 32,
  fontWeight = 'bold',
  lineHeight = 38,
  style,
  text,
  value,
}: NativeAnimatedNumberProps) {
  const NativeImplementation = getNativeCapabilities().canUseExpoUI
    ? require('./NativeAnimatedNumberSwiftUI.ios').default // eslint-disable-line @typescript-eslint/no-require-imports
    : null;

  if (NativeImplementation) {
    return (
      <NativeImplementation
        color={color}
        animationEnabled={animationEnabled}
        fontSize={fontSize}
        fontWeight={fontWeight}
        lineHeight={lineHeight}
        text={text}
        value={value}
      />
    );
  }

  return (
    <RNText
      style={[
        {
          color,
          fontSize,
          fontVariant: ['tabular-nums'],
          fontWeight: fontWeight === 'semibold' ? '600' : '700',
          lineHeight,
        },
        style,
      ]}
    >
      {text}
    </RNText>
  );
}
