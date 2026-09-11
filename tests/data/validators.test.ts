import { DataValidationError, validateDeliveryArray, validateMonthlyExpenses } from '@/utils/data';

const delivery = {
  id: 'delivery-1',
  cliente: 'Aldo',
  quantidade: 2,
  valor: 104,
  status: 'Não Pago',
  entregue: false,
  data: '2026-04-05',
  invoiceStatus: 'a_emitir',
};

describe('data validators', () => {
  it('accepts the complete legacy delivery array shape', () => {
    expect(() => validateDeliveryArray([delivery])).not.toThrow();
  });

  it('rejects invalid payment methods before a write', () => {
    expect(() => validateDeliveryArray([{ ...delivery, metodoPagamento: 'Cartão' }])).toThrow(
      DataValidationError,
    );
  });

  it('accepts numeric and object monthly expense formats', () => {
    expect(() =>
      validateMonthlyExpenses({
        '2026-03': 100,
        '2026-04': { luz: 120, legado: 'preservado' },
      }),
    ).not.toThrow();
  });
});
