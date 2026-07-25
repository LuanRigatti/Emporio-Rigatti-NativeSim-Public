import { DeliveryNormalizationService } from '@/services/deliveries/DeliveryNormalizationService';
import { DeliveryPricingService } from '@/services/deliveries/DeliveryPricingService';
import { DeliveryQueryService } from '@/services/deliveries/DeliveryQueryService';
import type { Delivery } from '@/types/data';

const delivery = (overrides: Partial<Delivery> = {}): Delivery => ({
  id: 'delivery-1',
  cliente: 'Guilherme',
  quantidade: 2,
  valor: 89,
  status: 'Não Pago',
  entregue: false,
  data: '2026-07-24',
  ...overrides,
});

describe('delivery services', () => {
  it('marks a past undelivered record as delivered and leaves current records unchanged', () => {
    const service = new DeliveryNormalizationService();
    const result = service.normalize(
      [delivery({ id: 'past', data: '2026-07-23' }), delivery({ id: 'today' })],
      '2026-07-24',
    );

    expect(result.changed).toBe(true);
    expect(result.deliveries[0].entregue).toBe(true);
    expect(result.deliveries[1].entregue).toBe(false);
  });

  it('keeps custom prices ahead of historical prices and calculates quantity', () => {
    const service = new DeliveryPricingService();
    const value = service.calculateAutomaticValue({
      clientName: 'Guilherme',
      date: '2026-07-24',
      quantity: 3,
      customClients: { Guilherme: { nome: 'Guilherme', preco: 51.25 } },
    });

    expect(value).toBe(153.75);
  });

  it('uses the historical cutoff table when there is no custom price', () => {
    const service = new DeliveryPricingService();

    expect(
      service.calculateAutomaticValue({
        clientName: 'Guilherme',
        date: '2025-05-05',
        quantity: 2,
        customClients: {},
      }),
    ).toBe(89);
  });

  it('filters by mode, status and search, then sorts newest date first', () => {
    const service = new DeliveryQueryService();
    const result = service.filter(
      [
        delivery({ id: 'old', data: '2026-07-23', cliente: 'Sandro' }),
        delivery({ id: 'new', data: '2026-07-24', cliente: 'Guilherme', status: 'Pago' }),
      ],
      { mode: 'all', search: 'guil', status: 'Pago' },
    );

    expect(result.map((item) => item.id)).toEqual(['new']);
  });

  it('filters operational deliveries by payment, delivery and invoice status', () => {
    const service = new DeliveryQueryService();
    const result = service.filter(
      [
        delivery({ id: 'paid', status: 'Pago', entregue: true, invoiceStatus: 'emitido' }),
        delivery({ id: 'pending', status: 'Não Pago', entregue: false, invoiceStatus: 'a_emitir' }),
      ],
      {
        mode: 'today',
        date: '2026-07-24',
        status: 'Não Pago',
        deliveryStatus: 'Não entregue',
        invoiceStatus: 'a_emitir',
      },
    );

    expect(result.map((item) => item.id)).toEqual(['pending']);
  });

  it('does not require status chips when all delivery filters are selected', () => {
    const service = new DeliveryQueryService();
    const result = service.filter([delivery()], {
      mode: 'today',
      date: '2026-07-24',
      status: 'Todos',
      deliveryStatus: 'Todos',
      invoiceStatus: 'Todos',
    });

    expect(result).toHaveLength(1);
  });
});
