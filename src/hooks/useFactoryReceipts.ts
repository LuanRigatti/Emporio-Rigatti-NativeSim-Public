import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/providers';
import { userDataService, type UserDataSnapshot } from '@/services/data';
import {
  createFactoryReceiptMutationService,
  factoryCalculationService,
  factoryReceiptQueryService,
  type FactoryReceiptMutationService,
} from '@/services/finance';
import type { FactoryFilters, FactoryPaymentDraft, FactoryReceiptDraft } from '@/types/data';

export function useFactoryReceipts(filters: FactoryFilters = { period: 'month' }) {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<UserDataSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(
    async (isRefresh = false) => {
      if (!user) {
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(undefined);
      try {
        const result = await userDataService.loadWithCacheFallback(user.id);
        setSnapshot(result.snapshot);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Não foi possível carregar os recebimentos da fábrica.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user],
  );

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const receipts = useMemo(
    () => (snapshot ? factoryReceiptQueryService.filter(snapshot.recebimentoBaldes, filters) : []),
    [filters, snapshot],
  );
  const summary = useMemo(
    () => (snapshot ? factoryCalculationService.summarize(receipts) : undefined),
    [receipts, snapshot],
  );

  const mutate = useCallback(
    async (operation: (service: FactoryReceiptMutationService) => Promise<unknown>) => {
      if (!user) throw new Error('Sessão não disponível.');
      await operation(createFactoryReceiptMutationService(user.id));
      await load(true);
    },
    [load, user],
  );

  const create = useCallback(
    async (draft: FactoryReceiptDraft) => {
      if (!user) throw new Error('Sessão não disponível.');
      const receipt = await createFactoryReceiptMutationService(user.id).create(draft);
      await load(true);
      return receipt;
    },
    [load, user],
  );

  const addPayment = useCallback(
    async (receiptId: string, draft: FactoryPaymentDraft) => {
      if (!user) throw new Error('Sessão não disponível.');
      const receipt = await createFactoryReceiptMutationService(user.id).addPayment(
        receiptId,
        draft,
      );
      await load(true);
      return receipt;
    },
    [load, user],
  );

  return {
    receipts,
    allReceipts: snapshot?.recebimentoBaldes ?? [],
    snapshot,
    summary,
    loading,
    refreshing,
    error,
    reload: () => load(true),
    create,
    addPayment,
    removePayment: (receiptId: string, paymentId: string) =>
      mutate((service) => service.removePayment(receiptId, paymentId)),
    setCompleted: (receiptId: string, completed: boolean) =>
      mutate((service) => service.setCompleted(receiptId, completed)),
    remove: (receiptId: string) => mutate((service) => service.remove(receiptId)),
  };
}

export type UseFactoryReceiptsResult = ReturnType<typeof useFactoryReceipts>;
