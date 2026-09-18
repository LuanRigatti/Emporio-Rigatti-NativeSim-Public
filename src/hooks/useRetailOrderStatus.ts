import { useCallback, useRef, useState } from 'react';

import { useAuth } from '@/providers';
import { retailOrderDataSource } from '@/services/retail-orders';
import type { RetailOrderStatus } from '@/types/data';

type RetailOrderLifecycleStatus = Exclude<RetailOrderStatus, 'created'>;

export type RetailOrderStatusState = {
  cancel: () => Promise<void>;
  complete: () => Promise<void>;
  error?: string;
  pending: boolean;
  pendingStatus?: RetailOrderLifecycleStatus;
};

export function useRetailOrderStatus(orderId?: string): RetailOrderStatusState {
  const { sessionVersion, user } = useAuth();
  const userId = user?.id;
  const pendingRef = useRef(false);
  const [error, setError] = useState<string>();
  const [pendingStatus, setPendingStatus] = useState<RetailOrderLifecycleStatus>();

  const updateStatus = useCallback(
    async (nextStatus: RetailOrderLifecycleStatus): Promise<void> => {
      if (!orderId || pendingRef.current) return;
      pendingRef.current = true;
      setError(undefined);
      setPendingStatus(nextStatus);
      try {
        await retailOrderDataSource.updateStatus(userId, orderId, nextStatus, sessionVersion);
      } catch (mutationError) {
        setError(
          mutationError instanceof Error
            ? mutationError.message
            : 'Não foi possível atualizar o status do pedido.',
        );
      } finally {
        pendingRef.current = false;
        setPendingStatus(undefined);
      }
    },
    [orderId, sessionVersion, userId],
  );

  const complete = useCallback(() => updateStatus('completed'), [updateStatus]);
  const cancel = useCallback(() => updateStatus('cancelled'), [updateStatus]);

  return {
    cancel,
    complete,
    error,
    pending: pendingStatus !== undefined,
    pendingStatus,
  };
}
