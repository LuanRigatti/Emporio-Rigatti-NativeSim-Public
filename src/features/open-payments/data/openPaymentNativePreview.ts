import type { NativeContextMenuPreviewContent } from 'native-card-context-menu';

import type { ClientId } from '@/types/data';
import { formatDateAsDayMonthYear } from '@/utils/groupItemsByDate';

import type { OpenPaymentClientCard } from '../hooks/useOpenPaymentClients';

const MAX_RECENT_PREVIEW_ROWS = 3;

export function getOpenPaymentClientPreviewIdentifier(client: OpenPaymentClientCard): string {
  const clientIds = new Set(
    client.deliveries
      .map((delivery) => delivery.clientId)
      .filter((clientId): clientId is ClientId => Boolean(clientId)),
  );
  const [canonicalClientId] = clientIds;
  const hasCanonicalClientId =
    client.deliveries.length > 0 &&
    clientIds.size === 1 &&
    client.deliveries.every((delivery) => delivery.clientId === canonicalClientId);

  if (hasCanonicalClientId && canonicalClientId) {
    return `open-payment-client:${canonicalClientId}`;
  }

  const deliveryIds = client.deliveries.map((delivery) => delivery.id).sort();
  return `open-payment-deliveries:${deliveryIds.join('|')}`;
}

export function buildOpenPaymentNativePreview(
  client: OpenPaymentClientCard,
  options: {
    paymentHistoryError?: string;
    paymentHistoryLoading: boolean;
    formatCurrency: (value: number) => string;
    pageBackgroundColor?: string;
    cardSurfaceColor?: string;
  },
): NativeContextMenuPreviewContent {
  const {
    cardSurfaceColor,
    formatCurrency,
    pageBackgroundColor,
    paymentHistoryError,
    paymentHistoryLoading,
  } = options;
  const rows = paymentHistoryLoading
    ? [{ id: 'payment-history-loading', title: 'Carregando pagamentos…' }]
    : paymentHistoryError
      ? [{ id: 'payment-history-error', title: 'Não foi possível carregar os pagamentos.' }]
      : client.recentPayments.length > 0
        ? client.recentPayments.slice(0, MAX_RECENT_PREVIEW_ROWS).map((payment) => ({
            id: `paid-delivery:${payment.id}`,
            subtitle: payment.metodoPagamento,
            title: payment.data?.trim()
              ? formatDateAsDayMonthYear(payment.data)
              : 'Entrega quitada',
            value: formatCurrency(payment.valor),
          }))
        : [{ id: 'payment-history-empty', title: 'Sem pagamentos anteriores' }];

  return {
    ...(pageBackgroundColor && cardSurfaceColor
      ? { appearance: { cardSurfaceColor, pageBackgroundColor } }
      : {}),
    leadingSystemImage: 'person.crop.circle.fill',
    sections: [{ rows, title: 'Últimos pagamentos' }],
    subtitle: 'Cliente',
    summary: {
      label: 'Saldo em aberto',
      value: formatCurrency(client.valor),
    },
    title: client.nome,
  };
}
