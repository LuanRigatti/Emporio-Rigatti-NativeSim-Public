import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { useAppTheme } from '@/theme';

export type AnimatedPressableProps = Omit<PressableProps, 'onPressIn' | 'onPressOut'> & {
  children: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  scaleOnPress?: number;
  onPressIn?: PressableProps['onPressIn'];
  onPressOut?: PressableProps['onPressOut'];
};

export function AnimatedPressable({
  children,
  containerStyle,
  scaleOnPress,
  onPressIn,
  onPressOut,
  ...props
}: AnimatedPressableProps) {
  const { theme, reduceMotionEnabled } = useAppTheme();
  const scale = useSharedValue(1);
  const pressedScale = scaleOnPress ?? theme.animations.scale.pressed;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[containerStyle, animatedStyle]}>
      <Pressable
        {...props}
        onPressIn={(event) => {
          scale.set(
            withTiming(reduceMotionEnabled ? 1 : pressedScale, {
              duration: reduceMotionEnabled
                ? theme.animations.duration.instant
                : theme.animations.duration.fast,
            }),
          );
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          scale.set(
            withTiming(1, {
              duration: reduceMotionEnabled
                ? theme.animations.duration.instant
                : theme.animations.duration.fast,
            }),
          );
          onPressOut?.(event);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
