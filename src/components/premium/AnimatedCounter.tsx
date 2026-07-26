import { useCallback, useEffect, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { runOnJS, useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';

import { useAppTheme } from '@/theme';

export type AnimatedCounterProps = {
  value: number;
  formatter?: (value: number) => string;
  duration?: number;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
};

export function AnimatedCounter({
  accessibilityLabel,
  duration,
  formatter = (currentValue) => String(Math.round(currentValue)),
  style,
  value,
}: AnimatedCounterProps) {
  const { theme, reduceMotionEnabled } = useAppTheme();
  const [displayValue, setDisplayValue] = useState(() => formatter(value));
  const animatedValue = useSharedValue(value);
  const updateDisplay = useCallback(
    (nextValue: number) => setDisplayValue(formatter(nextValue)),
    [formatter],
  );

  useEffect(() => {
    if (reduceMotionEnabled) {
      animatedValue.value = value;
      setDisplayValue(formatter(value));
      return undefined;
    }

    animatedValue.value = withTiming(value, {
      duration: duration ?? theme.animations.duration.standard,
    });
    return undefined;
  }, [
    animatedValue,
    duration,
    formatter,
    reduceMotionEnabled,
    theme.animations.duration.standard,
    value,
  ]);

  useAnimatedReaction(
    () => Math.round(animatedValue.value),
    (currentValue, previousValue) => {
      if (currentValue !== previousValue) runOnJS(updateDisplay)(currentValue);
    },
    [updateDisplay],
  );

  return (
    <Text accessibilityLabel={accessibilityLabel ?? displayValue} allowFontScaling style={style}>
      {displayValue}
    </Text>
  );
}
