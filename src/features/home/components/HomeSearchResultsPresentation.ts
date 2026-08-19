import type {
  HomeSearchCarSettingResult,
  HomeSearchFactorySummaryResult,
  HomeSearchFinancialMetricResult,
  HomeSearchPeriod,
  HomeSearchPeriodSummaryResult,
  HomeSearchResponse,
  HomeSearchResult,
  HomeSearchRouteSummaryResult,
} from '../search/HomeSearchTypes';
import { homeSearchFinancialMetricDefinition } from '../search/HomeSearchFinancialMetrics';

export type HomeSearchResultsPresentation = {
  empty: boolean;
  details?: string[];
  period?: string;
  primaryTitle?: string;
  quantity?: number;
  query: string;
  relatedCount?: string;
  typeLabel?: string;
};

const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

function plural(count: number, singular: string, pluralValue: string): string {
  return count === 1 ? singular : pluralValue;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatPeriod(period: HomeSearchPeriod): string {
  if (period.kind === 'date') {
    const [year, month, day] = period.date.split('-').map(Number);
    return `${day} de ${MONTH_NAMES[month - 1]} de ${year}`;
  }

  if (period.kind === 'dayMonth') {
    return `${period.day} de ${MONTH_NAMES[period.month - 1]}`;
  }

  if (period.kind === 'month') {
    const month = capitalize(MONTH_NAMES[period.month - 1]);
    return period.year ? `${month} de ${period.year}` : month;
  }

  if (period.kind === 'range') {
    if (period.label) return period.label;
    const [startYear, startMonth, startDay] = period.startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = period.endDate.split('-').map(Number);
    if (startYear === endYear && startMonth === endMonth) {
      return `${startDay} a ${endDay} de ${MONTH_NAMES[startMonth - 1]} de ${startYear}`;
    }
    if (startYear === endYear) {
      return `${startDay} de ${MONTH_NAMES[startMonth - 1]} a ${endDay} de ${MONTH_NAMES[endMonth - 1]} de ${startYear}`;
    }
    return `${startDay} de ${MONTH_NAMES[startMonth - 1]} de ${startYear} a ${endDay} de ${MONTH_NAMES[endMonth - 1]} de ${endYear}`;
  }

  return String(period.year);
}

function resultDetails(
  response: HomeSearchResponse,
  primary: HomeSearchResult,
): Pick<HomeSearchResultsPresentation, 'primaryTitle' | 'quantity' | 'relatedCount' | 'typeLabel'> {
  if (primary.type === 'financialMetric') {
    return financialDetails(primary);
  }
  if (primary.type === 'factorySummary') return factoryDetails(primary);
  if (primary.type === 'routeSummary') return routeDetails(primary);
  if (primary.type === 'carSetting') return carDetails(primary);
  if (primary.type === 'periodSummary') return summaryDetails(primary);

  if (primary.type === 'client') {
    if (primary.data.matchedField) {
      return {
        primaryTitle: primary.title,
        relatedCount: formatClientField(primary.data.matchedField),
        typeLabel: clientFieldLabel(primary.data.matchedField.field),
      };
    }
    const count = primary.data.aggregation.deliveryCount;
    return {
      primaryTitle: primary.title,
      quantity: primary.data.aggregation.quantity,
      relatedCount: `${count} ${plural(count, 'entrega relacionada', 'entregas relacionadas')}`,
      typeLabel: 'Cliente',
    };
  }

  if (primary.type === 'delivery') {
    const count = response.counts.delivery;
    return {
      primaryTitle: primary.title,
      quantity: primary.data.quantity,
      relatedCount: `${count} ${plural(count, 'entrega encontrada', 'entregas encontradas')}`,
      typeLabel: 'Entrega',
    };
  }

  const count = response.counts.factoryPurchase;
  return {
    primaryTitle: primary.title,
    quantity: primary.data.quantity,
    relatedCount: `${count} ${plural(count, 'compra encontrada', 'compras encontradas')}`,
    typeLabel: 'Compra da fábrica',
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    currency: 'BRL',
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(value);
}

function formatRouteTime(timestamp: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeStyle: 'short',
  }).format(timestamp);
}

function formatRouteDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, '0')} min`;
  return `${minutes} min ${String(remainingSeconds).padStart(2, '0')} s`;
}

function formatRouteDistance(distanceKm: number): string {
  return `${distanceKm.toLocaleString('pt-BR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} km`;
}

function formatCompactRouteDistance(distanceKm: number): string {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(distanceKm)} km`;
}

function clientFieldLabel(
  field: NonNullable<
    Extract<HomeSearchResult, { type: 'client' }>['data']['matchedField']
  >['field'],
): string {
  if (field === 'currentPrice') return 'Valor do balde';
  if (field === 'address') return 'Endereço';
  if (field === 'usesInvoice') return 'Nota fiscal';
  return 'Boleto';
}

function formatClientField(
  field: NonNullable<Extract<HomeSearchResult, { type: 'client' }>['data']['matchedField']>,
): string {
  if (!field.available) return 'Não informado';
  if (field.unit === 'currency') return formatCurrency(Number(field.value));
  if (field.unit === 'boolean') return field.value ? 'Sim' : 'Não';
  return String(field.value ?? '');
}

function factoryDetails(
  result: HomeSearchFactorySummaryResult,
): Pick<HomeSearchResultsPresentation, 'primaryTitle' | 'relatedCount' | 'typeLabel'> {
  if (!result.data.available) {
    return {
      primaryTitle: 'Fábrica',
      relatedCount: 'Não suportado',
      typeLabel: 'Filtro por data do pagamento',
    };
  }
  const aggregate = result.data.aggregate!;
  const primaryTitle = result.data.period ? formatPeriod(result.data.period) : 'Fábrica';
  if (result.data.metric === 'bucketsPurchased') {
    return {
      primaryTitle,
      relatedCount: `${aggregate.totalBuckets} baldes comprados`,
      typeLabel: 'Fábrica',
    };
  }
  if (result.data.metric === 'purchaseValue') {
    return {
      primaryTitle,
      relatedCount: formatCurrency(aggregate.totalValue),
      typeLabel: 'Valor comprado',
    };
  }
  if (result.data.metric === 'paidValue') {
    return {
      primaryTitle,
      relatedCount: formatCurrency(aggregate.totalPaid),
      typeLabel: 'Pago',
    };
  }
  if (result.data.metric === 'openValue') {
    return {
      primaryTitle,
      relatedCount: formatCurrency(aggregate.openValue),
      typeLabel: 'A pagar',
    };
  }
  if (result.data.metric === 'payments') {
    return {
      primaryTitle,
      relatedCount: `${aggregate.paymentCount} ${plural(aggregate.paymentCount, 'pagamento', 'pagamentos')} · ${formatCurrency(aggregate.totalPaid)}`,
      typeLabel: result.data.status === 'partial' ? 'Pagamentos parciais' : 'Pagamentos',
    };
  }
  return {
    primaryTitle,
    relatedCount: `${aggregate.receiptCount} ${plural(aggregate.receiptCount, 'compra', 'compras')}`,
    typeLabel: 'Fábrica',
  };
}

function baseRouteDetails(
  result: HomeSearchRouteSummaryResult,
): Pick<HomeSearchResultsPresentation, 'details' | 'primaryTitle' | 'relatedCount' | 'typeLabel'> {
  const consideredLabel =
    result.data.period.kind === 'date' || result.data.period.kind === 'dayMonth'
      ? 'Km considerado no dia'
      : 'Km considerados no período';
  const details: string[] = [];
  if (result.data.startTimestamp > 0) {
    details.push(`Início: ${formatRouteTime(result.data.startTimestamp)}`);
  }
  if (result.data.endTimestamp > 0) {
    details.push(`Fim: ${formatRouteTime(result.data.endTimestamp)}`);
  }
  if (result.data.durationSeconds > 0) {
    details.push(`Duração: ${formatRouteDuration(result.data.durationSeconds)}`);
  }
  details.push(`Distância: ${formatRouteDistance(result.data.distanceKm)}`);
  if (result.data.pointsCount > 0) {
    details.push(`Pontos GPS: ${result.data.pointsCount}`);
  }
  if (result.data.consideredDistanceKm > 0) {
    details.push(`${consideredLabel}: ${formatRouteDistance(result.data.consideredDistanceKm)}`);
  }

  return {
    primaryTitle: formatPeriod(result.data.period),
    relatedCount:
      result.data.metric === 'routes'
        ? `${result.data.routeCount} ${plural(result.data.routeCount, 'rota', 'rotas')}`
        : formatCompactRouteDistance(result.data.distanceKm),
    typeLabel: 'Rota',
    details,
  };
}

function routeDetails(
  result: HomeSearchRouteSummaryResult,
): Pick<HomeSearchResultsPresentation, 'details' | 'primaryTitle' | 'relatedCount' | 'typeLabel'> {
  const base = baseRouteDetails(result);
  const routeCountByDate = new Map<string, number>();
  result.data.sessions.forEach((session) => {
    routeCountByDate.set(session.date, (routeCountByDate.get(session.date) ?? 0) + 1);
  });
  const showConsideredDistance =
    result.data.sessions.length === 0
      ? result.data.routeCount > 1
      : [...routeCountByDate.values()].some((count) => count > 1);
  return {
    ...base,
    details: base.details?.filter(
      (detail) =>
        !detail.startsWith('Pontos GPS:') &&
        (showConsideredDistance || !detail.startsWith('Km considerado')),
    ),
  };
}

function carDetails(
  result: HomeSearchCarSettingResult,
): Pick<HomeSearchResultsPresentation, 'primaryTitle' | 'relatedCount' | 'typeLabel'> {
  const value = (amount: number) =>
    `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(amount)} km/l`;
  if (!result.data.available) {
    return { primaryTitle: 'Carro', relatedCount: 'Não informado', typeLabel: 'Consumo' };
  }
  if (result.data.metric === 'gasolineAutonomy') {
    return {
      primaryTitle: 'Carro',
      relatedCount: value(result.data.gasolineKmPerLiter),
      typeLabel: 'Autonomia gasolina',
    };
  }
  if (result.data.metric === 'alcoholAutonomy') {
    return {
      primaryTitle: 'Carro',
      relatedCount: value(result.data.alcoholKmPerLiter),
      typeLabel: 'Autonomia álcool',
    };
  }
  return {
    primaryTitle: 'Carro',
    relatedCount: `Gasolina ${value(result.data.gasolineKmPerLiter)} · Álcool ${value(result.data.alcoholKmPerLiter)}`,
    typeLabel: 'Consumo',
  };
}

function summaryDetails(
  result: HomeSearchPeriodSummaryResult,
): Pick<HomeSearchResultsPresentation, 'primaryTitle' | 'relatedCount' | 'typeLabel'> {
  return {
    primaryTitle: formatPeriod(result.data.period),
    relatedCount: `${result.data.financial.quantidadeEntregas} ${plural(result.data.financial.quantidadeEntregas, 'entrega', 'entregas')} · ${formatCurrency(result.data.financial.faturamento)}`,
    typeLabel: 'Resumo do período',
  };
}

function formatFinancialValue(result: HomeSearchFinancialMetricResult): string {
  if (!result.data.available) {
    return result.data.unavailableReason === 'clientScopeUnsupported'
      ? 'Não disponível por cliente'
      : 'Dados financeiros indisponíveis';
  }

  const value = result.data.value ?? 0;
  if (result.data.unit === 'currency') {
    return formatCurrency(value);
  }
  if (result.data.unit === 'percentage') return `${value.toFixed(1)}%`;
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
}

function financialDetails(
  result: HomeSearchFinancialMetricResult,
): Pick<HomeSearchResultsPresentation, 'primaryTitle' | 'relatedCount' | 'typeLabel'> {
  return {
    primaryTitle: result.data.clientName ?? formatPeriod(result.data.period),
    relatedCount: formatFinancialValue(result),
    typeLabel: homeSearchFinancialMetricDefinition(result.data.metric).label,
  };
}

function periodDetails(
  response: HomeSearchResponse,
  period: HomeSearchPeriod,
): Pick<HomeSearchResultsPresentation, 'primaryTitle' | 'quantity' | 'relatedCount' | 'typeLabel'> {
  const deliveries = response.results.filter((result) => result.type === 'delivery');
  const quantity = deliveries.reduce((total, delivery) => total + delivery.data.quantity, 0);

  return {
    primaryTitle: formatPeriod(period),
    quantity,
    relatedCount: `${deliveries.length} ${plural(deliveries.length, 'entrega', 'entregas')}`,
    typeLabel: 'Período',
  };
}

export function createHomeSearchResultsPresentation(
  response: HomeSearchResponse,
): HomeSearchResultsPresentation {
  const primary = response.results[0];
  const period = response.query.period;
  const base = {
    empty: !primary,
    ...(period ? { period: formatPeriod(period) } : {}),
    query: response.query.original,
  };

  if (!primary) return base;
  if (primary.type === 'financialMetric') {
    return {
      empty: false,
      query: response.query.original,
      ...(primary.data.clientName && period ? { period: formatPeriod(period) } : {}),
      ...financialDetails(primary),
    };
  }
  if (
    primary.type === 'factorySummary' ||
    primary.type === 'routeSummary' ||
    primary.type === 'carSetting' ||
    primary.type === 'periodSummary'
  ) {
    return { empty: false, query: response.query.original, ...resultDetails(response, primary) };
  }
  if (period && !response.query.text) {
    return { empty: false, query: response.query.original, ...periodDetails(response, period) };
  }

  return { ...base, ...resultDetails(response, primary) };
}
