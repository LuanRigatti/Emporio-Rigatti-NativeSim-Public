jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  removeItem: jest.fn(),
  setItem: jest.fn(),
}));

import { ClientCatalogService, resolveClientPrice } from '@/services/clients';
import { mapLegacyClientToModel } from '@/mappers/clients';
import type { UserDataSnapshot } from '@/services/data';
import { formatClientName } from '@/utils/data';

const emptySnapshot: UserDataSnapshot = {
  clientesCustom: {},
  entregas: [],
  gastosDiarios: {},
  gastosMensais: {},
  recebimentoBaldes: [],
};

describe('client catalog and historical prices', () => {
  it('preserves both historical price cutoffs', () => {
    expect(resolveClientPrice('Aldo', '2025-05-04')).toBe(44.9);
    expect(resolveClientPrice('Aldo', '2025-05-05')).toBe(48.9);
    expect(resolveClientPrice('Aldo', '2026-04-04')).toBe(48.9);
    expect(resolveClientPrice('Aldo', '2026-04-05')).toBe(52);
  });

  it('gives custom price precedence over the historical table', () => {
    expect(resolveClientPrice('Aldo', '2024-01-01', { Aldo: { nome: 'Aldo', preco: 51 } })).toBe(
      51,
    );
  });

  it('canonicalizes aliases before building the application identity', () => {
    expect(formatClientName('SANTOS')).toBe('Elias');
    expect(mapLegacyClientToModel({ name: 'Santos', sources: ['delivery'] })).toMatchObject({
      canonicalName: 'Elias',
      clientId: 'legacy:elias',
      normalizedName: 'elias',
    });
  });

  it('allows a historical client to receive a custom configuration without duplication', () => {
    const service = new ClientCatalogService();
    const snapshot: UserDataSnapshot = {
      ...emptySnapshot,
      clientesCustom: { Aldo: { nome: 'Aldo', preco: 51, endereco: 'Rua A' } },
    };

    const clients = service.list(snapshot);
    const aldo = clients.filter((client) => client.normalizedName === 'aldo');

    expect(aldo).toHaveLength(1);
    expect(aldo[0].customConfig?.preco).toBe(51);
    expect(aldo[0].sources).toEqual(expect.arrayContaining(['historical', 'custom']));
  });

  it('preserves the per-client invoice eligibility preference', () => {
    const client = mapLegacyClientToModel({
      customConfig: { nome: 'Aldo', preco: 51, usesInvoice: true },
      name: 'Aldo',
      sources: ['custom'],
    });

    expect(client.usesInvoice).toBe(true);
    expect(
      mapLegacyClientToModel({ name: 'Cliente sem nota', sources: ['delivery'] }).usesInvoice,
    ).toBe(false);
  });
});
