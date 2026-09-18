import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { useAuth } from '@/providers';
import { retailPaymentDataSource } from '@/services/retail-orders';
import type { RetailPayment, RetailPaymentDraft } from '@/types/data';

export type RetailOrderPaymentMutationSuccessHandler = (
  orderId: string,
  payments: readonly RetailPayment[],
) => void;

export type RetailOrderPaymentRegistrationSuccessHandler = RetailOrderPaymentMutationSuccessHandler;

export type UseRetailOrderPaymentsOptions = {
  onRegisterSuccess?: RetailOrderPaymentRegistrationSuccessHandler;
  onVoidSuccess?: RetailOrderPaymentMutationSuccessHandler;
};

export function useRetailOrderPayments(
  orderId?: string,
  { onRegisterSuccess, onVoidSuccess }: UseRetailOrderPaymentsOptions = {},
) {
  const { sessionVersion, status: authStatus, user } = useAuth();
  const userId = user?.id;
  const [loading, setLoading] = useState(Boolean(user && orderId));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();
  const [mutationError, setMutationError] = useState<string>();
  const [voidingPaymentId, setVoidingPaymentId] = useState<string>();
  const voidingPaymentIds = useRef(new Set<string>());
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
    async (input: RetailPaymentDraft) => {
      const paymentId = await retailPaymentDataSource.register(
        userId,
        orderId ?? '',
        input,
        sessionVersion,
      );
      if (orderId && onRegisterSuccess) {
        const currentPayments = retailPaymentDataSource.getSnapshot(
          orderId,
          userId,
          sessionVersion,
        );
        if (currentPayments) {
          try {
            onRegisterSuccess(orderId, currentPayments);
          } catch {
            // The payment is already persisted; a stale/failed cache update must not turn it into an error.
          }
        }
      }
      return paymentId;
    },
    [onRegisterSuccess, orderId, sessionVersion, userId],
  );
  const registerForOrder = useCallback(
    (targetOrderId: string, input: RetailPaymentDraft) =>
      retailPaymentDataSource.register(userId, targetOrderId, input, sessionVersion),
    [sessionVersion, userId],
  );
  const voidPayment = useCallback(
    async (paymentId: string) => {
      if (!orderId || voidingPaymentIds.current.has(paymentId)) return;
      voidingPaymentIds.current.add(paymentId);
      setVoidingPaymentId(paymentId);
      setMutationError(undefined);
      try {
        await retailPaymentDataSource.voidPayment(userId, orderId, paymentId, sessionVersion);
        if (onVoidSuccess) {
          const currentPayments = retailPaymentDataSource.getSnapshot(
            orderId,
            userId,
            sessionVersion,
          );
          if (currentPayments) {
            try {
              onVoidSuccess(orderId, currentPayments);
            } catch {
              // The payment is already persisted; a stale/failed cache update must not turn it into an error.
            }
          }
        }
      } catch (mutationFailure) {
        setMutationError(
          mutationFailure instanceof Error
            ? mutationFailure.message
            : 'Não foi possível anular o pagamento.',
        );
      } finally {
        voidingPaymentIds.current.delete(paymentId);
        setVoidingPaymentId((current) => (current === paymentId ? undefined : current));
      }
    },
    [onVoidSuccess, orderId, sessionVersion, userId],
  );

  return {
    error,
    loading,
    mutationError,
    payments: payments as RetailPayment[],
    refreshing,
    register,
    registerForOrder,
    reload: () => load(true),
    snapshot,
    voidPayment,
    voidingPaymentId,
  };
}
