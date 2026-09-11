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
  animationEnabled = true,
  color,
  fontSize = 32,
  fontWeight = 'bold',
  horizontalSizing = 'intrinsic',
  lineHeight = 38,
  style,
  text,
  value,
}: NativeAnimatedNumberProps) {
  const [animationReady, setAnimationReady] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (animationEnabled && value !== null && !animationReady) {
      setAnimationReady(true);
    }
  }, [animationEnabled, animationReady, value]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
          ...(animationEnabled && animationReady
            ? [animation(Animation.easeInOut({ duration: 0.18 }), value ?? 0)]
            : []),
        ]}
      >
        {text || '\u00a0'}
      </Text>
    </Host>
  );
}
