import { flushAfterNativeDismiss, runAfterNativeDismiss } from '@/utils/nativeDismissActionQueue';

describe('native dismiss action queue', () => {
  it('runs a queued navigation once after a programmatic dismiss', () => {
    const pendingActionRef = { current: null as (() => void) | null };
    const dismiss = jest.fn();
    const navigate = jest.fn();

    runAfterNativeDismiss('presented', navigate, pendingActionRef, dismiss);
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();

    flushAfterNativeDismiss(pendingActionRef);
    flushAfterNativeDismiss(pendingActionRef);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('executes the pending action synchronously inside the final native callback', () => {
    const pendingActionRef = { current: null as (() => void) | null };
    const events: string[] = [];

    runAfterNativeDismiss(
      'presented',
      () => events.push('action'),
      pendingActionRef,
      () => events.push('dismiss-request'),
    );

    events.push('on-dismiss');
    flushAfterNativeDismiss(pendingActionRef);
    events.push('after-callback');

    expect(events).toEqual(['dismiss-request', 'on-dismiss', 'action', 'after-callback']);
  });

  it('runs immediately when a touch arrives after an interactive swipe completed', () => {
    const pendingActionRef = { current: null as (() => void) | null };
    const action = jest.fn();

    runAfterNativeDismiss('closed', action, pendingActionRef, jest.fn());

    expect(action).toHaveBeenCalledTimes(1);
    expect(pendingActionRef.current).toBeNull();
  });

  it('does not request a second dismiss while the native transition is in progress', () => {
    const pendingActionRef = { current: null as (() => void) | null };
    const dismiss = jest.fn();
    const action = jest.fn();

    runAfterNativeDismiss('dismissing', action, pendingActionRef, dismiss);

    expect(dismiss).not.toHaveBeenCalled();
    expect(action).not.toHaveBeenCalled();
    flushAfterNativeDismiss(pendingActionRef);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('keeps only the latest action from rapid touches', () => {
    const pendingActionRef = { current: null as (() => void) | null };
    const firstAction = jest.fn();
    const lastAction = jest.fn();

    runAfterNativeDismiss('presented', firstAction, pendingActionRef, jest.fn());
    runAfterNativeDismiss('dismissing', lastAction, pendingActionRef, jest.fn());
    flushAfterNativeDismiss(pendingActionRef);

    expect(firstAction).not.toHaveBeenCalled();
    expect(lastAction).toHaveBeenCalledTimes(1);
  });

  it('clears a pending action before invoking it', () => {
    const pendingActionRef = { current: null as (() => void) | null };
    let wasClearedBeforeRun = false;
    pendingActionRef.current = () => {
      wasClearedBeforeRun = pendingActionRef.current === null;
    };

    flushAfterNativeDismiss(pendingActionRef);

    expect(wasClearedBeforeRun).toBe(true);
    expect(pendingActionRef.current).toBeNull();
  });

  it('resets the queue when an action runs without a sheet', () => {
    const pendingActionRef = { current: jest.fn() as (() => void) | null };
    const nextAction = jest.fn();

    runAfterNativeDismiss('closed', nextAction, pendingActionRef, jest.fn());

    expect(pendingActionRef.current).toBeNull();
    expect(nextAction).toHaveBeenCalledTimes(1);
  });
});
