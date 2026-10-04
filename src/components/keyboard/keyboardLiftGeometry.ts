export const KEYBOARD_COMPOSER_GAP = 12;

export function getKeyboardLift(
  keyboardHeight: number,
  bottomInset: number,
  gap = KEYBOARD_COMPOSER_GAP,
) {
  'worklet';
  return Math.max(-keyboardHeight, bottomInset) + gap;
}
