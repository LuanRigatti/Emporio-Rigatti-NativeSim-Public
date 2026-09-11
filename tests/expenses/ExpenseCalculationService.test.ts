import {
  EXPENSE_CUTOFFS,
  ExpenseCalculationService,
} from '@/services/expenses/ExpenseCalculationService';
import type { DailyExpenses, Delivery, MonthlyExpenses } from '@/types/data';

const service = new ExpenseCalculationService();

const monthlyExpenses: MonthlyExpenses = {
  '2026-07': { luz: 100 },
};

const delivery = (date: string, quantity = 1): Delivery => ({
  id: `delivery-${date}-${quantity}`,
  cliente: 'Guilherme',
  quantidade: quantity,
  valor: 48.5 * quantity,
  status: 'Não Pago',
  entregue: true,
  data: date,
});

describe('ExpenseCalculationService historical rules', () => {
  it('uses the legacy gasoline field before the fuel model cutoff', () => {
    const expenses: DailyExpenses = {
      '2026-04-30': { data: '2026-04-30', gasolina: 180 },
    };

    expect(service.calculateFuelCost('2026-04-30', expenses['2026-04-30'])).toBe(180);
    expect(EXPENSE_CUTOFFS.currentFuelModel).toBe('2026-05-01');
  });

  it('uses gasoline average from the current fuel model cutoff', () => {
    expect(
      service.calculateFuelCost('2026-05-01', {
        data: '2026-05-01',
        km: 74,
        precoGasolina: 6,
        tipoCombustivel: 'gasolina',
      }),
    ).toBeCloseTo(60, 8);
  });

  it('adds local route kilometers to the saved daily kilometers', () => {
    expect(
      service.calculateFuelCost(
        '2026-05-01',
        { data: '2026-05-01', km: 74, precoGasolina: 6, tipoCombustivel: 'gasolina' },
        7.4,
      ),
    ).toBeCloseTo(66, 8);
  });

  it('uses ethanol average for an explicit ethanol record', () => {
    expect(
      service.calculateFuelCost('2026-05-01', {
        data: '2026-05-01',
        km: 74,
        precoGasolina: 6,
        tipoCombustivel: 'etanol',
      }),
    ).toBeCloseTo((74 / 5.6) * 6, 8);
  });

  it('uses the historical default average through 2026-06-30 and the new default afterward', () => {
    const withoutType = { data: '2026-06-30', km: 74, precoGasolina: 6 };
    expect(service.calculateFuelCost('2026-06-30', withoutType)).toBeCloseTo((74 / 5.6) * 6, 8);
    expect(
      service.calculateFuelCost('2026-07-01', { ...withoutType, data: '2026-07-01' }),
    ).toBeCloseTo(60, 8);
  });

  it('treats an unknown explicit fuel type as gasoline', () => {
    expect(
      service.calculateFuelCost('2026-07-01', {
        data: '2026-07-01',
        km: 74,
        precoGasolina: 6,
        tipoCombustivel: 'diesel',
      }),
    ).toBeCloseTo(60, 8);
  });

  it('uses only saved monthly light values', () => {
    const today = new Date('2026-07-24T12:00:00');
    expect(service.calculateMonthlyLight('2026-07', {}, today)).toBe(0);
    expect(service.calculateMonthlyLight('2026-08', {}, today)).toBe(0);
    expect(service.calculateMonthlyLight('2026-07', { '2026-07': 80 }, today)).toBe(80);
    expect(service.calculateMonthlyLight('2026-07', { '2026-07': { luz: -10 } }, today)).toBe(0);
  });

  it('preserves the historical bucket cost cutoff', () => {
    expect(service.calculateBucketCost('2026-03-19')).toBe(32);
    expect(service.calculateBucketCost('2026-03-20')).toBe(35);
    expect(service.calculateBucketCost('')).toBe(35);
  });

  it('counts only Mondays, Wednesdays and Fridays', () => {
    expect(service.countWorkingDays(2026, 6)).toBe(14);
  });

  it('allocates light by selected working days across an interval', () => {
    expect(
      service.calculateLightForInterval(
        '2026-07-01',
        '2026-07-01',
        monthlyExpenses,
        new Date('2026-07-24T12:00:00'),
      ),
    ).toBeCloseTo(100 / 14, 8);
  });

  it('divides fuel cost by delivery records, not bucket quantity', () => {
    const expenses: DailyExpenses = {
      '2026-07-01': { data: '2026-07-01', km: 74, precoGasolina: 6, tipoCombustivel: 'gasolina' },
    };
    expect(
      service.calculateFuelCostPerDelivery(
        '2026-07-01',
        [delivery('2026-07-01', 10), delivery('2026-07-01', 2)],
        expenses,
      ),
    ).toBeCloseTo(30, 8);
  });
});
