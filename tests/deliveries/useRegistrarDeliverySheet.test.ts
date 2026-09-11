import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement } from 'react';

import { useRegistrarDeliverySheet } from '@/features/deliveries/hooks/useRegistrarDeliverySheet';
import { flushAfterNativeDismiss, runAfterNativeDismiss } from '@/utils/nativeDismissActionQueue';

jest.mock('@/utils/haptics', () => ({
  triggerLightImpactHaptic: jest.fn(),
}));

jest.mock('@/utils/presentation/testModeValues', () => ({
  useTestModePresentation: () => ({ enabled: false }),
}));

describe('useRegistrarDeliverySheet', () => {
  it('keeps the sheet in dismissal state until the native completion callback', () => {
    const onDismiss = jest.fn();
    const createDelivery = jest.fn(async () => ({ id: 'created-delivery' }) as never);
    let current: ReturnType<typeof useRegistrarDeliverySheet> | undefined;

    function Harness() {
      current = useRegistrarDeliverySheet({ clients: [], create: createDelivery, onDismiss });
      return null;
    }

    let renderer: ReactTestRenderer | undefined;
    act(() => {
      renderer = create(createElement(Harness));
    });

    if (!current) throw new Error('Controller nao foi criado.');
    expect(current.getSheetPhase()).toBe('closed');

    act(() => {
      current?.openSheet();
    });
    expect(current.sheetVisible).toBe(true);
    expect(current.sheetDismissing).toBe(false);
    expect(current.getSheetPhase()).toBe('presented');

    act(() => {
      current?.dismissSheet();
    });
    expect(current.sheetVisible).toBe(false);
    expect(current.sheetDismissing).toBe(true);
    expect(current.getSheetPhase()).toBe('dismissing');
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      current?.handleDismiss();
    });
    expect(current.sheetVisible).toBe(false);
    expect(current.sheetDismissing).toBe(false);
    expect(current.getSheetPhase()).toBe('closed');
    expect(onDismiss).toHaveBeenCalledTimes(1);

    act(() => {
      current?.handleVisibleChange(false);
      current?.handleDismiss();
    });
    expect(current.getSheetPhase()).toBe('closed');
    expect(onDismiss).toHaveBeenCalledTimes(1);

    act(() => {
      renderer?.unmount();
    });
  });

  it('flushes a pending action directly from the final dismiss callback', () => {
    const pendingActionRef = { current: null as (() => void) | null };
    const events: string[] = [];
    let current: ReturnType<typeof useRegistrarDeliverySheet> | undefined;

    function Harness() {
      current = useRegistrarDeliverySheet({
        clients: [],
        create: jest.fn(async () => ({ id: 'created-delivery' }) as never),
        onDismiss: () => {
          events.push('on-dismiss');
          flushAfterNativeDismiss(pendingActionRef);
        },
      });
      return null;
    }

    let renderer: ReactTestRenderer | undefined;
    act(() => {
      renderer = create(createElement(Harness));
    });

    act(() => {
      current?.openSheet();
    });

    act(() => {
      if (!current) throw new Error('Controller nao foi criado.');
      runAfterNativeDismiss(
        current.getSheetPhase(),
        () => events.push('action'),
        pendingActionRef,
        current.dismissSheet,
      );
    });

    act(() => {
      current?.handleDismiss();
    });

    expect(events).toEqual(['on-dismiss', 'action']);
    expect(current?.getSheetPhase()).toBe('closed');

    act(() => {
      renderer?.unmount();
    });
  });
});
