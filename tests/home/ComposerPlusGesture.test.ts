import {
  createComposerPlusGesture,
  type ComposerPlusGestureCallbacks,
} from '@/features/home/components/chatgpt-attachments/composer/plus-gesture';
import { HOLD_MENU_GESTURE } from '@/features/home/components/chatgpt-attachments/composer/hold-menu.constants';

jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (callback: (...args: never[]) => void, ...args: never[]) => callback(...args),
}));

function createGesturePair(callbacks: ComposerPlusGestureCallbacks) {
  const gesture = createComposerPlusGesture(callbacks);
  gesture.prepare();
  const [hold, tap] = gesture.toGestureArray();
  return { hold, tap };
}

function callbacks(overrides: Partial<ComposerPlusGestureCallbacks> = {}) {
  return {
    holdEnabled: true,
    onTap: jest.fn(),
    onHoldBegin: jest.fn(),
    onHoldStart: jest.fn(),
    onHoldUpdate: jest.fn(),
    onHoldFinalize: jest.fn(),
    ...overrides,
  } satisfies ComposerPlusGestureCallbacks;
}

describe('Pesquisa composer plus hold menu gestures', () => {
  it('routes a short tap only to the traditional attachment menu', () => {
    const handlers = callbacks();
    const { hold, tap } = createGesturePair(handlers);

    tap.handlers.onEnd?.({} as never, true);

    expect(handlers.onTap).toHaveBeenCalledTimes(1);
    expect(handlers.onHoldStart).not.toHaveBeenCalled();
    expect(hold.config.activateAfterLongPress).toBe(HOLD_MENU_GESTURE.holdDuration);
  });

  it('uses an exclusive continuous Pan hold and suppresses tap after recognition', () => {
    const handlers = callbacks();
    const { hold, tap } = createGesturePair(handlers);
    const holdEvent = { absoluteX: 80, absoluteY: 520, x: 12, y: 15 } as never;
    const dragEvent = { absoluteX: 240, absoluteY: 360, x: 172, y: -145 } as never;

    expect(hold.handlerName).toBe('PanGestureHandler');
    expect(tap.config.requireToFail).toContain(hold);

    hold.handlers.onBegin?.(holdEvent);
    hold.handlers.onStart?.(holdEvent);
    hold.handlers.onUpdate?.(dragEvent);
    hold.handlers.onFinalize?.(dragEvent, true);

    expect(handlers.onHoldBegin).toHaveBeenCalledWith(holdEvent);
    expect(handlers.onHoldStart).toHaveBeenCalledWith(holdEvent);
    expect(handlers.onHoldUpdate).toHaveBeenCalledWith(dragEvent);
    expect(handlers.onHoldFinalize).toHaveBeenCalledWith(dragEvent, true);
    expect(handlers.onTap).not.toHaveBeenCalled();
  });

  it('cancels a hold that moves before activation without opening either path', () => {
    const handlers = callbacks();
    const { hold, tap } = createGesturePair(handlers);

    expect(hold.config.activateAfterLongPress).toBe(280);
    hold.handlers.onFinalize?.({} as never, false);
    tap.handlers.onEnd?.({} as never, false);

    expect(handlers.onHoldStart).not.toHaveBeenCalled();
    expect(handlers.onTap).not.toHaveBeenCalled();
    expect(handlers.onHoldFinalize).toHaveBeenCalledWith({}, false);
  });

  it('keeps tap available when there are no recent photos for a hold menu', () => {
    const handlers = callbacks({ holdEnabled: false });
    const { hold, tap } = createGesturePair(handlers);

    expect(hold.config.enabled).toBe(false);
    tap.handlers.onEnd?.({} as never, true);

    expect(handlers.onTap).toHaveBeenCalledTimes(1);
    expect(handlers.onHoldStart).not.toHaveBeenCalled();
  });
});
