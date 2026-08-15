import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/providers';
import { ENABLE_FIRESTORE_CLIENTS_DELIVERIES } from '@/config/featureFlags';
import { asyncStorageCacheService } from '@/services/cache';
import {
  deliveryNormalizationService,
  deliveryQueryService,
  firestoreDeliveryDataSource,
  mockDeliveryDataSource,
} from '@/services/deliveries';
import { DeliveryMutationService } from '@/services/deliveries/DeliveryMutationService';
import { APP_DATA_MODE, loadAppData } from '@/services/data';
import type { UserDataSnapshot } from '@/services/data';
import type {
  BoletoStatus,
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
  const firestoreEnabled = ENABLE_FIRESTORE_CLIENTS_DELIVERIES;
  const filterSignature = JSON.stringify(filters);
  const stableFilters = useMemo(() => filters, [filterSignature]);
  const emptySnapshot = useCallback(
    (entregas: Delivery[]): UserDataSnapshot => ({
      clientesCustom: {},
      entregas,
      gastosDiarios: {},
      gastosMensais: {},
      recebimentoBaldes: [],
    }),
    [],
  );
  const [snapshot, setSnapshot] = useState<UserDataSnapshot | null>(() =>
    firestoreEnabled ? emptySnapshot(firestoreDeliveryDataSource.getCached(stableFilters)) : null,
  );
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
        if (firestoreEnabled) {
          try {
            const result = await firestoreDeliveryDataSource.load(user.id, stableFilters);
            setSnapshot(emptySnapshot(result));
          } catch {
            setSnapshot(emptySnapshot([...mockDeliveryDataSource.getAll()]));
          }
          return;
        }
        const snapshotResult = await loadAppData(user.id);
        const normalized = deliveryNormalizationService.normalize(
          snapshotResult.entregas,
          todayIso(),
        );
        if (normalized.changed && APP_DATA_MODE === 'firebase') {
          await new DeliveryRepository(user.id).replace(normalized.deliveries);
          const nextSnapshot = { ...snapshotResult, entregas: normalized.deliveries };
          await asyncStorageCacheService.write(user.id, nextSnapshot);
          setSnapshot(nextSnapshot);
        } else {
          setSnapshot({ ...snapshotResult, entregas: normalized.deliveries });
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
    [emptySnapshot, firestoreEnabled, stableFilters, user],
  );

  useEffect(() => {
    if (!firestoreEnabled) return undefined;
    return firestoreDeliveryDataSource.subscribe(() => {
      setSnapshot(emptySnapshot(firestoreDeliveryDataSource.getCached(stableFilters)));
    });
  }, [emptySnapshot, firestoreEnabled, stableFilters]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const deliveries = useMemo(
    () => (snapshot ? deliveryQueryService.filter(snapshot.entregas, stableFilters) : []),
    [stableFilters, snapshot],
  );

  const refreshFirestoreState = useCallback(() => {
    setSnapshot(emptySnapshot(firestoreDeliveryDataSource.getCached(stableFilters)));
  }, [emptySnapshot, stableFilters]);

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
      if (firestoreEnabled) {
        const delivery = await firestoreDeliveryDataSource.create(user.id, draft);
        refreshFirestoreState();
        return delivery;
      }
      const delivery = await new DeliveryMutationService(user.id).create(draft);
      await load(true);
      return delivery;
    },
    [firestoreEnabled, load, refreshFirestoreState, user],
  );

  const update = useCallback(
    async (deliveryId: string, draft: DeliveryDraft) => {
      if (!user) throw new Error('Sessão não disponível.');
      if (firestoreEnabled) {
        const delivery = await firestoreDeliveryDataSource.update(user.id, deliveryId, draft);
        refreshFirestoreState();
        return delivery;
      }
      const delivery = await new DeliveryMutationService(user.id).update(deliveryId, draft);
      await load(true);
      return delivery;
    },
    [firestoreEnabled, load, refreshFirestoreState, user],
  );

  const remove = useCallback(
    async (deliveryId: string) => {
      if (firestoreEnabled && user) {
        await firestoreDeliveryDataSource.remove(user.id, deliveryId);
        refreshFirestoreState();
        return;
      }
      await mutate((service) => service.remove(deliveryId));
    },
    [firestoreEnabled, mutate, refreshFirestoreState, user],
  );

  const toggleDelivered = useCallback(
    async (deliveryId: string) => {
      if (firestoreEnabled && user) {
        await firestoreDeliveryDataSource.toggleDelivered(user.id, deliveryId);
        refreshFirestoreState();
        return;
      }
      await mutate((service) => service.toggleDelivered(deliveryId));
    },
    [firestoreEnabled, mutate, refreshFirestoreState, user],
  );

  const updateInvoiceStatus = useCallback(
    async (deliveryId: string, status: InvoiceStatus) => {
      if (firestoreEnabled && user) {
        await firestoreDeliveryDataSource.updateInvoiceStatus(user.id, deliveryId, status);
        refreshFirestoreState();
        return;
      }
      await mutate((service) => service.updateInvoiceStatus(deliveryId, status));
    },
    [firestoreEnabled, mutate, refreshFirestoreState, user],
  );

  const updateBoletoStatus = useCallback(
    async (deliveryId: string, status: BoletoStatus) => {
      if (firestoreEnabled && user) {
        await firestoreDeliveryDataSource.updateBoletoStatus(user.id, deliveryId, status);
        refreshFirestoreState();
        return;
      }
      await mutate((service) => service.updateBoletoStatus(deliveryId, status));
    },
    [firestoreEnabled, mutate, refreshFirestoreState, user],
  );

  const settle = useCallback(
    async (deliveryIds: readonly string[], method: PaymentMethod) => {
      if (firestoreEnabled && user) {
        await firestoreDeliveryDataSource.settle(user.id, deliveryIds, method);
        refreshFirestoreState();
        return;
      }
      await mutate((service) => service.settle(deliveryIds, method));
    },
    [firestoreEnabled, mutate, refreshFirestoreState, user],
  );

  const editMany = useCallback(
    async (deliveryIds: readonly string[], patch: DeliveryBulkPatch) => {
      if (firestoreEnabled && user) {
        await firestoreDeliveryDataSource.editMany(user.id, deliveryIds, patch);
        refreshFirestoreState();
        return;
      }
      await mutate((service) => service.editMany(deliveryIds, patch));
    },
    [firestoreEnabled, mutate, refreshFirestoreState, user],
  );
  const reload = useCallback(() => load(true), [load]);

  return {
    deliveries,
    allDeliveries: snapshot?.entregas ?? [],
    snapshot,
    loading,
    refreshing,
    error,
    reload,
    create,
    update,
    remove,
    toggleDelivered,
    updateInvoiceStatus,
    updateBoletoStatus,
    settle,
    editMany,
  };
}

export type UseDeliveriesResult = ReturnType<typeof useDeliveries>;
export type DeliveryMutation = (delivery: Delivery) => Promise<void>;
