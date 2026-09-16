import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { useAuth } from '@/providers';
import { retailPaymentDataSource } from '@/services/retail-orders';
import type { RetailPayment, RetailPaymentDraft } from '@/types/data';

export function useRetailOrderPayments(orderId?: string) {
  const { sessionVersion, status: authStatus, user } = useAuth();
  const userId = user?.id;
  const [loading, setLoading] = useState(Boolean(user && orderId));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();
  const getSnapshot = useCallback(
    () => retailPaymentDataSource.getSnapshot(orderId ?? '', userId, sessionVersion),
    [orderId, sessionVersion, userId],
  );
  const snapshot = useSyncExternalStore(
    retailPaymentDataSource.subscribe,
    getSnapshot,
    getSnapshot,
  );

  const load = useCallback(
    async (isRefresh = false) => {
      if (!userId || !orderId) {
        if (authStatus !== 'loading') {
          setLoading(false);
          setRefreshing(false);
          if (!userId) setError('Sessão autenticada indisponível.');
        }
        return;
      }
      if (isRefresh) setRefreshing(true);
      else if (!retailPaymentDataSource.getSnapshot(orderId, userId, sessionVersion)) {
        setLoading(true);
      }
      setError(undefined);
      try {
        await retailPaymentDataSource.load(orderId, userId, sessionVersion);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Não foi possível carregar pagamentos Varejo.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [authStatus, orderId, sessionVersion, userId],
  );

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  const payments = orderId ? retailPaymentDataSource.list(orderId, userId, sessionVersion) : [];
  const register = useCallback(
    (input: RetailPaymentDraft) =>
      retailPaymentDataSource.register(userId, orderId ?? '', input, sessionVersion),
    [orderId, sessionVersion, userId],
  );
  const registerForOrder = useCallback(
    (targetOrderId: string, input: RetailPaymentDraft) =>
      retailPaymentDataSource.register(userId, targetOrderId, input, sessionVersion),
    [sessionVersion, userId],
  );

  return {
    error,
    loading,
    payments: payments as RetailPayment[],
    refreshing,
    register,
    registerForOrder,
    reload: () => load(true),
    snapshot,
  };
}
