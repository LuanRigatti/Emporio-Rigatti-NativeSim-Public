import {
  mapDeliveries,
  mapMonthlyExpenses,
  toFirebaseDeliveries,
  toFirebaseMonthlyExpenses,
} from '@/mappers/firebase';
import { withoutLocalOnlyFields } from '@/types/data';

describe('firebase mappers', () => {
  it('removes local-only fields even when they arrive through legacyFields', () => {
    expect(
      withoutLocalOnlyFields({
        outros: 10,
        routeHistory: [],
        supportedLegacyField: 'keep',
      }),
    ).toEqual({ supportedLegacyField: 'keep' });
  });

  it('keeps legacy delivery fields when mapping back to Firebase', () => {
    const source = [
      {
        id: 'delivery-1',
        cliente: 'Santos',
        quantidade: '2',
        valor: 'R$ 100,00',
        status: 'Não Pago',
        entregue: false,
        data: '20/03/2026',
        observacao: 'registro antigo',
        campoLegado: 'não remover',
      },
    ];

    const mapped = mapDeliveries(source);
    const persisted = toFirebaseDeliveries(mapped);

    expect(mapped[0]?.cliente).toBe('Elias');
    expect(mapped[0]?.data).toBe('20/03/2026');
    expect(mapped[0]?.precoUnitarioHistorico).toBeUndefined();
    expect(persisted[0]?.campoLegado).toBe('não remover');
    expect(persisted[0]?.observacao).toBe('registro antigo');
  });

  it('round-trips the historical delivery price without dropping unknown fields', () => {
    const [mapped] = mapDeliveries([
      {
        id: 'delivery-with-history',
        cliente: 'Andre',
        quantidade: 2,
        valor: 99.6,
        precoUnitarioHistorico: 49.8,
        status: 'Não Pago',
        entregue: false,
        data: '2026-08-07',
        campoLegado: 'preservar',
      },
    ]);

    expect(mapped?.precoUnitarioHistorico).toBe(49.8);
    expect(toFirebaseDeliveries([mapped!])[0]).toMatchObject({
      campoLegado: 'preservar',
      precoUnitarioHistorico: 49.8,
    });
  });

  it('keeps numeric and object monthly expense formats', () => {
    const mapped = mapMonthlyExpenses({
      '2026-03': 100,
      '2026-04': { luz: 120, legado: 'preservado' },
    });
    const persisted = toFirebaseMonthlyExpenses(mapped);

    expect(persisted['2026-03']).toBe(100);
    expect(persisted['2026-04']).toEqual({ luz: 120, legado: 'preservado' });
  });
});
