import { mapFactoryReceipts } from '@/mappers/firebase';

function receipt(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'fab_1',
    quantidade: 10,
    data: '2026-07-01',
    valorTotal: 500,
    concluido: false,
    ...overrides,
  };
}

describe('legacy factory payment normalization', () => {
  let warningSpy: jest.SpyInstance;

  beforeEach(() => {
    warningSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warningSpy.mockRestore();
  });

  it('normalizes missing pagamentos to an empty array', () => {
    expect(mapFactoryReceipts([receipt()])[0]?.pagamentos).toEqual([]);
  });

  it('normalizes null pagamentos to an empty array', () => {
    expect(mapFactoryReceipts([receipt({ pagamentos: null })])[0]?.pagamentos).toEqual([]);
  });

  it('preserves an empty pagamentos array', () => {
    expect(mapFactoryReceipts([receipt({ pagamentos: [] })])[0]?.pagamentos).toEqual([]);
  });

  it('converts indexed payment objects and uses the key when id is absent', () => {
    const mapped = mapFactoryReceipts([
      receipt({
        pagamentos: {
          legacy_payment: { data: '2026-07-02', valor: 100 },
          existing_id: { id: 'internal_id', data: '2026-07-03', valor: 50 },
        },
      }),
    ]);

    expect(mapped[0]?.pagamentos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'legacy_payment', valor: 100 }),
        expect.objectContaining({ id: 'internal_id', valor: 50 }),
      ]),
    );
  });

  it('preserves numeric payment values', () => {
    const payment = mapFactoryReceipts([
      receipt({ pagamentos: [{ id: 'payment_1', data: '2026-07-02', valor: 125.5 }] }),
    ])[0]?.pagamentos[0];

    expect(payment).toMatchObject({ id: 'payment_1', data: '2026-07-02', valor: 125.5 });
  });

  it('converts string payment values with money validation', () => {
    const payment = mapFactoryReceipts([
      receipt({ pagamentos: [{ id: 'payment_1', data: '2026-07-02', valor: 'R$ 125,50' }] }),
    ])[0]?.pagamentos[0];

    expect(payment?.valor).toBe(125.5);
  });

  it('skips only partially invalid payment items', () => {
    const mapped = mapFactoryReceipts([
      receipt({
        pagamentos: [
          { id: 'valid', data: '2026-07-02', valor: 100 },
          { id: 'invalid', data: '2026-07-02', valor: 'not-a-number' },
        ],
      }),
    ]);

    expect(mapped).toHaveLength(1);
    expect(mapped[0]?.pagamentos).toEqual([
      expect.objectContaining({ id: 'valid', valor: 100 }),
    ]);
    expect(warningSpy).toHaveBeenCalled();
  });

  it('skips a completely invalid receipt without blocking other records', () => {
    const mapped = mapFactoryReceipts([receipt({ id: '' }), receipt({ id: 'valid_receipt' })]);

    expect(mapped.map((item) => item.id)).toEqual(['valid_receipt']);
    expect(warningSpy).toHaveBeenCalled();
  });

  it('handles mixed legacy payment formats in the same collection', () => {
    const mapped = mapFactoryReceipts([
      receipt({ id: 'missing' }),
      receipt({ id: 'null', pagamentos: null }),
      receipt({ id: 'array', pagamentos: [{ id: 'p1', data: '2026-07-02', valor: 10 }] }),
      receipt({
        id: 'object',
        pagamentos: { p2: { data: '2026-07-02', valor: '20' } },
      }),
      receipt({
        id: 'invalid-item',
        pagamentos: [{ id: 'bad', data: '2026-07-02', valor: 'invalid' }],
      }),
    ]);

    expect(mapped).toHaveLength(5);
    expect(mapped.map((item) => item.pagamentos.length)).toEqual([0, 0, 1, 1, 0]);
  });

  it('preserves the total paid after normalization', () => {
    const mapped = mapFactoryReceipts([
      receipt({
        pagamentos: {
          first: { data: '2026-07-02', valor: '100,00' },
          second: { id: 'second', data: '2026-07-03', valor: 50 },
        },
      }),
    ]);

    const totalPaid = mapped[0]?.pagamentos.reduce((total, payment) => total + payment.valor, 0);
    expect(totalPaid).toBe(150);
  });
});
