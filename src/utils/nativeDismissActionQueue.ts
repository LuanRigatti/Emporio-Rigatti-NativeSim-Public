export type NativeDismissPhase = 'closed' | 'presented' | 'dismissing';

type PendingActionRef = { current: (() => void) | null };

export function runAfterNativeDismiss(
  phase: NativeDismissPhase,
  action: () => void,
  pendingActionRef: PendingActionRef,
  dismiss: () => void,
) {
  if (phase === 'closed') {
    pendingActionRef.current = null;
    action();
    return;
  }

  pendingActionRef.current = action;
  if (phase === 'presented') dismiss();
}

export function flushAfterNativeDismiss(pendingActionRef: PendingActionRef) {
  const pendingAction = pendingActionRef.current;
  pendingActionRef.current = null;
  pendingAction?.();
}
