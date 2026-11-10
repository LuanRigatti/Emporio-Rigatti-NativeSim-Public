import { DeliveryNormalizationService } from '@/services/deliveries/DeliveryNormalizationService';
import { DeliveryPricingService } from '@/services/deliveries/DeliveryPricingService';
import { DeliveryQueryService } from '@/services/deliveries/DeliveryQueryService';
import {
  applyDeliveryWorkflowMutation,
  createDeliveryFromDraft,
  transitionDeliveryPaymentStatus,
} from '@/services/deliveries/deliveryRecord';
import type { Delivery } from '@/types/data';
import { todayIso } from '@/utils/data';

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
  it('applies delivery and first payment together while preserving delivery value and date', () => {
    const current = delivery({ data: '2026-10-10', entregue: false, valor: 120 });
    const updated = applyDeliveryWorkflowMutation(current, {
      delivered: true,
      expected: {
        dataPagamento: undefined,
        entregue: false,
        metodoPagamento: undefined,
        status: 'Não Pago',
      },
      paymentReversalConfirmed: false,
      paymentSelection: 'Pix',
      paymentSelectionChanged: true,
    });

    expect(updated).toMatchObject({
      data: '2026-10-10',
      dataPagamento: todayIso(),
      entregue: true,
      metodoPagamento: 'Pix',
      status: 'Pago',
      valor: 120,
    });
  });

  it('changes only method when editing paid history and requires confirmation to reverse', () => {
    const current = delivery({
      data: '2026-08-02',
      dataPagamento: '2026-08-06',
      entregue: true,
      metodoPagamento: 'Pix',
      status: 'Pago',
      valor: 78,
    });
    const corrected = applyDeliveryWorkflowMutation(current, {
      delivered: false,
      expected: {
        dataPagamento: '2026-08-06',
        entregue: true,
        metodoPagamento: 'Pix',
        status: 'Pago',
      },
      paymentReversalConfirmed: false,
      paymentSelection: 'Dinheiro',
      paymentSelectionChanged: true,
    });

    expect(corrected).toMatchObject({
      data: '2026-08-02',
      dataPagamento: '2026-08-06',
      entregue: false,
      metodoPagamento: 'Dinheiro',
      status: 'Pago',
      valor: 78,
    });
    expect(() =>
      applyDeliveryWorkflowMutation(current, {
        delivered: true,
        expected: {
          dataPagamento: current.dataPagamento,
          entregue: current.entregue,
          metodoPagamento: current.metodoPagamento,
          status: current.status,
        },
        paymentReversalConfirmed: false,
        paymentSelection: 'Não Pago',
        paymentSelectionChanged: true,
      }),
    ).toThrow('Confirme explicitamente para desfazer o pagamento.');
  });

  it('preserves an unknown legacy payment method when only delivery changes', () => {
    const current = delivery({
      entregue: false,
      status: 'Pago',
    });
    const updated = applyDeliveryWorkflowMutation(current, {
      delivered: true,
      expected: {
        dataPagamento: undefined,
        entregue: false,
        metodoPagamento: undefined,
        status: 'Pago',
      },
      paymentReversalConfirmed: false,
      paymentSelection: 'Pix',
      paymentSelectionChanged: false,
    });

    expect(updated).toMatchObject({ entregue: true, status: 'Pago' });
    expect(updated).not.toHaveProperty('metodoPagamento');
    expect(updated).not.toHaveProperty('dataPagamento');
  });

  it('does not allow a new payment unless the resulting delivery state is delivered', () => {
    const current = delivery();

    expect(() =>
      applyDeliveryWorkflowMutation(current, {
        delivered: false,
        expected: {
          dataPagamento: undefined,
          entregue: false,
          metodoPagamento: undefined,
          status: 'Não Pago',
        },
        paymentReversalConfirmed: false,
        paymentSelection: 'Dinheiro',
        paymentSelectionChanged: true,
      }),
    ).toThrow('Marque a entrega como Entregue antes de registrar o pagamento.');
  });

  it('stores payment dates for new payments and preserves unknown or existing history on edits', () => {
    const draft = {
      address: 'Rua Central, 10',
      addressConfirmed: true,
      clientName: 'Ana',
      date: '2026-10-10',
      delivered: true,
      invoiceStatus: 'a_emitir' as const,
      paymentMethod: 'Pix' as const,
      quantity: 2,
      status: 'Pago' as const,
      value: 100,
      valueWasManuallyChanged: false,
    };
    const newlyPaid = createDeliveryFromDraft(draft);
    const existingPaid = delivery({
      cliente: 'Ana',
      data: '2026-10-10',
      dataPagamento: '2026-10-22',
      entregue: true,
      metodoPagamento: 'Pix',
      status: 'Pago',
      valor: 100,
    });
    const editedPaid = createDeliveryFromDraft(
      { ...draft, paymentMethod: 'Dinheiro' },
      existingPaid,
    );
    const legacyPaid = delivery({
      cliente: 'Bia',
      data: '2026-08-02',
      entregue: true,
      status: 'Pago',
    });
    const correctedLegacy = createDeliveryFromDraft(
      { ...draft, clientName: 'Bia', date: '2026-08-02', paymentMethod: 'Dinheiro' },
      legacyPaid,
    );
    const reversed = transitionDeliveryPaymentStatus(existingPaid, 'Não Pago');

    expect(newlyPaid).toMatchObject({
      data: '2026-10-10',
      dataPagamento: todayIso(),
      metodoPagamento: 'Pix',
      status: 'Pago',
      valor: 100,
    });
    expect(editedPaid).toMatchObject({ dataPagamento: '2026-10-22', metodoPagamento: 'Dinheiro' });
    expect(correctedLegacy).toMatchObject({ metodoPagamento: 'Dinheiro', status: 'Pago' });
    expect(correctedLegacy).not.toHaveProperty('dataPagamento');
    expect(reversed).toMatchObject({
      data: '2026-10-10',
      entregue: true,
      status: 'Não Pago',
      valor: 100,
    });
    expect(reversed).not.toHaveProperty('metodoPagamento');
    expect(reversed).not.toHaveProperty('dataPagamento');
  });

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
    expect(
      service.resolveUnitPrice({
        clientName: 'Guilherme',
        date: '2026-07-24',
        quantity: 3,
        customClients: { Guilherme: { nome: 'Guilherme', preco: 51.25 } },
      }),
    ).toBe(51.25);
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

  it('shows only delivered and unpaid deliveries as open payments', () => {
    const service = new DeliveryQueryService();
    const result = service.filter(
      [
        delivery({ id: 'delivered-unpaid', entregue: true, status: 'Não Pago' }),
        delivery({ id: 'delivered-paid', entregue: true, status: 'Pago' }),
        delivery({ id: 'pending-unpaid', entregue: false, status: 'Não Pago' }),
        delivery({
          id: 'future-scheduled',
          data: '2099-12-31',
          entregue: false,
          status: 'Não Pago',
        }),
      ],
      { mode: 'all', status: 'Não Pago', deliveryStatus: 'Entregue' },
    );

    expect(result.map((item) => item.id)).toEqual(['delivered-unpaid']);
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

  it('filters deliveries by boleto status with legacy fallback', () => {
    const service = new DeliveryQueryService();
    const result = service.filter(
      [
        delivery({ id: 'legacy-open', invoiceStatus: 'a_emitir' }),
        delivery({ id: 'legacy-emitted', invoiceStatus: 'emitido' }),
        delivery({
          id: 'custom-boleto-emitted',
          invoiceStatus: 'a_emitir',
          boletoStatus: 'emitido',
        }),
        delivery({ id: 'custom-boleto-open', invoiceStatus: 'emitido', boletoStatus: 'a_emitir' }),
      ],
      { mode: 'all', boletoStatus: 'a_emitir' },
    );

    expect(result.map((item) => item.id)).toEqual(['legacy-open', 'custom-boleto-open']);
  });
});
