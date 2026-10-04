import { getKeyboardLift, KEYBOARD_COMPOSER_GAP } from '@/components/keyboard/keyboardLiftGeometry';

describe('keyboard composer lift', () => {
  it('uses the current keyboard height, safe area and shared composer gap', () => {
    expect(KEYBOARD_COMPOSER_GAP).toBe(12);
    expect(getKeyboardLift(-320, 34)).toBe(332);
    expect(getKeyboardLift(0, 34)).toBe(46);
  });
});
