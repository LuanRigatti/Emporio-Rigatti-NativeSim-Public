import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { useAuth } from '@/providers';
import { retailOrderDataSource } from '@/services/retail-orders';
import type { RetailOrder } from '@/types/data';

export type RetailOrderDetailState = {
  order: RetailOrder | undefined;
  loading: boolean;
  revalidating: boolean;
  error?: string;
  notFound: boolean;
  refresh: () => Promise<void>;
};

export function useRetailOrderDetail(orderId?: string): RetailOrderDetailState {
  const { sessionVersion, status: authStatus, user } = useAuth();
  const userId = user?.id;
  const requestGeneration = useRef(0);
  const getSnapshot = useCallback(
    () => (orderId ? retailOrderDataSource.getById(orderId, userId, sessionVersion) : undefined),
    [orderId, sessionVersion, userId],
  );
  const order = useSyncExternalStore(retailOrderDataSource.subscribe, getSnapshot, getSnapshot);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [revalidating, setRevalidating] = useState(false);
  const [error, setError] = useState<string>();
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const requestId = ++requestGeneration.current;
    if (!orderId) {
      setLoading(false);
      setRevalidating(false);
      setError(undefined);
      setNotFound(true);
      return;
    }

    if (!userId) {
      if (authStatus === 'loading') {
        setLoading(true);
        setRevalidating(false);
        setError(undefined);
        setNotFound(false);
        return;
      }
      setLoading(false);
      setRevalidating(false);
      setError('Sessão autenticada indisponível.');
      setNotFound(false);
      return;
    }

    const cachedOrder = retailOrderDataSource.getById(orderId, userId, sessionVersion);
    setLoading(!cachedOrder);
    setRevalidating(Boolean(cachedOrder));
    setError(undefined);
    setNotFound(false);

    try {
      const loadedOrder = await retailOrderDataSource.loadById(orderId, userId, sessionVersion);
      if (requestGeneration.current !== requestId) return;
      setNotFound(!loadedOrder);
    } catch (loadError) {
      if (requestGeneration.current !== requestId) return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar o pedido Varejo.',
      );
      setNotFound(false);
    } finally {
      if (requestGeneration.current === requestId) {
        setLoading(false);
        setRevalidating(false);
      }
    }
  }, [authStatus, orderId, sessionVersion, userId]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  return {
    error,
    loading: loading && !order,
    notFound,
    order,
    refresh: load,
    revalidating: revalidating && Boolean(order),
  };
}
