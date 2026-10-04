import type { CompleteDeliveryDateSnapshot } from '@/services/deliveries/FirestoreDeliveryDataSource';
import type { Delivery } from '@/types/data';
import {
  nextLocalMidnight,
  projectWholesaleDeliverySnapshot,
} from '@/features/deliveries/liveActivity/LiveActivityProjection';

function delivery(overrides: Partial<Delivery> = {}): Delivery {
  return {
    id: 'delivery-1',
    cliente: 'Cliente',
    quantidade: 2,
    valor: 50,
    status: 'Não Pago',
    entregue: false,
    data: '2026-10-03',
    ...overrides,
  };
}

describe('Live Activity projection', () => {
  it('projects the canonical quantity sum and counts every delivery record', () => {
    const snapshot: CompleteDeliveryDateSnapshot = {
      uid: 'user-1',
      date: '2026-10-03',
      completedAt: 1,
      deliveries: [
        delivery({ id: 'pending-unpaid', quantidade: 2, entregue: false, status: 'Não Pago' }),
        delivery({ id: 'delivered-paid', quantidade: 3, entregue: true, status: 'Pago' }),
        delivery({ id: 'fractional', quantidade: 0.5, entregue: true, status: 'Não Pago' }),
      ],
    };

    expect(projectWholesaleDeliverySnapshot(snapshot)).toEqual({
      date: '2026-10-03',
      bucketCount: 5.5,
      deliveryCount: 3,
    });
  });

  it('projects a complete empty date as zero, without treating cache as a projection input', () => {
    const snapshot: CompleteDeliveryDateSnapshot = {
      uid: 'user-1',
      date: '2026-10-03',
      completedAt: 1,
      deliveries: [],
    };

    expect(projectWholesaleDeliverySnapshot(snapshot)).toEqual({
      date: '2026-10-03',
      bucketCount: 0,
      deliveryCount: 0,
    });
  });

  it('sets the next local calendar midnight, including month rollover', () => {
    const nextMidnight = nextLocalMidnight('2026-10-31');

    expect(nextMidnight.getFullYear()).toBe(2026);
    expect(nextMidnight.getMonth()).toBe(10);
    expect(nextMidnight.getDate()).toBe(1);
    expect(nextMidnight.getHours()).toBe(0);
  });
});
