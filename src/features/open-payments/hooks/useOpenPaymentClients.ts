import { useCallback, useMemo } from 'react';

import { ENABLE_FIRESTORE_CLIENTS_DELIVERIES } from '@/config/featureFlags';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useAuth } from '@/providers';
import { firestoreDeliveryDataSource } from '@/services/deliveries';
import { financialCalculationService } from '@/services/finance';
import type { ClientFinancialRankingItem, Delivery } from '@/types/data';
import { formatClientName, normalizeClientKey } from '@/utils/data';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import { getRecentPaidDeliveriesForClient } from '../data/openPaymentClientPreview';
import {
  commitOpenPaymentBulkPayment,
  previewOpenPaymentBulkPayment,
} from '../services/OpenPaymentBulkPaymentService';

const OPEN_DELIVERY_FILTERS = {
  deliveryStatus: 'Entregue',
  mode: 'all',
  status: 'Não Pago',
} as const;
const PAID_DELIVERY_FILTERS = { mode: 'all', status: 'Pago' } as const;

export type OpenPaymentClientCard = ClientFinancialRankingItem & {
  deliveries: Delivery[];
  recentPayments: Delivery[];
};

export function useOpenPaymentClients() {
  const { sessionVersion, user } = useAuth();
  const { enabled: testModeEnabled } = useTestModePresentation();
  const { deliveries, editMany } = useDeliveries(OPEN_DELIVERY_FILTERS);
  const {
    deliveries: paidDeliveries,
    error: paymentHistoryError,
    loading: paymentHistoryLoading,
  } = useDeliveries(PAID_DELIVERY_FILTERS);

  const clientCards = useMemo<OpenPaymentClientCard[]>(
    () =>
      financialCalculationService
        .rankClients(deliveries, { periodo: 'todos' })
        .filter((client) => client.valor > 0)
        .map((client) => {
          const clientDeliveries = deliveries.filter(
            (delivery) =>
              normalizeClientKey(formatClientName(delivery.cliente)) ===
              normalizeClientKey(client.nome),
          );

          return {
            ...client,
            deliveries: clientDeliveries,
            recentPayments: getRecentPaidDeliveriesForClient(
              { deliveries: clientDeliveries, nome: client.nome },
              paidDeliveries,
            ),
          };
        }),
    [deliveries, paidDeliveries],
  );
  const totalOpenAmount = useMemo(
    () => financialCalculationService.calculatePendente(deliveries),
    [deliveries],
  );

  const markDeliveryPaid = useCallback(
    (deliveryId: string) => {
      if (testModeEnabled) return;
      triggerLightImpactHaptic();
      void editMany([deliveryId], { status: 'Pago' });
    },
    [editMany, testModeEnabled],
  );

  const bulkPaymentsEnabled = Boolean(
    ENABLE_FIRESTORE_CLIENTS_DELIVERIES && user?.id && !testModeEnabled,
  );

  const previewAllClientPayments = useCallback(
    (clientId: string, visibleDeliveryIds: readonly string[]) => {
      if (!bulkPaymentsEnabled) throw new Error('bulk_payment_unavailable');
      return previewOpenPaymentBulkPayment(clientId, visibleDeliveryIds);
    },
    [bulkPaymentsEnabled],
  );

  const commitAllClientPayments = useCallback(
    async (input: {
      clientId: string;
      visibleDeliveryIds: readonly string[];
      snapshotFingerprint: string;
      idempotencyKey: string;
    }) => {
      if (!bulkPaymentsEnabled || !user) throw new Error('bulk_payment_unavailable');
      const result = await commitOpenPaymentBulkPayment(input);
      const cache = await firestoreDeliveryDataSource.applyCommittedPaidDeliveryUpdates(
        user.id,
        sessionVersion,
        result.updatedDeliveries,
      );
      return {
        result,
        cacheSynchronized: cache.cacheInvalidationComplete,
      };
    },
    [bulkPaymentsEnabled, sessionVersion, user],
  );

  return {
    clientCards,
    bulkPaymentsEnabled,
    commitAllClientPayments,
    markDeliveryPaid,
    previewAllClientPayments,
    paymentHistoryError,
    paymentHistoryLoading,
    testModeEnabled,
    totalOpenAmount,
  };
}
