import { FactoryReceiptMutationService } from '@/services/finance/FactoryReceiptMutationService';
import {
  factoryCalculationService,
  FACTORY_PAYMENT_TOLERANCE,
} from '@/services/finance/FactoryCalculationService';
import { FactoryReceiptQueryService } from '@/services/finance/FactoryReceiptQueryService';
import type { FactoryReceipt } from '@/types/data';
import type { UserDataSnapshot } from '@/services/data';

const mockReplace = jest.fn().mockResolvedValue(undefined);

jest.mock('@/repositories/FactoryReceiptRepository', () => ({
  FactoryReceiptRepository: jest.fn().mockImplementation(() => ({ replace: mockReplace })),
}));

jest.mock('@/services/cache', () => ({
  asyncStorageCacheService: { write: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('@/services/data', () => ({
  userDataService: { readFromFirebase: jest.fn() },
}));

function receipt(overrides: Partial<FactoryReceipt> = {}): FactoryReceipt {
  return {
    id: 'fab_1',
    quantidade: 10,
    data: '2026-07-01',
    valorTotal: 500,
    concluido: false,
    pagamentos: [{ id: 'pay_1', data: '2026-07-02', valor: 350 }],
    ...overrides,
  };
}

function snapshot(receipts: FactoryReceipt[]): UserDataSnapshot {
  return {
    entregas: [],
    gastosDiarios: {},
    gastosMensais: {},
    recebimentoBaldes: receipts,
    clientesCustom: {},
  };
}

describe('FactoryCalculationService', () => {
  it('calculates payment, balance and progress without negative balance', () => {
    const item = receipt();

    expect(factoryCalculationService.totalPaid(item)).toBe(350);
    expect(factoryCalculationService.openValue(item)).toBe(150);
    expect(factoryCalculationService.paymentProgress(item)).toBe(0.7);
    expect(
      factoryCalculationService.openValue(
        receipt({ pagamentos: [{ id: 'pay', data: '2026-07-02', valor: 550 }] }),
      ),
    ).toBe(0);
  });

  it('preserves the strict sub-cent completion tolerance', () => {
    expect(FACTORY_PAYMENT_TOLERANCE).toBe(0.01);
    expect(
      factoryCalculationService.isWithinSettlementTolerance(
        receipt({
          valorTotal: 100,
          pagamentos: [{ id: 'pay', data: '2026-07-02', valor: 99.995 }],
        }),
      ),
    ).toBe(true);
    expect(
      factoryCalculationService.isWithinSettlementTolerance(
        receipt({ valorTotal: 100, pagamentos: [{ id: 'pay', data: '2026-07-02', valor: 99.99 }] }),
      ),
    ).toBe(false);
  });

  it('accepts payments below and equal to the remaining balance', () => {
    const item = receipt();

    expect(factoryCalculationService.assertPaymentWithinBalance(item, 50)).toBe(50);
    expect(factoryCalculationService.assertPaymentWithinBalance(item, 150)).toBe(150);
  });

  it('rejects payments above the remaining balance with a clear maximum', () => {
    expect(() => factoryCalculationService.assertPaymentWithinBalance(receipt(), 160)).toThrow(
      'O pagamento não pode ultrapassar o saldo restante de R$ 150,00.',
    );
  });

  it('rejects payment attempts for an already settled receipt', () => {
    expect(() =>
      factoryCalculationService.assertPaymentWithinBalance(
        receipt({ concluido: true, pagamentos: [{ id: 'pay', data: '2026-07-02', valor: 500 }] }),
        1,
      ),
    ).toThrow('Este recebimento já está quitado.');
  });
});

describe('FactoryReceiptQueryService', () => {
  const service = new FactoryReceiptQueryService();
  const entries = [
    receipt({ id: 'older', data: '2026-06-20' }),
    receipt({ id: 'newer', data: '2026-07-10' }),
  ];

  it('filters the current month and preserves descending date order', () => {
    expect(service.filter(entries, { period: 'month' }, new Date('2026-07-25'))).toEqual([
      entries[1],
    ]);
  });

  it('returns the complete factory history when requested', () => {
    expect(
      service.filter(entries, { period: 'all' }, new Date('2026-07-25')).map((item) => item.id),
    ).toEqual(['newer', 'older']);
  });

  it('filters factory movements to the period required by stock calculation', () => {
    expect(
      service
        .filter([...entries, receipt({ id: 'future', data: '2026-08-01' })], {
          endDate: '2026-07-31',
          period: 'all',
        })
        .map((item) => item.id),
    ).toEqual(['newer', 'older']);
  });
});

describe('FactoryReceiptMutationService', () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  it('adds a partial payment and automatically concludes at the exact balance', async () => {
    const initial = snapshot([receipt()]);
    const service = new FactoryReceiptMutationService('uid', async () => initial);

    const updated = await service.addPayment('fab_1', { date: '2026-07-03', amount: 150 });

    expect(updated.concluido).toBe(true);
    expect(updated.pagamentos.at(-1)?.valor).toBe(150);
    expect(mockReplace).toHaveBeenCalledWith([expect.objectContaining({ concluido: true })]);
  });

  it('removes a payment from a concluded receipt and reopens it', async () => {
    const initial = snapshot([
      receipt({
        concluido: true,
        pagamentos: [
          { id: 'pay_1', data: '2026-07-02', valor: 350 },
          { id: 'pay_2', data: '2026-07-03', valor: 150 },
        ],
      }),
    ]);
    const service = new FactoryReceiptMutationService('uid', async () => initial);

    const updated = await service.removePayment('fab_1', 'pay_2');

    expect(updated.pagamentos).toHaveLength(1);
    expect(updated.concluido).toBe(false);
  });
});
