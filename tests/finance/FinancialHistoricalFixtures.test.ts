import { DeliveryPricingService } from '@/services/deliveries/DeliveryPricingService';
import { ExpenseCalculationService } from '@/services/expenses/ExpenseCalculationService';
import { FinancialCalculationService } from '@/services/finance/FinancialCalculationService';

import {
  ionicBucketAndPaymentsDeliveries,
  ionicMonthlyComparisonFixture,
  ionicPriceFixtures,
  ionicSummaryFixture,
  ionicToday,
  ionicWorkingDayDeliveries,
  ionicWorkingDayExpenses,
  ionicWorkingDayMonthlyExpenses,
} from '../fixtures/financialHistoricalFixtures';

describe('Ionic historical financial fixtures', () => {
  it.each(ionicPriceFixtures)('matches the Ionic price rule: $id', (fixture) => {
    const service = new DeliveryPricingService();
    expect(
      service.calculateAutomaticValue({
        clientName: fixture.clientName,
        date: fixture.date,
        quantity: fixture.quantity,
        customClients: 'customClients' in fixture ? fixture.customClients : {},
      }),
    ).toBe(fixture.expected);
  });

  it('matches bucket cost, revenue, paid and pending values across the historical cutoff', () => {
    const service = new FinancialCalculationService();
    const result = service.calculateResumo(ionicSummaryFixture);

    expect(result.faturamento).toBe(180);
    expect(result.valoresPagos).toBe(100);
    expect(result.valoresPendentes).toBe(80);
    expect(result.quantidadeBaldes).toBe(5);
    expect(result.custoTotalBaldes).toBe(169);
    expect(result.lucroBruto).toBe(11);
    expect(result.lucroLiquido).toBe(-89);
  });

  it('keeps general light allocation at zero for an empty period', () => {
    const service = new FinancialCalculationService();
    expect(service.calculateLuzDoPeriodo([], ionicWorkingDayMonthlyExpenses, false, ionicToday)).toBe(0);
  });

  it('keeps general and client light allocations separate on Monday, Wednesday and Friday rules', () => {
    const service = new FinancialCalculationService();
    const general = service.calculateLuzDoPeriodo(
      ionicWorkingDayDeliveries,
      ionicWorkingDayMonthlyExpenses,
      false,
      ionicToday,
    );
    const client = service.calculateRateioLuzPorCliente(
      'Cliente Customizado',
      [ionicWorkingDayDeliveries[0]],
      ionicWorkingDayDeliveries,
      'dia',
      ionicWorkingDayExpenses,
      ionicWorkingDayMonthlyExpenses,
      'Todos',
    );
    const absentClient = service.calculateRateioLuzPorCliente(
      undefined,
      [],
      ionicWorkingDayDeliveries,
      'dia',
      ionicWorkingDayExpenses,
      ionicWorkingDayMonthlyExpenses,
      'Todos',
    );

    expect(general).toBeCloseTo(100 / 14, 8);
    expect(client).toBeCloseTo((100 / 14) * (2 / 5), 8);
    expect(absentClient).toBeNull();
    expect((client ?? 0) + (100 / 14) * (3 / 5)).toBeLessThanOrEqual(general + 0.0000001);
  });

  it('matches legacy fuel, gasoline and ethanol fixtures', () => {
    const service = new ExpenseCalculationService();
    expect(service.calculateFuelCost('2026-04-30', ionicWorkingDayExpenses['2026-04-30'])).toBe(180);
    expect(service.calculateFuelCost('2026-05-01', ionicWorkingDayExpenses['2026-05-01'])).toBeCloseTo(60, 8);
    expect(service.calculateFuelCost('2026-06-30', ionicWorkingDayExpenses['2026-06-30'])).toBeCloseTo((74 / 5.6) * 6, 8);
  });

  it('matches the monthly comparison based on working days', () => {
    const service = new FinancialCalculationService();
    const comparison = service.comparePeriods(ionicMonthlyComparisonFixture);

    expect(comparison.diasTrabalhados).toBe(11);
    expect(comparison.faturamento.atual).toBe(120);
    expect(comparison.faturamento.anterior).toBe(100);
    expect(comparison.faturamento.percentual).toBe(20);
    expect(comparison.lucroLiquido.atual).toBeCloseTo(85 - 100 / 14 * 11, 8);
    expect(comparison.lucroLiquido.anterior).toBeCloseTo(65 - 100 / 13 * 11, 8);
  });

  it('keeps zero quantity and invalid values financially safe', () => {
    const service = new FinancialCalculationService();
    const result = service.calculateResumo({
      ...ionicSummaryFixture,
      deliveries: [
        {
          ...ionicBucketAndPaymentsDeliveries[0],
          quantidade: 0,
          valor: 'valor inválido' as unknown as number,
        },
      ],
    });

    expect(result.faturamento).toBe(0);
    expect(result.quantidadeBaldes).toBe(0);
    expect(result.margemBruta).toBe(0);
    expect(result.margemLiquida).toBe(0);
  });
});
