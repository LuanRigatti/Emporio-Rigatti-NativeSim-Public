import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/providers';
import { asyncStorageCacheService } from '@/services/cache';
import { deliveryNormalizationService, deliveryQueryService } from '@/services/deliveries';
import { DeliveryMutationService } from '@/services/deliveries/DeliveryMutationService';
import { userDataService } from '@/services/data';
import type { UserDataSnapshot } from '@/services/data';
import type {
  Delivery,
  DeliveryBulkPatch,
  DeliveryDraft,
  DeliveryFilters,
  InvoiceStatus,
  PaymentMethod,
} from '@/types/data';
import { DeliveryRepository } from '@/repositories/DeliveryRepository';
import { todayIso } from '@/utils/data';

export function useDeliveries(filters: DeliveryFilters = { mode: 'today' }) {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<UserDataSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(
    async (isRefresh = false) => {
      if (!user) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(undefined);
      try {
        const result = await userDataService.loadWithCacheFallback(user.id);
        const normalized = deliveryNormalizationService.normalize(
          result.snapshot.entregas,
          todayIso(),
        );
        if (normalized.changed) {
          await new DeliveryRepository(user.id).replace(normalized.deliveries);
          const nextSnapshot = { ...result.snapshot, entregas: normalized.deliveries };
          await asyncStorageCacheService.write(user.id, nextSnapshot);
          setSnapshot(nextSnapshot);
        } else {
          setSnapshot(result.snapshot);
        }
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : 'Não foi possível carregar entregas.',
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

  const deliveries = useMemo(
    () => (snapshot ? deliveryQueryService.filter(snapshot.entregas, filters) : []),
    [filters, snapshot],
  );

  const mutate = useCallback(
    async (operation: (service: DeliveryMutationService) => Promise<void>) => {
      if (!user) throw new Error('Sessão não disponível.');
      await operation(new DeliveryMutationService(user.id));
      await load(true);
    },
    [load, user],
  );

  const create = useCallback(
    async (draft: DeliveryDraft) => {
      if (!user) throw new Error('Sessão não disponível.');
      const delivery = await new DeliveryMutationService(user.id).create(draft);
      await load(true);
      return delivery;
    },
    [load, user],
  );

  const update = useCallback(
    async (deliveryId: string, draft: DeliveryDraft) => {
      if (!user) throw new Error('Sessão não disponível.');
      const delivery = await new DeliveryMutationService(user.id).update(deliveryId, draft);
      await load(true);
      return delivery;
    },
    [load, user],
  );

  return {
    deliveries,
    allDeliveries: snapshot?.entregas ?? [],
    snapshot,
    loading,
    refreshing,
    error,
    reload: () => load(true),
    create,
    update,
    remove: (deliveryId: string) => mutate((service) => service.remove(deliveryId)),
    toggleDelivered: (deliveryId: string) =>
      mutate((service) => service.toggleDelivered(deliveryId)),
    updateInvoiceStatus: (deliveryId: string, status: InvoiceStatus) =>
      mutate((service) => service.updateInvoiceStatus(deliveryId, status)),
    settle: (deliveryIds: readonly string[], method: PaymentMethod) =>
      mutate((service) => service.settle(deliveryIds, method)),
    editMany: (deliveryIds: readonly string[], patch: DeliveryBulkPatch) =>
      mutate((service) => service.editMany(deliveryIds, patch)),
  };
}

export type UseDeliveriesResult = ReturnType<typeof useDeliveries>;
export type DeliveryMutation = (delivery: Delivery) => Promise<void>;
