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
  animationEnabled = true,
  color,
  fontSize = 32,
  fontWeight = 'bold',
  lineHeight = 38,
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

  return (
    <Host style={{ minHeight: lineHeight, width: '100%' }}>
      <Text
        modifiers={[
          font({ design: 'rounded', size: fontSize, weight: fontWeight }),
          monospacedDigit(),
          foregroundColor(color),
          frame({ maxWidth: Infinity, minHeight: lineHeight, alignment: 'leading' }),
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
