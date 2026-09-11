import { FirestoreDeliveryDataSource } from '@/services/deliveries/FirestoreDeliveryDataSource';
import { createDeliveryFromDraft } from '@/services/deliveries/deliveryRecord';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

jest.mock('@/services/firebase', () => ({
  getFirebaseFirestore: jest.fn(() => ({})),
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({})),
  deleteDoc: jest.fn(async () => undefined),
  doc: jest.fn((_collection: unknown, id?: string) => ({ id: id ?? 'generated-id' })),
  getDoc: jest.fn(async () => ({ exists: () => false })),
  getDocs: jest.fn(async () => ({ docs: [] })),
  query: jest.fn(() => ({})),
  serverTimestamp: jest.fn(() => ({ __type: 'serverTimestamp' })),
  setDoc: jest.fn(async () => undefined),
  updateDoc: jest.fn(async () => undefined),
  where: jest.fn(() => ({})),
}));

describe('new Firestore clients and deliveries foundation', () => {
  it('preserves client identity, historical unit price and total when creating a delivery', () => {
    const delivery = createDeliveryFromDraft({
      address: 'Rua A',
      addressConfirmed: true,
      clientId: 'client:abc123',
      clientName: 'Ana Costa',
      date: '2026-08-10',
      delivered: false,
      invoiceStatus: 'a_emitir',
      quantity: 2,
      status: 'Não Pago',
      value: 99.6,
      valueWasManuallyChanged: false,
      historicalUnitPrice: 49.8,
    });

    expect(delivery).toMatchObject({
      clientId: 'client:abc123',
      cliente: 'Ana Costa',
      data: '2026-08-10',
      quantidade: 2,
      precoUnitarioHistorico: 49.8,
      valor: 99.6,
    });
  });

  it('does not issue an unbounded query for the new document-based delivery source', async () => {
    const source = new FirestoreDeliveryDataSource();

    await expect(source.load('firebase-user', { mode: 'all' })).resolves.toEqual([]);
  });

  it('uses the same unpaid status predicate for the summary/list query', () => {
    const source = new FirestoreDeliveryDataSource();
    const records = source as unknown as { records: Map<string, unknown> };
    records.records.set('open', {
      id: 'open',
      cliente: 'Ana Costa',
      data: '2026-08-10',
      quantidade: 1,
      valor: 49.8,
      status: 'Não Pago',
      entregue: false,
    });
    records.records.set('paid', {
      id: 'paid',
      cliente: 'Ana Costa',
      data: '2026-08-10',
      quantidade: 1,
      valor: 49.8,
      status: 'Pago',
      entregue: true,
    });

    expect(source.getCached({ mode: 'all', status: 'Não Pago' })).toHaveLength(1);
    expect(source.getCached({ mode: 'all', status: 'Não Pago' })[0]?.id).toBe('open');
  });

  it('filters cached deliveries by eligible client ids without using client names', () => {
    const source = new FirestoreDeliveryDataSource();
    const records = source as unknown as { records: Map<string, unknown> };
    records.records.set('eligible', {
      id: 'eligible',
      clientId: 'client:uses-invoice',
      cliente: 'Nome atual',
      data: '2026-08-10',
      quantidade: 1,
      valor: 49.8,
      status: 'NÃ£o Pago',
      entregue: false,
      invoiceStatus: 'a_emitir',
    });
    records.records.set('ineligible', {
      id: 'ineligible',
      clientId: 'client:no-invoice',
      cliente: 'Nome diferente',
      data: '2026-08-10',
      quantidade: 1,
      valor: 49.8,
      status: 'NÃ£o Pago',
      entregue: false,
      invoiceStatus: 'a_emitir',
    });

    expect(
      source.getCached({ mode: 'all', clientIds: ['client:uses-invoice'] }).map((item) => item.id),
    ).toEqual(['eligible']);
  });

  it('allows a past delivery date without changing the date or historical value', () => {
    const delivery = createDeliveryFromDraft({
      address: 'Rua B',
      addressConfirmed: true,
      clientId: 'client:past',
      clientName: 'Cliente Histórico',
      date: '2024-01-03',
      delivered: true,
      invoiceStatus: 'emitido',
      quantity: 1,
      status: 'Pago',
      paymentMethod: 'Pix',
      value: 37.5,
      valueWasManuallyChanged: true,
      historicalUnitPrice: 37.5,
    });

    expect(delivery.data).toBe('2024-01-03');
    expect(delivery.precoUnitarioHistorico).toBe(37.5);
    expect(delivery.valor).toBe(37.5);
  });
});
