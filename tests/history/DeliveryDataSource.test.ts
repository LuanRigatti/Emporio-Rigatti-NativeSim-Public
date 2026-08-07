import { mockDeliveryDataSource } from '@/services/deliveries/DeliveryDataSource';

jest.mock('@react-native-async-storage/async-storage', () => {
  const values = new Map<string, string>();

  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => values.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        values.set(key, value);
      }),
    },
  };
});

describe('mockDeliveryDataSource', () => {
  it('creates, updates and removes a delivery through one contract', () => {
    const delivery = mockDeliveryDataSource.createFromRegistration({
      bucketPrice: 49.8,
      clientName: `Data source test ${Date.now()}`,
      date: new Date(2026, 7, 7),
      quantity: 2,
    });

    expect(mockDeliveryDataSource.getAll()).toContainEqual(delivery);
    expect(delivery.quantidade).toBe(2);
    expect(delivery.valor).toBe(99.6);
    expect(delivery.status).toBe('NÃ£o Pago');

    mockDeliveryDataSource.toggleStatus(delivery.id);
    expect(mockDeliveryDataSource.getAll().find((item) => item.id === delivery.id)?.status).toBe(
      'Pago',
    );

    mockDeliveryDataSource.remove(delivery.id);
    expect(mockDeliveryDataSource.getAll().some((item) => item.id === delivery.id)).toBe(false);
  });

  it('keeps the old unit price when a later registration uses a new price', () => {
    const clientName = `Price history test ${Date.now()}`;
    const date = new Date(2026, 7, 8);
    const oldDelivery = mockDeliveryDataSource.createFromRegistration({
      bucketPrice: 49.8,
      clientName,
      date,
      quantity: 2,
    });
    const newDelivery = mockDeliveryDataSource.createFromRegistration({
      bucketPrice: 52,
      clientName,
      date,
      quantity: 3,
    });

    expect(oldDelivery).toMatchObject({ precoUnitarioHistorico: 49.8, valor: 99.6 });
    expect(newDelivery).toMatchObject({ precoUnitarioHistorico: 52, valor: 156 });
    expect(mockDeliveryDataSource.getAll().filter((item) => item.cliente === clientName)).toEqual(
      expect.arrayContaining([oldDelivery, newDelivery]),
    );

    mockDeliveryDataSource.remove(oldDelivery.id);
    mockDeliveryDataSource.remove(newDelivery.id);
  });
});
