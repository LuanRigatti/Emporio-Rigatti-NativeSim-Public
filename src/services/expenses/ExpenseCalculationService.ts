import type {
  ClientExpenseAllocation,
  DailyExpenses,
  Delivery,
  ExpensePeriod,
  ExpenseSummary,
  MonthlyExpenses,
} from '@/types/data';
import { normalizeLegacyDate, normalizeMoney } from '@/utils/data';

export const EXPENSE_CUTOFFS = {
  bucketCost: '2026-03-20',
  currentFuelModel: '2026-05-01',
  fuelAverageChange: '2026-06-30',
} as const;

export const EXPENSE_DEFAULTS = {
  bucketCostBeforeCutoff: 32,
  bucketCostFromCutoff: 35,
  ethanolKmPerLiter: 5.6,
  gasolineKmPerLiter: 7.4,
} as const;

function safeNumber(value: unknown): number {
  return normalizeMoney(value) ?? 0;
}

function isoDate(value: string): string {
  return normalizeLegacyDate(value) ?? value.trim();
}

function monthOf(value: string): string {
  return isoDate(value).slice(0, 7);
}

function parseLocalDate(value: string): Date | undefined {
  const normalized = normalizeLegacyDate(value);
  if (!normalized) return undefined;
  const [year, month, day] = normalized.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function daysInMonth(month: string): number {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(year, monthNumber, 0).getDate();
}

function weekOfMonth(date: string): number {
  const day = Number(isoDate(date).split('-')[2] ?? 1);
  return Math.ceil(day / 7);
}

function weekKey(date: string): string {
  return `${monthOf(date)}-S${weekOfMonth(date)}`;
}

function periodMatches(date: string, period: ExpensePeriod, key: string): boolean {
  if (period === 'day') return isoDate(date) === isoDate(key);
  if (period === 'week') return weekKey(date) === key;
  return monthOf(date) === key;
}

function dailyExpenseDates(
  expenses: DailyExpenses,
  startDate?: string,
  endDate?: string,
): string[] {
  const start = startDate ? isoDate(startDate) : undefined;
  const end = endDate ? isoDate(endDate) : undefined;
  return Object.keys(expenses).filter((date) => {
    const normalized = isoDate(date);
    return (!start || normalized >= start) && (!end || normalized <= end);
  });
}

export class ExpenseCalculationService {
  public calculateFuelCost(date: string, expense?: DailyExpenses[string]): number {
    if (!expense) return 0;
    const normalizedDate = isoDate(date);
    if (normalizedDate >= EXPENSE_CUTOFFS.currentFuelModel) {
      const kilometers = safeNumber(expense.km);
      const fuelPrice = safeNumber(expense.precoGasolina);
      if (kilometers <= 0 || fuelPrice <= 0) return 0;

      let average: number = EXPENSE_DEFAULTS.gasolineKmPerLiter;
      if (expense.tipoCombustivel) {
        average =
          expense.tipoCombustivel === 'etanol'
            ? EXPENSE_DEFAULTS.ethanolKmPerLiter
            : EXPENSE_DEFAULTS.gasolineKmPerLiter;
      } else if (normalizedDate <= EXPENSE_CUTOFFS.fuelAverageChange) {
        average = EXPENSE_DEFAULTS.ethanolKmPerLiter;
      }
      return (kilometers / average) * fuelPrice;
    }
    return safeNumber(expense.gasolina);
  }

  public calculateFuelCostForMonth(month: string, expenses: DailyExpenses): number {
    return Object.entries(expenses).reduce(
      (total, [date, expense]) =>
        monthOf(date) === month ? total + this.calculateFuelCost(date, expense) : total,
      0,
    );
  }

  public calculateFuelCostPerDelivery(
    date: string,
    deliveries: Delivery[],
    expenses: DailyExpenses,
  ): number {
    const normalizedDate = isoDate(date);
    if (normalizedDate < EXPENSE_CUTOFFS.currentFuelModel) return 0;
    const count = deliveries.filter((delivery) => isoDate(delivery.data) === normalizedDate).length;
    return count > 0
      ? this.calculateFuelCost(normalizedDate, expenses[date] ?? expenses[normalizedDate]) / count
      : 0;
  }

  public calculateFuelCostPerPeriod(deliveries: Delivery[], expenses: DailyExpenses): number {
    const eligibleDates = new Set(
      deliveries
        .filter((delivery) => isoDate(delivery.data) >= EXPENSE_CUTOFFS.currentFuelModel)
        .map((delivery) => isoDate(delivery.data)),
    );
    let totalFuel = 0;
    let totalDeliveries = 0;
    eligibleDates.forEach((date) => {
      const deliveriesOnDate = deliveries.filter(
        (delivery) => isoDate(delivery.data) === date,
      ).length;
      if (deliveriesOnDate === 0) return;
      totalFuel += this.calculateFuelCost(date, expenses[date]);
      totalDeliveries += deliveriesOnDate;
    });
    return totalDeliveries > 0 ? totalFuel / totalDeliveries : 0;
  }

  public calculateEstarForGroup(
    type: Extract<ExpensePeriod, 'day' | 'week' | 'month'>,
    key: string,
    expenses: DailyExpenses,
  ): number {
    return Object.entries(expenses).reduce(
      (total, [date, expense]) =>
        periodMatches(date, type, key) ? total + safeNumber(expense.estar) : total,
      0,
    );
  }

  public normalizeMonth(value: string, today = new Date()): string {
    const match = /^\d{4}-\d{2}/.exec(String(value ?? ''));
    if (match) return match[0];
    return today.toISOString().slice(0, 7);
  }

  public calculateMonthlyLight(
    monthValue: string,
    monthlyExpenses: MonthlyExpenses,
    today = new Date(),
  ): number {
    const month = this.normalizeMonth(monthValue, today);
    const record = monthlyExpenses[month];
    const saved = typeof record === 'number' ? record : record?.luz;
    if (saved === undefined || saved === null) return 0;
    return Math.max(0, safeNumber(saved));
  }

  public countWorkingDays(year: number, monthZeroIndexed: number): number {
    const lastDay = new Date(year, monthZeroIndexed + 1, 0).getDate();
    let count = 0;
    for (let day = 1; day <= lastDay; day += 1) {
      const weekday = new Date(year, monthZeroIndexed, day).getDay();
      if (weekday === 1 || weekday === 3 || weekday === 5) count += 1;
    }
    return count;
  }

  public calculateLightForInterval(
    startValue: string,
    endValue: string,
    monthlyExpenses: MonthlyExpenses,
    today = new Date(),
  ): number {
    const start = parseLocalDate(startValue);
    const end = parseLocalDate(endValue);
    if (!start || !end || start > end) return 0;

    const daysByMonth: Record<string, number> = {};
    const current = new Date(start);
    while (current <= end) {
      const weekday = current.getDay();
      if (weekday === 1 || weekday === 3 || weekday === 5) {
        const month = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
        daysByMonth[month] = (daysByMonth[month] ?? 0) + 1;
      }
      current.setDate(current.getDate() + 1);
    }

    return Object.entries(daysByMonth).reduce((total, [month, selectedDays]) => {
      const [year, monthNumber] = month.split('-').map(Number);
      const totalWorkingDays = this.countWorkingDays(year, monthNumber - 1);
      const light = this.calculateMonthlyLight(month, monthlyExpenses, today);
      return total + (totalWorkingDays > 0 ? light * (selectedDays / totalWorkingDays) : light);
    }, 0);
  }

  public calculateLightForDeliveryDays(
    deliveries: Delivery[],
    monthlyExpenses: MonthlyExpenses,
    today = new Date(),
  ): number {
    const deliveryDatesByMonth = new Map<string, Set<string>>();

    deliveries.forEach((delivery) => {
      const date = normalizeLegacyDate(delivery.data);
      if (!date) return;

      const parsed = parseLocalDate(date);
      if (!parsed || ![1, 3, 5].includes(parsed.getDay())) return;

      const month = date.slice(0, 7);
      const dates = deliveryDatesByMonth.get(month) ?? new Set<string>();
      dates.add(date);
      deliveryDatesByMonth.set(month, dates);
    });

    return Array.from(deliveryDatesByMonth.entries()).reduce((total, [month, dates]) => {
      const [year, monthNumber] = month.split('-').map(Number);
      const workingDays = this.countWorkingDays(year, monthNumber - 1);
      if (workingDays === 0) return total;

      return (
        total +
        (this.calculateMonthlyLight(month, monthlyExpenses, today) * dates.size) / workingDays
      );
    }, 0);
  }

  public calculateLightForPeriod(
    deliveries: Delivery[],
    monthlyExpenses: MonthlyExpenses,
    allPeriod = false,
    today = new Date(),
  ): number {
    if (deliveries.length === 0) return 0;
    if (allPeriod) {
      return Array.from(new Set(deliveries.map((delivery) => monthOf(delivery.data)))).reduce(
        (total, month) => total + this.calculateMonthlyLight(month, monthlyExpenses, today),
        0,
      );
    }
    const dates = deliveries.map((delivery) => isoDate(delivery.data)).sort();
    return this.calculateLightForInterval(
      dates[0],
      dates[dates.length - 1],
      monthlyExpenses,
      today,
    );
  }

  public calculateBucketCost(date: string): number {
    const normalizedDate = isoDate(date);
    return normalizedDate.length > 0 && normalizedDate < EXPENSE_CUTOFFS.bucketCost
      ? EXPENSE_DEFAULTS.bucketCostBeforeCutoff
      : EXPENSE_DEFAULTS.bucketCostFromCutoff;
  }

  public calculateSummary(
    startDate: string,
    endDate: string,
    expenses: DailyExpenses,
    monthlyExpenses: MonthlyExpenses,
    deliveries: Delivery[],
    today = new Date(),
  ): ExpenseSummary {
    const dates = dailyExpenseDates(expenses, startDate, endDate);
    const estar = dates.reduce((total, date) => total + safeNumber(expenses[date]?.estar), 0);
    const outros = dates.reduce((total, date) => total + safeNumber(expenses[date]?.outros), 0);
    const combustivel = dates.reduce(
      (total, date) => total + this.calculateFuelCost(date, expenses[date]),
      0,
    );
    const periodDeliveries =
      startDate === '0000-01-01'
        ? deliveries
        : deliveries.filter((delivery) => {
            const date = isoDate(delivery.data);
            return date >= startDate && date <= endDate;
          });
    const luz = this.calculateLightForPeriod(
      periodDeliveries,
      monthlyExpenses,
      startDate === '0000-01-01',
      today,
    );
    return {
      estar,
      combustivel,
      outros,
      luz,
      total: estar + combustivel + outros + luz,
      custoMedioCombustivelPorEntrega: this.calculateFuelCostPerPeriod(periodDeliveries, expenses),
    };
  }

  public calculateClientAllocation(
    clientDeliveries: Delivery[],
    allDeliveries: Delivery[],
    period: Extract<ExpensePeriod, 'day' | 'week' | 'month'>,
    expenses: DailyExpenses,
    monthlyExpenses: MonthlyExpenses,
    status: 'Todos' | 'Pago' | 'Não Pago' = 'Todos',
  ): ClientExpenseAllocation {
    const filteredDeliveries = allDeliveries.filter(
      (delivery) => status === 'Todos' || delivery.status === status,
    );
    const groups = new Map<
      string,
      { type: typeof period; key: string; referenceDate: string; clientBuckets: number }
    >();
    clientDeliveries.forEach((delivery) => {
      const key =
        period === 'day'
          ? isoDate(delivery.data)
          : period === 'week'
            ? weekKey(delivery.data)
            : monthOf(delivery.data);
      const current = groups.get(key) ?? {
        type: period,
        key,
        referenceDate: delivery.data,
        clientBuckets: 0,
      };
      current.clientBuckets += safeNumber(delivery.quantidade);
      groups.set(key, current);
    });

    let estar = 0;
    let combustivel = 0;
    let luz = 0;
    groups.forEach((group) => {
      const totalBuckets = filteredDeliveries
        .filter((delivery) => periodMatches(delivery.data, group.type, group.key))
        .reduce((total, delivery) => total + safeNumber(delivery.quantidade), 0);
      if (totalBuckets <= 0) return;
      const proportion = group.clientBuckets / totalBuckets;
      estar += this.calculateEstarForGroup(group.type, group.key, expenses) * proportion;
      const month = monthOf(group.referenceDate);
      const monthlyFuel = this.calculateFuelCostForMonth(month, expenses);
      const fuelBase =
        group.type === 'day'
          ? monthlyFuel / daysInMonth(month)
          : group.type === 'week'
            ? monthlyFuel / Math.ceil(daysInMonth(month) / 7)
            : this.calculateFuelCostForMonth(group.key, expenses);
      combustivel += fuelBase * proportion;
    });

    const clientBucketsByDay = new Map<string, number>();
    clientDeliveries.forEach((delivery) => {
      const key = isoDate(delivery.data);
      clientBucketsByDay.set(
        key,
        (clientBucketsByDay.get(key) ?? 0) + safeNumber(delivery.quantidade),
      );
    });
    clientBucketsByDay.forEach((clientBuckets, date) => {
      const totalBuckets = filteredDeliveries
        .filter((delivery) => isoDate(delivery.data) === date)
        .reduce((total, delivery) => total + safeNumber(delivery.quantidade), 0);
      if (totalBuckets <= 0) return;
      const parsed = parseLocalDate(date);
      if (!parsed) return;
      const workingDays = this.countWorkingDays(parsed.getFullYear(), parsed.getMonth());
      const lightPerWorkingDay =
        workingDays > 0
          ? this.calculateMonthlyLight(monthOf(date), monthlyExpenses) / workingDays
          : 0;
      luz += lightPerWorkingDay * (clientBuckets / totalBuckets);
    });

    return { estar, combustivel, luz };
  }
}

export const expenseCalculationService = new ExpenseCalculationService();
