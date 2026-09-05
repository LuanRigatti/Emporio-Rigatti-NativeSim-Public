import { Text as RNText } from 'react-native';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import type { NativeAnimatedNumberProps } from './NativeAnimatedNumber.types';

export default function NativeAnimatedNumberNative({
  alignment = 'leading',
  color,
  animationEnabled = true,
  fontSize = 32,
  fontWeight = 'bold',
  horizontalSizing = 'intrinsic',
  lineHeight = 38,
  style,
  text,
  value,
}: NativeAnimatedNumberProps) {
  const { text: maskText } = useTestModePresentation();
  const presentedText = maskText(text);
  const NativeImplementation = getNativeCapabilities().canUseExpoUI
    ? require('./NativeAnimatedNumberSwiftUI.ios').default // eslint-disable-line @typescript-eslint/no-require-imports
    : null;

  if (NativeImplementation) {
    return (
      <NativeImplementation
        alignment={alignment}
        color={color}
        animationEnabled={animationEnabled}
        fontSize={fontSize}
        fontWeight={fontWeight}
        horizontalSizing={horizontalSizing}
        lineHeight={lineHeight}
        style={style}
        text={presentedText}
        value={value}
      />
    );
  }

  const rnFontWeight =
    fontWeight === 'regular'
      ? '400'
      : fontWeight === 'medium'
        ? '500'
        : fontWeight === 'semibold'
          ? '600'
          : '700';

  const textAlign = alignment === 'trailing' ? 'right' : alignment === 'center' ? 'center' : 'left';

  return (
    <RNText
      style={[
        {
          color,
          fontSize,
          fontVariant: ['tabular-nums'],
          fontWeight: rnFontWeight,
          lineHeight,
          textAlign,
        },
        style,
      ]}
    >
      {presentedText}
    </RNText>
  );
}
