import { useCallback, useMemo } from 'react';

import { useDeliveries } from '@/hooks/useDeliveries';
import { financialCalculationService } from '@/services/finance';
import type { ClientFinancialRankingItem, Delivery } from '@/types/data';
import { formatClientName, normalizeClientKey } from '@/utils/data';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

export type OpenPaymentClientCard = ClientFinancialRankingItem & {
  deliveries: Delivery[];
};

export function useOpenPaymentClients() {
  const { enabled: testModeEnabled } = useTestModePresentation();
  const { deliveries, editMany } = useDeliveries({
    deliveryStatus: 'Entregue',
    mode: 'all',
    status: 'Não Pago',
  });

  const clientCards = useMemo<OpenPaymentClientCard[]>(
    () =>
      financialCalculationService
        .rankClients(deliveries, { periodo: 'todos' })
        .filter((client) => client.valor > 0)
        .map((client) => ({
          ...client,
          deliveries: deliveries.filter(
            (delivery) =>
              normalizeClientKey(formatClientName(delivery.cliente)) ===
              normalizeClientKey(client.nome),
          ),
        })),
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

  return { clientCards, markDeliveryPaid, testModeEnabled };
}
