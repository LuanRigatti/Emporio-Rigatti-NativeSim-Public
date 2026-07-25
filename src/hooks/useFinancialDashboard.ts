import { useMemo } from 'react';

import { deliveryQueryService } from '@/services/deliveries';
import { financialCalculationService } from '@/services/finance';
import { factoryCalculationService } from '@/services/finance/FactoryCalculationService';
import type { FinancialCalculationFilters } from '@/types/data';

import { useFinancialData } from './useFinancialData';
import { financialFiltersForPeriod } from './useFinancialReport';

function todayIso(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

export function useFinancialDashboard() {
  const data = useFinancialData();
  const date = useMemo(() => todayIso(), []);
  const computed = useMemo(() => {
    if (!data.snapshot) return undefined;

    const dayFilters: FinancialCalculationFilters = financialFiltersForPeriod('day', date);
    const monthFilters: FinancialCalculationFilters = financialFiltersForPeriod('month', date);
    const dayInput = {
      deliveries: data.snapshot.entregas,
      dailyExpenses: data.snapshot.gastosDiarios,
      monthlyExpenses: data.snapshot.gastosMensais,
      filters: dayFilters,
      today: new Date(),
    };
    const monthInput = { ...dayInput, filters: monthFilters };
    const dayDeliveries = financialCalculationService.filterDeliveries(
      data.snapshot.entregas,
      dayFilters,
    );
    const monthDeliveries = financialCalculationService.filterDeliveries(
      data.snapshot.entregas,
      monthFilters,
    );
    const pendingPayments = monthDeliveries.filter(
      (delivery) => delivery.status === 'Não Pago' && delivery.entregue,
    );
    const recentDeliveries = deliveryQueryService
      .filter(data.snapshot.entregas, { mode: 'all' })
      .slice(0, 5);
    const incompleteToday = dayDeliveries.filter((delivery) => !delivery.entregue);

    return {
      daySummary: financialCalculationService.calculateResumo(dayInput),
      monthSummary: financialCalculationService.calculateResumo(monthInput),
      monthComparison: financialCalculationService.comparePeriods(monthInput),
      monthDeliveries,
      dayDeliveries,
      recentDeliveries,
      pendingPayments,
      incompleteToday,
      ranking: financialCalculationService.rankClients(data.snapshot.entregas, monthFilters),
      factorySummary: factoryCalculationService.summarize(data.snapshot.recebimentoBaldes),
    };
  }, [data.snapshot, date]);

  return { ...data, date, ...computed };
}

export type FinancialDashboard = ReturnType<typeof useFinancialDashboard>;
