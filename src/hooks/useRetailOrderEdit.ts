import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/providers';
import {
  retailOrderDataSource,
  type RetailOrderCatalogContext,
  type RetailOrderLineItemEditInput,
} from '@/services/retail-orders';
import type { RetailOrderPatch } from '@/types/data';

export function useRetailOrderEdit(orderId?: string) {
  const { sessionVersion, user } = useAuth();
  const userId = user?.id;
  const pendingRef = useRef(false);
  const isMountedRef = useRef(true);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const performSave = useCallback(
    async (operation: () => Promise<void>): Promise<boolean> => {
      if (pendingRef.current) return false;
      if (!orderId) {
        if (isMountedRef.current) setError('Pedido Varejo não encontrado.');
        return false;
      }
      if (!userId) {
        if (isMountedRef.current) setError('Sessão autenticada indisponível.');
        return false;
      }

      pendingRef.current = true;
      if (isMountedRef.current) {
        setPending(true);
        setError(undefined);
      }
      try {
        await operation();
        return true;
      } catch (saveError) {
        if (isMountedRef.current) {
          setError(
            saveError instanceof Error
              ? saveError.message
              : 'Não foi possível salvar as alterações do pedido.',
          );
        }
        return false;
      } finally {
        pendingRef.current = false;
        if (isMountedRef.current) setPending(false);
      }
    },
    [orderId, userId],
  );

  const save = useCallback(
    (patch: RetailOrderPatch): Promise<boolean> => {
      return performSave(() =>
        retailOrderDataSource.update(userId!, orderId!, patch, sessionVersion),
      );
    },
    [orderId, performSave, sessionVersion, userId],
  );

  const saveContents = useCallback(
    (
      patch: RetailOrderPatch,
      lineItems: readonly RetailOrderLineItemEditInput[],
      catalog?: RetailOrderCatalogContext,
    ): Promise<boolean> => {
      return performSave(() =>
        retailOrderDataSource.updateContents(
          userId!,
          orderId!,
          { catalog, lineItems, patch },
          sessionVersion,
        ),
      );
    },
    [orderId, performSave, sessionVersion, userId],
  );

  const clearError = useCallback(() => setError(undefined), []);

  return { clearError, error, pending, save, saveContents };
}
