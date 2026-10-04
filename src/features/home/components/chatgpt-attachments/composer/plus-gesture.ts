import { Gesture } from 'react-native-gesture-handler';
import type {
  GestureStateChangeEvent,
  GestureUpdateEvent,
  PanGestureHandlerEventPayload,
} from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { HOLD_MENU_GESTURE } from './hold-menu.constants';

export interface ComposerPlusGestureCallbacks {
  holdEnabled: boolean;
  onTouchDown: () => void;
  onTap: () => void;
  onHoldBegin: (event: GestureStateChangeEvent<PanGestureHandlerEventPayload>) => void;
  onHoldStart: (event: GestureStateChangeEvent<PanGestureHandlerEventPayload>) => void;
  onHoldUpdate: (event: GestureUpdateEvent<PanGestureHandlerEventPayload>) => void;
  onHoldFinalize: (
    event: GestureStateChangeEvent<PanGestureHandlerEventPayload>,
    success: boolean,
  ) => void;
}

/** Keep the source interaction model: a continuous Pan hold has priority over a short tap. */
export function createComposerPlusGesture({
  holdEnabled,
  onTouchDown,
  onTap,
  onHoldBegin,
  onHoldStart,
  onHoldUpdate,
  onHoldFinalize,
}: ComposerPlusGestureCallbacks) {
  const hold = Gesture.Pan()
    .enabled(holdEnabled)
    .activateAfterLongPress(HOLD_MENU_GESTURE.holdDuration)
    .onBegin(onHoldBegin)
    .onStart(onHoldStart)
    .onUpdate(onHoldUpdate)
    .onFinalize(onHoldFinalize);

  const tap = Gesture.Tap()
    .onTouchesDown((event) => {
      'worklet';
      if (!holdEnabled && event.numberOfTouches === 1) scheduleOnRN(onTouchDown);
    })
    .onEnd((_event, success) => {
      if (success) scheduleOnRN(onTap);
    });

  return Gesture.Exclusive(hold, tap);
}
