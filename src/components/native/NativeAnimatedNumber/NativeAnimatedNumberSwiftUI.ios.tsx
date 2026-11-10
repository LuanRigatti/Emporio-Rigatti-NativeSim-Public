import { Host, Text } from '@expo/ui/swift-ui';
import {
  animation,
  Animation,
  contentTransition,
  foregroundColor,
  frame,
  font,
  monospacedDigit,
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useState } from 'react';

import type { NativeAnimatedNumberProps } from './NativeAnimatedNumber.types';

export default function NativeAnimatedNumberSwiftUI({
  alignment = 'leading',
  animateFirstValue = false,
  animationEnabled = true,
  color,
  fontSize = 32,
  fontWeight = 'bold',
  horizontalSizing = 'intrinsic',
  ignoreSafeArea,
  lineHeight = 38,
  style,
  text,
  value,
}: NativeAnimatedNumberProps) {
  const [animationReady, setAnimationReady] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!animateFirstValue && animationEnabled && value !== null && !animationReady) {
      setAnimationReady(true);
    }
  }, [animateFirstValue, animationEnabled, animationReady, value]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const hasValue = value !== null;
  const numberAnimation = Animation.easeInOut({
    duration: animateFirstValue && (!animationEnabled || !hasValue) ? 0 : 0.18,
  });
  const isTrailing = alignment === 'trailing';
  const fillsHorizontalSpace = horizontalSizing === 'fill';
  const useIntrinsicHorizontalSize = isTrailing && !fillsHorizontalSpace;
  const hostMatchContents = useIntrinsicHorizontalSize
    ? true
    : fillsHorizontalSpace
      ? { vertical: true }
      : false;

  return (
    <Host
      ignoreSafeArea={ignoreSafeArea}
      matchContents={hostMatchContents}
      style={[
        { minHeight: lineHeight, width: useIntrinsicHorizontalSize ? undefined : '100%' },
        style,
      ]}
    >
      <Text
        modifiers={[
          font({ design: 'rounded', size: fontSize, weight: fontWeight }),
          monospacedDigit(),
          foregroundColor(color),
          frame({
            maxWidth: useIntrinsicHorizontalSize ? undefined : Infinity,
            minHeight: lineHeight,
            alignment,
          }),
          contentTransition('numericText'),
          // Availability also triggers the transition when the first confirmed value is zero.
          ...(animateFirstValue ? [animation(numberAnimation, hasValue)] : []),
          ...(animateFirstValue || (animationEnabled && animationReady)
            ? [animation(numberAnimation, value ?? 0)]
            : []),
        ]}
      >
        {text || '\u00a0'}
      </Text>
    </Host>
  );
}
