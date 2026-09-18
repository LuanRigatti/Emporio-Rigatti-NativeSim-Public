import { useCallback, useRef, useState } from 'react';

import { useAuth } from '@/providers';
import { retailOrderDataSource } from '@/services/retail-orders';
import type { RetailOrderPatch } from '@/types/data';

export function useRetailOrderEdit(orderId?: string) {
  const { sessionVersion, user } = useAuth();
  const userId = user?.id;
  const pendingRef = useRef(false);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const save = useCallback(
    async (patch: RetailOrderPatch): Promise<boolean> => {
      if (pendingRef.current) return false;
      if (!orderId) {
        setError('Pedido Varejo não encontrado.');
        return false;
      }
      if (!userId) {
        setError('Sessão autenticada indisponível.');
        return false;
      }

      pendingRef.current = true;
      setPending(true);
      setError(undefined);
      try {
        await retailOrderDataSource.update(userId, orderId, patch, sessionVersion);
        return true;
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : 'Não foi possível salvar as alterações do pedido.',
        );
        return false;
      } finally {
        pendingRef.current = false;
        setPending(false);
      }
    },
    [orderId, sessionVersion, userId],
  );

  const clearError = useCallback(() => setError(undefined), []);

  return { clearError, error, pending, save };
}
