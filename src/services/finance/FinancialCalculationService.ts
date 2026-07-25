import type {
  ClientFinancialRankingItem,
  DailyExpenses,
  Delivery,
  FinancialCalculationFilters,
  FinancialCalculationInput,
  FinancialComparison,
  FinancialComparisonResult,
  FinancialPeriod,
  FinancialSummary,
  MonthlyExpenses,
} from '@/types/data';
import {
  formatClientName,
  normalizeClientKey,
  normalizeLegacyDate,
  normalizeMoney,
} from '@/utils/data';
import { expenseCalculationService } from '@/services/expenses/ExpenseCalculationService';

function safeNumber(value: unknown): number {
  return normalizeMoney(value) ?? 0;
}

function isoDate(value: string): string {
  return normalizeLegacyDate(value) ?? value.trim();
}

function todayIso(today: Date): string {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function localDate(value: string): Date | undefined {
  const normalized = normalizeLegacyDate(value);
  if (!normalized) return undefined;
  const [year, month, day] = normalized.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function sameWeek(left: string, right: string): boolean {
  const leftDate = localDate(left);
  const rightDate = localDate(right);
  if (!leftDate || !rightDate) return false;
  leftDate.setDate(leftDate.getDate() - leftDate.getDay());
  rightDate.setDate(rightDate.getDate() - rightDate.getDay());
  return formatLocalDate(leftDate) === formatLocalDate(rightDate);
}

function endOfMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return formatLocalDate(new Date(year, monthNumber, 0, 12));
}

function startOfWeek(value: string): string {
  const date = localDate(value) ?? new Date();
  date.setDate(date.getDate() - date.getDay());
  return formatLocalDate(date);
}

function matchesPeriod(date: string, filters: FinancialCalculationFilters, today: Date): boolean {
  if (filters.periodo === 'todos') return true;
  if (filters.periodo === 'mes')
    return isoDate(date).startsWith(filters.mesSelecionado ?? todayIso(today).slice(0, 7));
  if (filters.periodo === 'dia')
    return isoDate(date) === isoDate(filters.diaSelecionado ?? todayIso(today));
  if (filters.periodo === 'semana') return sameWeek(date, filters.dataFiltro ?? todayIso(today));
  const normalized = isoDate(date);
  const start = filters.dataInicioSelecionada ?? '';
  const end = filters.dataFimSelecionada ?? '';
  return normalized >= start && normalized <= end;
}

function withoutClient(filters: FinancialCalculationFilters): FinancialCalculationFilters {
  return { ...filters, buscaCliente: undefined };
}

function comparisonPercentage(current: number, previous: number, useAbsoluteBase: boolean): number {
  const base = useAbsoluteBase ? Math.abs(previous) : previous;
  return base !== 0 ? ((current - previous) / base) * 100 : current !== 0 ? 100 : 0;
}

function comparison(
  current: number,
  previous: number,
  useAbsoluteBase = false,
): FinancialComparison {
  const difference = current - previous;
  return {
    atual: current,
    anterior: previous,
    diferenca: difference,
    percentual: comparisonPercentage(current, previous, useAbsoluteBase),
    subiu: difference >= 0,
  };
}

export class FinancialCalculationService {
  public filterDeliveries(
    deliveries: Delivery[],
    filters: FinancialCalculationFilters,
    today = new Date(),
  ): Delivery[] {
    const search = normalizeClientKey(filters.buscaCliente ?? '');
    return deliveries.filter((delivery) => {
      const name = formatClientName(delivery.cliente);
      return (
        (!search || normalizeClientKey(name).includes(search)) &&
        (!filters.status || filters.status === 'Todos' || delivery.status === filters.status) &&
        matchesPeriod(delivery.data, filters, today)
      );
    });
  }

  public calculateFaturamento(deliveries: Delivery[]): number {
    return deliveries.reduce((total, delivery) => total + safeNumber(delivery.valor), 0);
  }

  public calculatePago(deliveries: Delivery[]): number {
    return deliveries.reduce(
      (total, delivery) =>
        delivery.status === 'Pago' ? total + safeNumber(delivery.valor) : total,
      0,
    );
  }

  public calculatePendente(deliveries: Delivery[]): number {
    return deliveries.reduce(
      (total, delivery) =>
        delivery.status !== 'Pago' ? total + safeNumber(delivery.valor) : total,
      0,
    );
  }

  public calculateQuantidade(deliveries: Delivery[]): number {
    return deliveries.reduce((total, delivery) => total + safeNumber(delivery.quantidade), 0);
  }

  public calculateCustoTotalBaldes(deliveries: Delivery[]): number {
    return deliveries.reduce(
      (total, delivery) =>
        total +
        safeNumber(delivery.quantidade) *
          expenseCalculationService.calculateBucketCost(delivery.data),
      0,
    );
  }

  public calculateCombustivel(date: string, expense: DailyExpenses[string] | undefined): number {
    return expenseCalculationService.calculateFuelCost(date, expense);
  }

  public calculateEstar(
    dailyExpenses: DailyExpenses,
    filters: FinancialCalculationFilters,
    today = new Date(),
  ): number {
    return Object.keys(dailyExpenses)
      .filter((date) => matchesPeriod(date, filters, today))
      .reduce((total, date) => total + safeNumber(dailyExpenses[date]?.estar), 0);
  }

  public calculateLucroBruto(faturamento: number, custoTotalBaldes: number): number {
    return faturamento - custoTotalBaldes;
  }

  public calculateLucroLiquido(
    lucroBruto: number,
    custoEstar: number,
    custoCombustivel: number,
    custoLuz: number,
  ): number {
    return lucroBruto - custoEstar - custoCombustivel - custoLuz;
  }

  public calculateMargemBruta(lucroBruto: number, faturamento: number): number {
    return faturamento > 0 ? (lucroBruto / faturamento) * 100 : 0;
  }

  public calculateMargemLiquida(lucroLiquido: number, faturamento: number): number {
    return faturamento > 0 ? (lucroLiquido / faturamento) * 100 : 0;
  }

  public calculateCustoMedioBalde(
    custoTotalBaldes: number,
    custoEstar: number,
    custoCombustivel: number,
    custoLuz: number,
    quantidadeBaldes: number,
  ): number {
    const custoCompleto = custoTotalBaldes + custoEstar + custoCombustivel + custoLuz;
    return quantidadeBaldes > 0 ? custoCompleto / quantidadeBaldes : 0;
  }

  public calculatePrecoMedioBalde(faturamento: number, quantidadeBaldes: number): number {
    return quantidadeBaldes > 0 ? faturamento / quantidadeBaldes : 0;
  }

  public calculateLucroLiquidoPorBalde(lucroLiquido: number, quantidadeBaldes: number): number {
    return quantidadeBaldes > 0 ? lucroLiquido / quantidadeBaldes : 0;
  }

  public calculateLuzDoPeriodo(
    deliveries: Delivery[],
    monthlyExpenses: MonthlyExpenses,
    allPeriod = false,
    today = new Date(),
  ): number {
    return expenseCalculationService.calculateLightForPeriod(
      deliveries,
      monthlyExpenses,
      allPeriod,
      today,
    );
  }

  public calculateRateioLuzPorCliente(
    clientName: string | undefined,
    clientDeliveries: Delivery[],
    periodDeliveries: Delivery[],
    period: Extract<FinancialPeriod, 'dia' | 'semana' | 'mes'>,
    dailyExpenses: DailyExpenses,
    monthlyExpenses: MonthlyExpenses,
    status: string | undefined,
  ): number | null {
    if (!clientName?.trim()) return null;
    if (clientDeliveries.length === 0) return 0;
    return expenseCalculationService.calculateClientAllocation(
      clientDeliveries,
      periodDeliveries,
      period === 'dia' ? 'day' : period === 'semana' ? 'week' : 'month',
      dailyExpenses,
      monthlyExpenses,
      status === 'Pago' || status === 'Não Pago' ? status : 'Todos',
    ).luz;
  }

  public calculateResumo(input: FinancialCalculationInput): FinancialSummary {
    const today = input.today ?? new Date();
    const filtered = this.filterDeliveries(input.deliveries, input.filters, today);
    const periodDeliveries = this.filterDeliveries(
      input.deliveries,
      withoutClient(input.filters),
      today,
    );
    const dailyDates = Object.keys(input.dailyExpenses).filter((date) =>
      matchesPeriod(date, input.filters, today),
    );
    let custoEstar = this.calculateEstar(input.dailyExpenses, input.filters, today);
    let custoCombustivel = dailyDates.reduce(
      (total, date) =>
        total + expenseCalculationService.calculateFuelCost(date, input.dailyExpenses[date]),
      0,
    );
    let custoLuz =
      input.fullLightInterval && input.filters.periodo === 'range'
        ? periodDeliveries.length > 0 &&
          input.filters.dataInicioSelecionada &&
          input.filters.dataFimSelecionada
          ? expenseCalculationService.calculateLightForInterval(
              input.filters.dataInicioSelecionada,
              input.filters.dataFimSelecionada,
              input.monthlyExpenses,
              today,
            )
          : 0
        : this.calculateLuzDoPeriodo(
            periodDeliveries,
            input.monthlyExpenses,
            input.filters.periodo === 'todos',
            today,
          );

    if (input.filters.buscaCliente?.trim()) {
      const allocation = expenseCalculationService.calculateClientAllocation(
        filtered,
        periodDeliveries,
        input.filters.periodo === 'dia'
          ? 'day'
          : input.filters.periodo === 'semana'
            ? 'week'
            : 'month',
        input.dailyExpenses,
        input.monthlyExpenses,
        input.filters.status === 'Pago' || input.filters.status === 'Não Pago'
          ? input.filters.status
          : 'Todos',
      );
      custoEstar = allocation.estar;
      custoCombustivel = allocation.combustivel;
      custoLuz = allocation.luz;
    }

    const faturamento = this.calculateFaturamento(filtered);
    const valoresPagos = this.calculatePago(filtered);
    const valoresPendentes = this.calculatePendente(filtered);
    const quantidadeBaldes = this.calculateQuantidade(filtered);
    const custoTotalBaldes = this.calculateCustoTotalBaldes(filtered);
    const lucroBruto = this.calculateLucroBruto(faturamento, custoTotalBaldes);
    const lucroLiquido = this.calculateLucroLiquido(
      lucroBruto,
      custoEstar,
      custoCombustivel,
      custoLuz,
    );
    const custoTotal = custoTotalBaldes + custoEstar + custoCombustivel + custoLuz;
    return {
      faturamento,
      valoresPagos,
      valoresPendentes,
      quantidadeBaldes,
      custoTotalBaldes,
      custoCombustivel,
      custoEstar,
      custoLuz,
      custoTotal,
      lucroBruto,
      lucroLiquido,
      margemBruta: this.calculateMargemBruta(lucroBruto, faturamento),
      margemLiquida: this.calculateMargemLiquida(lucroLiquido, faturamento),
      custoMedioBalde: this.calculateCustoMedioBalde(
        custoTotalBaldes,
        custoEstar,
        custoCombustivel,
        custoLuz,
        quantidadeBaldes,
      ),
      precoMedioBalde: this.calculatePrecoMedioBalde(faturamento, quantidadeBaldes),
      lucroLiquidoPorBalde: this.calculateLucroLiquidoPorBalde(lucroLiquido, quantidadeBaldes),
      quantidadeEntregas: filtered.length,
      custoMedioCombustivelPorEntrega: expenseCalculationService.calculateFuelCostPerPeriod(
        filtered,
        input.dailyExpenses,
      ),
    };
  }

  public rankClients(
    deliveries: Delivery[],
    filters: FinancialCalculationFilters,
    today = new Date(),
  ): ClientFinancialRankingItem[] {
    const grouped = new Map<string, ClientFinancialRankingItem>();
    this.filterDeliveries(deliveries, filters, today).forEach((delivery) => {
      const name = formatClientName(delivery.cliente);
      const key = normalizeClientKey(name);
      const item = grouped.get(key) ?? {
        nome: name,
        valor: 0,
        quantidade: 0,
        entregas: 0,
        percentual: 0,
      };
      item.valor += safeNumber(delivery.valor);
      item.quantidade += safeNumber(delivery.quantidade);
      item.entregas += 1;
      grouped.set(key, item);
    });
    const ranking = [...grouped.values()].sort(
      (left, right) =>
        right.valor - left.valor ||
        right.quantidade - left.quantidade ||
        left.nome.localeCompare(right.nome, 'pt-BR'),
    );
    const largestValue = Math.max(...ranking.map((item) => item.valor), 1);
    return ranking.map((item) => ({
      ...item,
      percentual: Math.max(4, Math.min(100, (item.valor / largestValue) * 100)),
    }));
  }

  public groupDeliveries(
    deliveries: Delivery[],
    grouping: 'day' | 'week' | 'month' | 'year',
  ): Map<string, Delivery[]> {
    const grouped = new Map<string, Delivery[]>();
    deliveries.forEach((delivery) => {
      const date = isoDate(delivery.data);
      const key =
        grouping === 'day'
          ? date
          : grouping === 'month'
            ? date.slice(0, 7)
            : grouping === 'year'
              ? date.slice(0, 4)
              : startOfWeek(date);
      grouped.set(key, [...(grouped.get(key) ?? []), delivery]);
    });
    return grouped;
  }

  public comparePeriods(input: FinancialCalculationInput): FinancialComparisonResult {
    const today = input.today ?? new Date();
    const currentRange = this.comparisonRanges(input.filters, today);
    const currentFilters: FinancialCalculationFilters = {
      ...input.filters,
      periodo: 'range',
      dataInicioSelecionada: currentRange.start,
      dataFimSelecionada: currentRange.end,
    };
    const previousFilters: FinancialCalculationFilters = {
      ...input.filters,
      periodo: 'range',
      dataInicioSelecionada: currentRange.previousStart,
      dataFimSelecionada: currentRange.previousEnd,
    };
    const current = this.calculateResumo({
      ...input,
      filters: currentFilters,
      fullLightInterval: true,
      today,
    });
    const previous = this.calculateResumo({
      ...input,
      filters: previousFilters,
      fullLightInterval: true,
      today,
    });
    return {
      inicioAtual: currentRange.start,
      fimAtual: currentRange.end,
      inicioAnterior: currentRange.previousStart,
      fimAnterior: currentRange.previousEnd,
      diasTrabalhados: currentRange.workingDays,
      faturamento: comparison(current.faturamento, previous.faturamento),
      quantidadeEntregas: comparison(current.quantidadeEntregas, previous.quantidadeEntregas),
      lucroLiquido: comparison(current.lucroLiquido, previous.lucroLiquido, true),
    };
  }

  private comparisonRanges(
    filters: FinancialCalculationFilters,
    today: Date,
  ): {
    start: string;
    end: string;
    previousStart: string;
    previousEnd: string;
    workingDays: number;
  } {
    const selectedMonth = filters.mesSelecionado ?? todayIso(today).slice(0, 7);
    const currentMonthDate = localDate(`${selectedMonth}-01`) ?? today;
    const isCurrentMonth = selectedMonth === todayIso(today).slice(0, 7);
    const currentEnd = isCurrentMonth ? todayIso(today) : endOfMonth(selectedMonth);
    const currentStart = `${selectedMonth}-01`;
    const currentStartDate = localDate(currentStart) ?? today;
    const currentEndDate = localDate(currentEnd) ?? today;
    let workingDays = 0;
    const cursor = new Date(currentStartDate);
    while (cursor <= currentEndDate) {
      if ([1, 3, 5].includes(cursor.getDay())) workingDays += 1;
      cursor.setDate(cursor.getDate() + 1);
    }
    const previousMonth = new Date(
      currentMonthDate.getFullYear(),
      currentMonthDate.getMonth() - 1,
      1,
      12,
    );
    let previousWorkingDays = 0;
    let previousEndDay = 0;
    const lastPreviousDay = new Date(
      previousMonth.getFullYear(),
      previousMonth.getMonth() + 1,
      0,
    ).getDate();
    for (let day = 1; day <= lastPreviousDay; day += 1) {
      const candidate = new Date(previousMonth.getFullYear(), previousMonth.getMonth(), day, 12);
      if ([1, 3, 5].includes(candidate.getDay())) {
        previousWorkingDays += 1;
        if (previousWorkingDays <= workingDays) previousEndDay = day;
      }
    }
    const previousStart = formatLocalDate(previousMonth);
    const previousEnd = formatLocalDate(
      new Date(previousMonth.getFullYear(), previousMonth.getMonth(), previousEndDay, 12),
    );
    return { start: currentStart, end: currentEnd, previousStart, previousEnd, workingDays };
  }
}

export const financialCalculationService = new FinancialCalculationService();
