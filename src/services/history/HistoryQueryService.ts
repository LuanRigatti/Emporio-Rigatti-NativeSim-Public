import type {
  Delivery,
  HistoryFilters,
  HistoryGroupingInput,
  HistoryMonthGroup,
} from '@/types/data';
import { financialCalculationService } from '@/services/finance/FinancialCalculationService';
import { formatClientName, normalizeClientKey, normalizeLegacyDate } from '@/utils/data';

function localDate(value: string): Date | undefined {
  const normalized = normalizeLegacyDate(value);
  if (!normalized) return undefined;
  const [year, month, day] = normalized.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function sameWeek(left: string, right: string): boolean {
  const leftDate = localDate(left);
  const rightDate = localDate(right);
  if (!leftDate || !rightDate) return false;
  leftDate.setDate(leftDate.getDate() - leftDate.getDay());
  rightDate.setDate(rightDate.getDate() - rightDate.getDay());
  return leftDate.toISOString().slice(0, 10) === rightDate.toISOString().slice(0, 10);
}

function matchesDate(delivery: Delivery, filters: HistoryFilters): boolean {
  const date = normalizeLegacyDate(delivery.data) ?? delivery.data;
  const selectedYear = filters.year && filters.year !== 'todos' ? filters.year : undefined;
  if (selectedYear && !date.startsWith(`${selectedYear}-`)) return false;

  switch (filters.period ?? 'month') {
    case 'all':
    case 'year':
      return true;
    case 'month':
      return Boolean(filters.month) && date.startsWith(filters.month ?? '');
    case 'day':
      return date === (filters.day ?? '');
    case 'week':
      return sameWeek(date, filters.day ?? '');
    case 'range':
      return date >= (filters.startDate ?? '') && date <= (filters.endDate ?? '');
    default:
      return true;
  }
}

export class HistoryQueryService {
  public filter(deliveries: Delivery[], filters: HistoryFilters = {}): Delivery[] {
    const search = normalizeClientKey(filters.search ?? '');
    const status = filters.status ?? 'Todos';

    return deliveries
      .filter((delivery) => matchesDate(delivery, filters))
      .filter((delivery) => {
        const name = normalizeClientKey(formatClientName(delivery.cliente));
        return !search || name.includes(search);
      })
      .filter((delivery) => status === 'Todos' || delivery.status === status)
      .sort(
        (left, right) =>
          (normalizeLegacyDate(right.data) ?? right.data).localeCompare(
            normalizeLegacyDate(left.data) ?? left.data,
          ) ||
          formatClientName(left.cliente).localeCompare(formatClientName(right.cliente), 'pt-BR'),
      );
  }

  public availableYears(deliveries: Delivery[], currentYear = new Date().getFullYear()): string[] {
    const years = new Set([String(currentYear), '2024']);
    deliveries.forEach((delivery) => {
      const date = normalizeLegacyDate(delivery.data);
      if (date) years.add(date.slice(0, 4));
    });
    return [...years].sort((left, right) => Number(right) - Number(left));
  }

  public group(deliveries: Delivery[], input: HistoryGroupingInput): HistoryMonthGroup[] {
    const monthMap = new Map<string, Map<string, Delivery[]>>();
    deliveries.forEach((delivery) => {
      const date = normalizeLegacyDate(delivery.data) ?? delivery.data;
      const month = date.slice(0, 7);
      const days = monthMap.get(month) ?? new Map<string, Delivery[]>();
      days.set(date, [...(days.get(date) ?? []), delivery]);
      monthMap.set(month, days);
    });

    return [...monthMap.entries()]
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([key, days]) => {
        const dayGroups = [...days.entries()]
          .sort(([left], [right]) => right.localeCompare(left))
          .map(([date, dayDeliveries]) => {
            const summary = financialCalculationService.calculateResumo({
              deliveries: dayDeliveries,
              dailyExpenses: input.dailyExpenses,
              monthlyExpenses: input.monthlyExpenses,
              filters: { periodo: 'dia', diaSelecionado: date },
            });
            return {
              key: date,
              date,
              deliveries: dayDeliveries,
              summary: {
                quantity: summary.quantidadeBaldes,
                deliveryCount: summary.quantidadeEntregas,
                fuelCostPerDelivery: summary.custoMedioCombustivelPorEntrega,
              },
            };
          });
        return {
          key,
          days: dayGroups,
          deliveryCount: dayGroups.reduce((total, day) => total + day.summary.deliveryCount, 0),
          quantity: dayGroups.reduce((total, day) => total + day.summary.quantity, 0),
        };
      });
  }
}

export const historyQueryService = new HistoryQueryService();
