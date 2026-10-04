import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useAnimatedStyle, useDerivedValue } from 'react-native-reanimated';
import { getKeyboardLift, KEYBOARD_COMPOSER_GAP } from './keyboardLiftGeometry';

export function useKeyboardLift(bottomInset: number, gap = KEYBOARD_COMPOSER_GAP) {
  const { height } = useReanimatedKeyboardAnimation();
  const liftedBy = useDerivedValue(() => getKeyboardLift(height.get(), bottomInset, gap));
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -liftedBy.get() }],
  }));

  return { liftedBy, style };
}
