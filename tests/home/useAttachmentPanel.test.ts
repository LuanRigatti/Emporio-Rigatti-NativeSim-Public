import React, { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import * as Haptics from 'expo-haptics';
import { KeyboardController } from 'react-native-keyboard-controller';
import { withSpring } from 'react-native-reanimated';
import { DURATION } from '@/features/home/components/chatgpt-attachments/constants';
import { useAttachmentPanel } from '@/features/home/components/chatgpt-attachments/use-attachment-panel';

let panelApi: ReturnType<typeof useAttachmentPanel> | null = null;

jest.mock('expo-haptics', () => ({
  __esModule: true,
  ImpactFeedbackStyle: { Light: 'light' },
  impactAsync: jest.fn(),
}));
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardController: { isVisible: () => true, setFocusTo: jest.fn() },
  KeyboardEvents: { addListener: () => ({ remove: jest.fn() }) },
}));
jest.mock('react-native-reanimated', () => {
  const actualReact = jest.requireActual<typeof React>('react');
  return {
    Easing: {
      out: (value: unknown) => value,
      poly: () => (value: unknown) => value,
      quad: {},
    },
    useSharedValue: (initialValue: number) => {
      const ref = actualReact.useRef<{
        value: number;
        get: () => number;
        set: jest.Mock<void, [number]>;
      } | null>(null);
      if (!ref.current) {
        const shared = {
          value: initialValue,
          get() {
            return this.value;
          },
          set: jest.fn((value: number) => {
            shared.value = value;
          }),
        };
        ref.current = shared;
      }
      return ref.current;
    },
    withDelay: (delay: number, animation: unknown) => ({ type: 'delay', delay, animation }),
    withSequence: (...animations: unknown[]) => ({ type: 'sequence', animations }),
    withSpring: jest.fn(
      (toValue: number, _config?: unknown, callback?: (finished: boolean) => void) => {
        callback?.(true);
        return { type: 'spring', toValue };
      },
    ),
    withTiming: (toValue: number) => ({ type: 'timing', toValue }),
  };
});
jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (callback: () => void) => callback(),
}));

function PanelProbe() {
  const panel = useAttachmentPanel();
  useEffect(() => {
    panelApi = panel;
  }, [panel]);
  return null;
}

function currentPanel() {
  if (!panelApi) throw new Error('Attachment panel hook did not mount.');
  return panelApi;
}

describe('useAttachmentPanel opening lead', () => {
  let renderer: ReactTestRenderer;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(Haptics.impactAsync).mockClear();
    jest.mocked(KeyboardController.setFocusTo).mockClear();
    jest.mocked(withSpring).mockClear();
    panelApi = null;
  });

  afterEach(() => {
    if (renderer) act(() => renderer.unmount());
    panelApi = null;
    jest.useRealTimers();
  });

  it('keeps a short tap on the traditional menu and cancels a pending open on a repeated tap', () => {
    act(() => {
      renderer = create(React.createElement(PanelProbe));
    });
    act(() => currentPanel().onPlusTap());
    expect(currentPanel().mode).toBe('closed');
    expect(currentPanel().opening).toBe(true);
    expect(currentPanel().plusOut.set).toHaveBeenCalledWith({ type: 'spring', toValue: 1 });
    expect(currentPanel().open.set).not.toHaveBeenCalled();
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);

    act(() => jest.advanceTimersByTime(DURATION.plusLead - 1));
    expect(currentPanel().mode).toBe('closed');

    act(() => currentPanel().onPlusTap());
    expect(currentPanel().mode).toBe('closed');
    act(() => jest.advanceTimersByTime(DURATION.plusLead));
    expect(currentPanel().mode).toBe('closed');
    expect(currentPanel().closing).toBe(false);
    expect(currentPanel().open.set).toHaveBeenCalledTimes(1);
    expect(currentPanel().open.set).toHaveBeenCalledWith({ type: 'spring', toValue: 0 });

    act(() => currentPanel().onPlusTap());
    act(() => jest.advanceTimersByTime(DURATION.plusLead));
    expect(currentPanel().mode).toBe('menu');
    expect(currentPanel().opening).toBe(false);
    expect(currentPanel().open.set).toHaveBeenLastCalledWith({ type: 'spring', toValue: 1 });
  });

  it('keeps Photos available through the existing traditional attachment menu', () => {
    act(() => {
      renderer = create(React.createElement(PanelProbe));
    });

    expect('onPlusLongPress' in currentPanel()).toBe(false);
    act(() => currentPanel().onMenuAction('photos'));
    expect(currentPanel().mode).toBe('photos');
    expect(currentPanel().sheet).toBe('photos');
    expect(currentPanel().morph.set).toHaveBeenCalledWith({ type: 'spring', toValue: 1 });
  });

  it('supports tap, close, Photos menu, close, then tap without stale panel state', () => {
    act(() => {
      renderer = create(React.createElement(PanelProbe));
    });

    act(() => currentPanel().onPlusTap());
    act(() => jest.advanceTimersByTime(DURATION.plusLead));
    expect(currentPanel().mode).toBe('menu');

    act(() => currentPanel().dismiss());
    expect(currentPanel().mode).toBe('closed');
    act(() => jest.advanceTimersByTime(DURATION.plusLead));

    act(() => currentPanel().onMenuAction('photos'));
    expect(currentPanel().mode).toBe('photos');

    act(() => currentPanel().dismiss());
    expect(currentPanel().mode).toBe('closed');
    act(() => jest.advanceTimersByTime(DURATION.plusLead));

    act(() => currentPanel().onPlusTap());
    act(() => jest.advanceTimersByTime(DURATION.plusLead));
    expect(currentPanel().mode).toBe('menu');
    expect(jest.getTimerCount()).toBe(0);
  });
});
