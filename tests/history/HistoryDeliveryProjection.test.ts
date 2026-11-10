import type { Delivery } from '@/types/data';
import type { HistoryDelivery } from '@/features/history/data/historyMocks';
import { createHistoryDeliveryProjector } from '@/features/history/utils/historyDeliveryProjection';

function createDelivery(id: string, overrides: Partial<Delivery> = {}): Delivery {
  return {
    cliente: `Cliente sintético ${id}`,
    data: '2026-11-06',
    entregue: true,
    id,
    metodoPagamento: 'Pix',
    observacao: '',
    quantidade: 2,
    status: 'Pago',
    valor: 50,
    ...overrides,
  };
}

function convertDelivery(delivery: Delivery): HistoryDelivery {
  return {
    bairro: '',
    cliente: delivery.cliente,
    data: delivery.data,
    formaPagamento: delivery.metodoPagamento ?? '',
    id: delivery.id,
    observacoes: delivery.observacao ?? '',
    paymentStatus: delivery.status === 'Pago' ? 'Pago' : 'Não Pago',
    quantidadeBaldes: delivery.quantidade,
    status: delivery.entregue ? 'concluída' : 'pendente',
    valor: String(delivery.valor),
  };
}

const mappedInputChanges: [string, Partial<Delivery>][] = [
  ['client name', { cliente: 'Outro cliente sintético' }],
  ['date', { data: '2026-11-05' }],
  ['payment method', { metodoPagamento: 'Dinheiro' }],
  ['notes', { observacao: 'Nota sintética' }],
  ['quantity', { quantidade: 4 }],
  ['delivery state', { entregue: false }],
  ['payment state', { status: 'Não Pago' }],
  ['amount', { valor: 80 }],
];

describe('History delivery projection', () => {
  it('reuses projected rows for new objects with the same consumed content', () => {
    const project = createHistoryDeliveryProjector(convertDelivery, 'uid-a:1');
    const first = project([createDelivery('a'), createDelivery('b')]);
    const second = project([createDelivery('a'), createDelivery('b')]);

    expect(second.convertedCount).toBe(0);
    expect(second.reusedCount).toBe(2);
    expect(second.items[0]).toBe(first.items[0]);
    expect(second.items[1]).toBe(first.items[1]);
    expect(second.orderChanged).toBe(false);
  });

  it('reprojects a changed row while preserving unchanged rows', () => {
    const project = createHistoryDeliveryProjector(convertDelivery, 'uid-a:1');
    const first = project([createDelivery('a'), createDelivery('b')]);
    const second = project([
      createDelivery('a'),
      createDelivery('b', { quantidade: 3, valor: 75 }),
    ]);

    expect(second.convertedCount).toBe(1);
    expect(second.reusedCount).toBe(1);
    expect(second.items[0]).toBe(first.items[0]);
    expect(second.items[1]).not.toBe(first.items[1]);
    expect(second.items[1]).toMatchObject({ quantidadeBaldes: 3 });
  });

  it.each(mappedInputChanges)('reprojects when the mapped %s changes', (_label, changedFields) => {
    const project = createHistoryDeliveryProjector(convertDelivery, 'uid-a:1');
    const first = project([createDelivery('a')]);
    const next = project([createDelivery('a', changedFields)]);

    expect(next.convertedCount).toBe(1);
    expect(next.items[0]).not.toBe(first.items[0]);
  });

  it('keeps delivery and payment status independent in projected rows', () => {
    const project = createHistoryDeliveryProjector(convertDelivery, 'uid-a:1');
    const unpaid = project([createDelivery('a', { entregue: true, status: 'Não Pago' })]);
    const paid = project([createDelivery('a', { entregue: false, status: 'Pago' })]);

    expect(unpaid.items[0]).toMatchObject({ status: 'concluída', paymentStatus: 'Não Pago' });
    expect(paid.items[0]).toMatchObject({ status: 'pendente', paymentStatus: 'Pago' });
  });

  it('preserves changed order and membership without reusing removed identities', () => {
    const project = createHistoryDeliveryProjector(convertDelivery, 'uid-a:1');
    project([createDelivery('a'), createDelivery('b')]);
    const reordered = project([createDelivery('b'), createDelivery('c')]);
    const next = project([createDelivery('b'), createDelivery('c')]);

    expect(reordered.items.map(({ id }) => id)).toEqual(['b', 'c']);
    expect(reordered.convertedCount).toBe(1);
    expect(reordered.insertedCount).toBe(1);
    expect(reordered.removedCount).toBe(1);
    expect(reordered.orderChanged).toBe(true);
    expect(next.convertedCount).toBe(0);
    expect(next.orderChanged).toBe(false);
  });

  it.each([
    ['UID', 'uid-b:1'],
    ['sessionVersion', 'uid-a:2'],
  ])('clears projected identities when the %s changes', (_label, nextScopeKey) => {
    const project = createHistoryDeliveryProjector(convertDelivery, 'uid-a:1');
    project([createDelivery('same-id')], 'uid-a:1');

    expect(project([createDelivery('same-id')], nextScopeKey).convertedCount).toBe(1);
  });
});
