import { useCallback, useMemo } from 'react';

import { useDeliveries } from '@/hooks/useDeliveries';
import { financialCalculationService } from '@/services/finance';
import type { ClientFinancialRankingItem, Delivery } from '@/types/data';
import { formatClientName, normalizeClientKey } from '@/utils/data';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import { getRecentPaidDeliveriesForClient } from '../data/openPaymentClientPreview';

export type OpenPaymentClientCard = ClientFinancialRankingItem & {
  deliveries: Delivery[];
  recentPayments: Delivery[];
};

export function useOpenPaymentClients() {
  const { enabled: testModeEnabled } = useTestModePresentation();
  const { deliveries, editMany } = useDeliveries({
    deliveryStatus: 'Entregue',
    mode: 'all',
    status: 'Não Pago',
  });
  const {
    deliveries: paidDeliveries,
    error: paymentHistoryError,
    loading: paymentHistoryLoading,
  } = useDeliveries({ mode: 'all', status: 'Pago' });

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

  return {
    clientCards,
    markDeliveryPaid,
    paymentHistoryError,
    paymentHistoryLoading,
    testModeEnabled,
    totalOpenAmount,
  };
}
