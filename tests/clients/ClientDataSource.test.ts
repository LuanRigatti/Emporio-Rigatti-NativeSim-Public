import { MockClientDataSource } from '@/services/clients/MockClientDataSource';
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

describe('MockClientDataSource', () => {
  it('lists, persists, edits and renames a client without changing delivery history', async () => {
    const source = new MockClientDataSource();
    const originalName = `Cliente Etapa 3 ${Date.now()}`;
    const renamedName = `${originalName} Renomeado`;

    await source.load();
    await source.saveCustomClient(undefined, originalName, 51, 'Rua A');

    const createdClient = source.list().find((client) => client.canonicalName === originalName);
    expect(createdClient).toBeDefined();
    if (!createdClient) throw new Error('Cliente de teste não foi criado.');
    expect(source.list({ search: originalName })).toHaveLength(1);

    const oldDelivery = mockDeliveryDataSource.createFromRegistration({
      bucketPrice: 51,
      clientName: originalName,
      date: new Date(2026, 7, 9),
      quantity: 2,
    });

    await source.updatePrice(undefined, createdClient, 55);
    expect(source.list().find((client) => client.canonicalName === originalName)).toMatchObject({
      customConfig: { preco: 55 },
      currentPrice: 55,
    });
    const newDelivery = mockDeliveryDataSource.createFromRegistration({
      bucketPrice: 55,
      clientName: originalName,
      date: new Date(2026, 7, 9),
      quantity: 1,
    });

    expect(oldDelivery).toMatchObject({ precoUnitarioHistorico: 51, valor: 102 });
    expect(newDelivery).toMatchObject({ precoUnitarioHistorico: 55, valor: 55 });

    await source.rename(undefined, createdClient!, renamedName);
    const renamedClient = source.list().find((client) => client.canonicalName === renamedName);
    const renamedDeliveries = mockDeliveryDataSource
      .getAll()
      .filter((delivery) => delivery.cliente === renamedName);

    expect(renamedClient).toBeDefined();
    if (!renamedClient) throw new Error('Cliente renomeado não foi encontrado.');
    expect(renamedDeliveries).toHaveLength(2);
    expect(renamedDeliveries.map((delivery) => delivery.precoUnitarioHistorico)).toEqual(
      expect.arrayContaining([51, 55]),
    );

    const restoredSource = new MockClientDataSource();
    await restoredSource.load();
    expect(restoredSource.list({ search: renamedName })).toHaveLength(1);
    expect(restoredSource.list({ search: renamedName })[0]).toMatchObject({
      customConfig: { preco: 55 },
      currentPrice: 55,
    });

    await source.removeCustomConfiguration(undefined, renamedClient);
    expect(source.list({ search: renamedName })).toHaveLength(0);
    expect(mockDeliveryDataSource.getAll()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: oldDelivery.id, cliente: renamedName }),
        expect.objectContaining({ id: newDelivery.id, cliente: renamedName }),
      ]),
    );
    mockDeliveryDataSource.remove(oldDelivery.id);
    mockDeliveryDataSource.remove(newDelivery.id);
  });
});
