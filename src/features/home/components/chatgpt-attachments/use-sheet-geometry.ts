import { useState } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  useKeyboardHandler,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';
import { useAnimatedStyle, useDerivedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { COMPOSER, GUTTER, sheetTopFromComposerBottom } from './constants';

/** The keyboard owns the one moving coordinate used by the composer and panel. */
export function useSheetGeometry() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const keyboard = useReanimatedKeyboardAnimation();
  const [settledKeyboard, setSettledKeyboard] = useState(0);

  const liftedBy = useDerivedValue(
    () => Math.max(-keyboard.height.get(), insets.bottom) + COMPOSER.keyboardGap,
  );
  const composerBottom = useDerivedValue(() => height - liftedBy.get());
  const composerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -liftedBy.get() }],
  }));

  useKeyboardHandler(
    {
      onEnd: (event) => {
        'worklet';
        scheduleOnRN(setSettledKeyboard, event.height);
      },
    },
    [],
  );

  const settledBottom = height - Math.max(settledKeyboard, insets.bottom) - COMPOSER.keyboardGap;
  const panelTop = sheetTopFromComposerBottom(settledBottom);
  const gridWidth = width - GUTTER * 2;
  const gridHeight = height - panelTop - GUTTER;

  return { width, height, composerBottom, composerStyle, gridWidth, gridHeight };
}
