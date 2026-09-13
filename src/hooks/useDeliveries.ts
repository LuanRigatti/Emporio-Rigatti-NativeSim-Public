import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { useAuth } from '@/providers';
import { ENABLE_FIRESTORE_CLIENTS_DELIVERIES } from '@/config/featureFlags';
import { asyncStorageCacheService } from '@/services/cache';
import {
  deliveryNormalizationService,
  deliveryQueryService,
  firestoreDeliveryDataSource,
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

const EMPTY_SUBSCRIBE = () => () => {};
const ZERO_REVISION = () => 0;

export function useDeliveries(filters: DeliveryFilters = { mode: 'today' }) {
  const { sessionVersion, user } = useAuth();
  const firestoreEnabled = ENABLE_FIRESTORE_CLIENTS_DELIVERIES;
  const filterSignature = JSON.stringify(filters);
  // The serialized signature intentionally controls this reference's stability.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const firestoreRevision = useSyncExternalStore(
    firestoreEnabled ? firestoreDeliveryDataSource.subscribe : EMPTY_SUBSCRIBE,
    firestoreEnabled ? firestoreDeliveryDataSource.getRevision : ZERO_REVISION,
    firestoreEnabled ? firestoreDeliveryDataSource.getRevision : ZERO_REVISION,
  );
  const [snapshot, setSnapshot] = useState<UserDataSnapshot | null>(null);
  const [firestoreFallbackSnapshot, setFirestoreFallbackSnapshot] =
    useState<UserDataSnapshot | null>(null);
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
            await firestoreDeliveryDataSource.load(user.id, stableFilters, { force: isRefresh });
            setFirestoreFallbackSnapshot(null);
          } catch (loadError) {
            setFirestoreFallbackSnapshot(null);
            setError(
              loadError instanceof Error
                ? loadError.message
                : 'Não foi possível carregar entregas.',
            );
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
    [firestoreEnabled, stableFilters, user],
  );

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const firestoreSnapshot = useMemo(
    () =>
      emptySnapshot(firestoreDeliveryDataSource.getCached(stableFilters, user?.id, sessionVersion)),
    // The external revision intentionally invalidates this derived snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [emptySnapshot, firestoreRevision, sessionVersion, stableFilters, user?.id],
  );
  const currentSnapshot = firestoreEnabled
    ? (firestoreFallbackSnapshot ?? firestoreSnapshot)
    : snapshot;

  const deliveries = useMemo(
    () =>
      currentSnapshot ? deliveryQueryService.filter(currentSnapshot.entregas, stableFilters) : [],
    [currentSnapshot, stableFilters],
  );

  const refreshFirestoreState = useCallback(() => {
    setFirestoreFallbackSnapshot(null);
  }, []);

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
    allDeliveries: currentSnapshot?.entregas ?? [],
    snapshot: currentSnapshot,
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
