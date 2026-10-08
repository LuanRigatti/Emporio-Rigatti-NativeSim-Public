import { getRecentPaidDeliveriesForClient } from '@/features/open-payments/data/openPaymentClientPreview';
import type { Delivery } from '@/types/data';

function delivery(
  id: string,
  clientName: string,
  date: string,
  options: Partial<Delivery> = {},
): Delivery {
  return {
    clientId: 'client:andre',
    cliente: clientName,
    data: date,
    entregue: true,
    id,
    quantidade: 1,
    status: 'Pago',
    valor: 50,
    ...options,
  };
}

describe('getRecentPaidDeliveriesForClient', () => {
  it('returns only the three latest paid records belonging to the client', () => {
    const client = {
      deliveries: [delivery('open-1', 'André Marques', '2026-10-07', { status: 'Não Pago' })],
      nome: 'André Marques',
    };
    const result = getRecentPaidDeliveriesForClient(client, [
      delivery('paid-oldest', 'André Marques', '2026-10-01'),
      delivery('paid-newest', 'André Marques', '2026-10-06'),
      delivery('other-client', 'André Marques', '2026-10-09', { clientId: 'client:other' }),
      delivery('paid-middle', 'André Marques', '2026-10-04'),
      delivery('unpaid', 'André Marques', '2026-10-08', { status: 'Não Pago' }),
      delivery('paid-second', 'André Marques', '2026-10-05'),
    ]);

    expect(result.map((item) => item.id)).toEqual(['paid-newest', 'paid-second', 'paid-middle']);
  });

  it('matches legacy records by accent-insensitive client name when no client ID exists', () => {
    const client = {
      deliveries: [delivery('open-1', 'André Marques', '2026-10-07')],
      nome: 'André Marques',
    };
    const legacyPayment = delivery('legacy-paid', 'Andre Marques', '2026-10-02', {
      clientId: undefined,
    });

    expect(getRecentPaidDeliveriesForClient(client, [legacyPayment])).toEqual([legacyPayment]);
  });

  it('returns an empty list when the client has no prior paid records', () => {
    const client = {
      deliveries: [delivery('open-1', 'André Marques', '2026-10-07', { status: 'Não Pago' })],
      nome: 'André Marques',
    };

    expect(getRecentPaidDeliveriesForClient(client, [])).toEqual([]);
  });
});
