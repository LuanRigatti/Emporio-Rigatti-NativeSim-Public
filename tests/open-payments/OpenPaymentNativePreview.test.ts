import type { Delivery } from '@/types/data';
import { darkColors, getCardSurfaceColor, lightColors } from '../../src/theme/colors';

import {
  buildOpenPaymentNativePreview,
  getOpenPaymentClientPreviewIdentifier,
} from '../../src/features/open-payments/data/openPaymentNativePreview';
import type { OpenPaymentClientCard } from '../../src/features/open-payments/hooks/useOpenPaymentClients';

function makeDelivery(
  id: string,
  status: Delivery['status'],
  date: string,
  clientId?: Delivery['clientId'],
): Delivery {
  return {
    clientId,
    cliente: 'André Marques',
    data: date,
    entregue: true,
    id,
    metodoPagamento: 'Pix',
    quantidade: 1,
    status,
    valor: 50,
  };
}

function makeClient(deliveries: Delivery[]): OpenPaymentClientCard {
  return {
    deliveries,
    entregas: deliveries.length,
    nome: 'André Marques',
    percentual: 100,
    quantidade: deliveries.length,
    recentPayments: [],
    valor: 120,
  };
}

describe('OpenPayment native preview DTO', () => {
  it('carries the client balance and existing recent paid deliveries without additional data lookup', () => {
    const client = makeClient([makeDelivery('open-1', 'Não Pago', '2026-10-07', 'client:andre')]);
    client.recentPayments = [
      makeDelivery('paid-1', 'Pago', '2026-10-06', 'client:andre'),
      makeDelivery('paid-2', 'Pago', '2026-10-03', 'client:andre'),
      makeDelivery('paid-3', 'Pago', '2026-09-28', 'client:andre'),
      makeDelivery('paid-4', 'Pago', '2026-09-20', 'client:andre'),
    ];

    const preview = buildOpenPaymentNativePreview(client, {
      formatCurrency: (value) => `R$ ${value.toFixed(2)}`,
      paymentHistoryLoading: false,
    });

    expect(preview.title).toBe('André Marques');
    expect(preview.summary).toEqual({ label: 'Saldo em aberto', value: 'R$ 120.00' });
    expect(preview.sections?.[0].rows).toHaveLength(3);
    expect(preview.sections?.[0].rows[0]).toEqual({
      id: 'paid-delivery:paid-1',
      subtitle: 'Pix',
      title: '06/10/2026',
      value: 'R$ 50.00',
    });
  });

  it('forwards the resolved light and dark page and card colors when supplied', () => {
    const client = makeClient([makeDelivery('open-1', 'Não Pago', '2026-10-07')]);
    const formatCurrency = (value: number) => `R$ ${value.toFixed(2)}`;

    const lightPreview = buildOpenPaymentNativePreview(client, {
      cardSurfaceColor: getCardSurfaceColor('light', lightColors.surface),
      formatCurrency,
      pageBackgroundColor: lightColors.background,
      paymentHistoryLoading: false,
    });
    const darkPreview = buildOpenPaymentNativePreview(client, {
      cardSurfaceColor: getCardSurfaceColor('dark', darkColors.surface),
      formatCurrency,
      pageBackgroundColor: darkColors.background,
      paymentHistoryLoading: false,
    });

    expect(lightPreview.appearance).toEqual({
      cardSurfaceColor: '#FEFFFF',
      pageBackgroundColor: '#FAF8F7',
    });
    expect(darkPreview.appearance).toEqual({
      cardSurfaceColor: '#0C0C0E',
      pageBackgroundColor: '#000000',
    });
  });

  it('omits optional appearance configuration when theme colors are not supplied', () => {
    const preview = buildOpenPaymentNativePreview(
      makeClient([makeDelivery('open-1', 'Não Pago', '2026-10-07')]),
      { formatCurrency: (value) => `R$ ${value}`, paymentHistoryLoading: false },
    );

    expect(preview).not.toHaveProperty('appearance');
  });

  it('does not invent payment dates when a paid delivery has no date', () => {
    const client = makeClient([makeDelivery('open-1', 'Não Pago', '2026-10-07')]);
    client.recentPayments = [makeDelivery('paid-undated', 'Pago', '', undefined)];

    const preview = buildOpenPaymentNativePreview(client, {
      formatCurrency: (value) => `R$ ${value.toFixed(2)}`,
      paymentHistoryLoading: false,
    });

    expect(preview.sections?.[0].rows[0]).toMatchObject({
      id: 'paid-delivery:paid-undated',
      title: 'Entrega quitada',
    });
    expect(preview.sections?.[0].rows[0].title).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it('uses canonical client identity only when every open delivery shares it', () => {
    const canonical = makeClient([
      makeDelivery('open-1', 'Não Pago', '2026-10-07', 'client:andre'),
      makeDelivery('open-2', 'Não Pago', '2026-10-06', 'client:andre'),
    ]);
    const mixed = makeClient([
      makeDelivery('open-1', 'Não Pago', '2026-10-07', 'client:andre'),
      makeDelivery('open-2', 'Não Pago', '2026-10-06'),
    ]);

    expect(getOpenPaymentClientPreviewIdentifier(canonical)).toBe(
      'open-payment-client:client:andre',
    );
    expect(getOpenPaymentClientPreviewIdentifier(mixed)).toBe(
      'open-payment-deliveries:open-1|open-2',
    );
  });

  it('keeps the existing loading, error, and empty history states', () => {
    const client = makeClient([makeDelivery('open-1', 'Não Pago', '2026-10-07')]);
    const formatCurrency = (value: number) => `R$ ${value.toFixed(2)}`;

    expect(
      buildOpenPaymentNativePreview(client, { formatCurrency, paymentHistoryLoading: true })
        .sections?.[0].rows[0].title,
    ).toBe('Carregando pagamentos…');
    expect(
      buildOpenPaymentNativePreview(client, {
        formatCurrency,
        paymentHistoryError: 'error',
        paymentHistoryLoading: false,
      }).sections?.[0].rows[0].title,
    ).toBe('Não foi possível carregar os pagamentos.');
    expect(
      buildOpenPaymentNativePreview(client, { formatCurrency, paymentHistoryLoading: false })
        .sections?.[0].rows[0].title,
    ).toBe('Sem pagamentos anteriores');
  });
});
