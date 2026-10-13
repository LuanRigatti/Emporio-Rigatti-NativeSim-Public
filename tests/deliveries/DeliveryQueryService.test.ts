import { deliveryQueryService } from '@/services/deliveries/DeliveryQueryService';
import type { Delivery } from '@/types/data';

describe('DeliveryQueryService deterministic delivery order', () => {
  it('uses the stable delivery ID to break equal client-name ties', () => {
    const deliveries: Delivery[] = [
      {
        id: 'delivery-z',
        cliente: 'Ana',
        data: '2026-10-15',
        quantidade: 1,
        valor: 50,
        status: 'Não Pago',
        entregue: false,
      },
      {
        id: 'delivery-a',
        cliente: 'Ana',
        data: '2026-10-15',
        quantidade: 2,
        valor: 100,
        status: 'Não Pago',
        entregue: false,
      },
    ];

    expect(
      deliveryQueryService
        .filter(deliveries, { mode: 'today', date: '2026-10-15' })
        .map(({ id }) => id),
    ).toEqual(['delivery-a', 'delivery-z']);
  });
});
