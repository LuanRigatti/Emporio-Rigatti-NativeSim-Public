import type {
  HomeSearchCarSettingResult,
  HomeSearchFactoryPurchaseResult,
  HomeSearchFactorySummaryResult,
  HomeSearchFinancialMetricResult,
  HomeSearchPeriodSummaryResult,
  HomeSearchResponse,
  HomeSearchResult,
  HomeSearchRouteSummaryResult,
} from '../search/HomeSearchTypes';
import { createHomeSearchResultsPresentation } from './HomeSearchResultsPresentation';

export type HomeSearchVisualTone = 'primary' | 'secondary' | 'success' | 'warning' | 'info';

export type HomeSearchVisualRow = {
  id: string;
  label: string;
  value: string;
  tone?: HomeSearchVisualTone;
  monospaced?: boolean;
};

export type HomeSearchVisualSection = {
  id: string;
  title: string;
  systemImage: string;
  rows: HomeSearchVisualRow[];
};

export type HomeSearchVisualMetric = {
  label?: string;
  value: string;
  tone?: HomeSearchVisualTone;
  monospaced?: boolean;
};

export type HomeSearchVisualState = {
  description: string;
  kind: 'empty' | 'unavailable';
  systemImage: string;
  title: string;
};

export type HomeSearchVisualResult = {
  context?: string;
  header?: {
    subtitle?: string;
    systemImage: string;
    title: string;
  };
  hideQueryContext?: boolean;
  id: string;
  metric?: HomeSearchVisualMetric;
  route?: {
    sessionIds: readonly string[];
  };
  sections: HomeSearchVisualSection[];
  state?: HomeSearchVisualState;
};

export type HomeSearchResultVisualModel = HomeSearchVisualResult & {
  empty: boolean;
  items: HomeSearchVisualResult[];
  query: string;
  routePager?: boolean;
  singleDayRoute?: boolean;
  isClient?: boolean;
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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    currency: 'BRL',
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeStyle: 'short',
  }).format(timestamp);
}

function formatDateTime(timestamp: number): string {
  return formatTime(timestamp);
}

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, '0')} min`;
  return `${minutes} min ${String(remainingSeconds).padStart(2, '0')} s`;
}

function formatDistance(distanceKm: number): string {
  return `${new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(distanceKm)} km`;
}

function formatPercentage(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0%';
  return `${new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(value)}%`;
}

function resultDateContext(date: string): string {
  const [, month, day] = date.split('-');
  return `${day}/${month}`;
}

function routeSessionTitle(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const monthName = MONTH_NAMES[(month || 1) - 1] ?? date;
  return Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
    ? `${day} de ${monthName} de ${year}`
    : date;
}

function plural(count: number, singular: string, pluralValue: string): string {
  return count === 1 ? singular : pluralValue;
}

function row(
  id: string,
  label: string,
  value: string,
  options: Pick<HomeSearchVisualRow, 'monospaced' | 'tone'> = {},
): HomeSearchVisualRow {
  return {
    id,
    label,
    value,
    ...(options.monospaced ? { monospaced: true } : {}),
    ...(options.tone ? { tone: options.tone } : {}),
  };
}

function section(
  id: string,
  title: string,
  systemImage: string,
  rows: HomeSearchVisualRow[],
): HomeSearchVisualSection {
  return { id, rows, systemImage, title };
}

function hasMultipleRoutesOnDay(
  sessions: readonly HomeSearchRouteSummaryResult['data']['sessions'][number][],
): boolean {
  const routeCountByDate = new Map<string, number>();
  sessions.forEach((session) => {
    routeCountByDate.set(session.date, (routeCountByDate.get(session.date) ?? 0) + 1);
  });
  return [...routeCountByDate.values()].some((count) => count > 1);
}

function iconForResult(type: HomeSearchResult['type']): string {
  if (type === 'client') return 'person.crop.circle';
  if (type === 'delivery') return 'shippingbox';
  if (type === 'factoryPurchase') return 'shippingbox.fill';
  if (type === 'financialMetric') return 'chart.bar.fill';
  if (type === 'factorySummary') return 'building.2.fill';
  if (type === 'routeSummary') return 'map';
  if (type === 'carSetting') return 'car.fill';
  return 'calendar';
}

function unavailableState(result: HomeSearchResult, description: string): HomeSearchVisualState {
  return {
    description,
    kind: 'unavailable',
    systemImage: result.type === 'financialMetric' ? 'chart.bar.xaxis' : 'exclamationmark.triangle',
    title: result.type === 'carSetting' ? 'Dado não informado' : 'Dados indisponíveis',
  };
}

function clientSections(
  result: Extract<HomeSearchResult, { type: 'client' }>,
  presentation: ReturnType<typeof createHomeSearchResultsPresentation>,
): HomeSearchVisualSection[] {
  if (result.data.matchedField) {
    return [
      section('client-field', 'Cadastro', 'person.text.rectangle', [
        row(
          'matched-field',
          presentation.typeLabel ?? 'Campo',
          presentation.relatedCount ?? 'Não informado',
        ),
      ]),
    ];
  }

  const aggregate = result.data.aggregation;
  return [
    section('client-summary', 'Resumo', 'shippingbox', [
      row(
        'delivery-count',
        'Entregas',
        `${aggregate.deliveryCount} ${plural(aggregate.deliveryCount, 'entrega', 'entregas')}`,
      ),
      row('bucket-quantity', 'Baldes', formatNumber(aggregate.quantity), { monospaced: true }),
      row(
        'bucket-price',
        'Valor do balde',
        aggregate.currentPrice !== undefined
          ? formatCurrency(aggregate.currentPrice)
          : 'Não informado',
        { monospaced: true },
      ),
      row('total-revenue', 'Faturamento total', formatCurrency(aggregate.revenue), {
        monospaced: true,
      }),
      row('total-net-profit', 'Lucro líquido total', formatCurrency(aggregate.netProfit), {
        monospaced: true,
      }),
      row(
        'revenue-share',
        'Participação no faturamento',
        formatPercentage(aggregate.revenueShare),
        { monospaced: true },
      ),
      row('profit-share', 'Participação no lucro', formatPercentage(aggregate.netProfitShare), {
        monospaced: true,
      }),
    ]),
  ];
}

function deliverySections(
  result: Extract<HomeSearchResult, { type: 'delivery' }>,
): HomeSearchVisualSection[] {
  return [
    section('delivery-summary', 'Entrega', 'shippingbox', [
      row('quantity', 'Baldes', formatNumber(result.data.quantity), { monospaced: true }),
      row('value', 'Valor', formatCurrency(result.data.value), { monospaced: true }),
      row('payment', 'Pagamento', result.data.paymentStatus),
      row('delivery-status', 'Status', result.data.delivered ? 'Entregue' : 'Pendente', {
        tone: result.data.delivered ? 'success' : 'warning',
      }),
    ]),
  ];
}

function factoryPurchaseSections(
  result: HomeSearchFactoryPurchaseResult,
): HomeSearchVisualSection[] {
  return [
    section('factory-purchase-summary', 'Compra', 'shippingbox.fill', [
      row('quantity', 'Baldes', formatNumber(result.data.quantity), { monospaced: true }),
      row('total-value', 'Valor total', formatCurrency(result.data.totalValue), {
        monospaced: true,
      }),
      row('total-paid', 'Pago', formatCurrency(result.data.totalPaid), {
        monospaced: true,
        tone: 'success',
      }),
      row('open-value', 'Em aberto', formatCurrency(result.data.openValue), {
        monospaced: true,
        tone: result.data.openValue > 0 ? 'warning' : 'success',
      }),
      row('purchase-status', 'Status', result.data.completed ? 'Pago' : 'Parcial ou em aberto'),
    ]),
  ];
}

function financialSections(result: HomeSearchFinancialMetricResult): HomeSearchVisualSection[] {
  const supportingData = result.data.supportingData;
  if (!supportingData) return [];
  return [
    section('financial-context', 'Base do cálculo', 'chart.bar', [
      row('buckets-sold', 'Baldes vendidos', formatNumber(supportingData.bucketsSold), {
        monospaced: true,
      }),
      row('delivery-count', 'Entregas', formatNumber(supportingData.deliveryCount), {
        monospaced: true,
      }),
      row('revenue', 'Faturamento', formatCurrency(supportingData.revenue), { monospaced: true }),
      ...(supportingData.totalCosts !== undefined
        ? [
            row('total-costs', 'Custos totais', formatCurrency(supportingData.totalCosts), {
              monospaced: true,
            }),
          ]
        : []),
    ]),
  ];
}

function factorySummarySections(result: HomeSearchFactorySummaryResult): HomeSearchVisualSection[] {
  if (!result.data.aggregate) return [];
  const aggregate = result.data.aggregate;
  return [
    section('factory-summary', 'Resumo da fábrica', 'building.2', [
      row('receipt-count', 'Compras', formatNumber(aggregate.receiptCount), { monospaced: true }),
      row('total-buckets', 'Baldes', formatNumber(aggregate.totalBuckets), { monospaced: true }),
      row('total-value', 'Valor comprado', formatCurrency(aggregate.totalValue), {
        monospaced: true,
      }),
      row('total-paid', 'Pago', formatCurrency(aggregate.totalPaid), {
        monospaced: true,
        tone: 'success',
      }),
      row('open-value', 'A pagar', formatCurrency(aggregate.openValue), {
        monospaced: true,
        tone: aggregate.openValue > 0 ? 'warning' : 'success',
      }),
      row('payment-count', 'Pagamentos', formatNumber(aggregate.paymentCount), {
        monospaced: true,
      }),
      row('progress', 'Progresso', `${Math.round(aggregate.progress * 100)}%`, {
        monospaced: true,
      }),
    ]),
  ];
}

function baseRouteSummarySections(result: HomeSearchRouteSummaryResult): HomeSearchVisualSection[] {
  const consideredLabel =
    result.data.period.kind === 'date' || result.data.period.kind === 'dayMonth'
      ? 'Km considerado no dia'
      : 'Km considerado no período';
  return [
    section('route-summary', 'Resumo da rota', 'map', [
      row('distance', 'Distância', formatDistance(result.data.distanceKm), { monospaced: true }),
      row('start', 'Início', formatDateTime(result.data.startTimestamp)),
      row('end', 'Fim', formatDateTime(result.data.endTimestamp)),
      row('duration', 'Duração', formatDuration(result.data.durationSeconds)),
      row('points', 'Pontos GPS', formatNumber(result.data.pointsCount), { monospaced: true }),
      row(
        consideredLabel.toLowerCase().replaceAll(' ', '-'),
        consideredLabel,
        formatDistance(result.data.consideredDistanceKm),
        {
          monospaced: true,
        },
      ),
    ]),
  ];
}

function baseRouteSessionSections(
  result: HomeSearchRouteSummaryResult,
  session: HomeSearchRouteSummaryResult['data']['sessions'][number],
): HomeSearchVisualSection[] {
  const consideredLabel =
    result.data.period.kind === 'date' || result.data.period.kind === 'dayMonth'
      ? 'Km considerado no dia'
      : 'Km considerado no período';
  return [
    section('route-summary', 'Resumo da rota', 'map', [
      row('distance', 'Distância', formatDistance(session.distanceKm), { monospaced: true }),
      row('start', 'Início', formatDateTime(session.startTimestamp)),
      row('end', 'Fim', formatDateTime(session.endTimestamp)),
      row('duration', 'Duração', formatDuration(session.durationSeconds)),
      row('points', 'Pontos GPS', formatNumber(session.pointsCount), { monospaced: true }),
      row(
        consideredLabel.toLowerCase().replaceAll(' ', '-'),
        consideredLabel,
        formatDistance(session.dailyDistanceKm),
        { monospaced: true },
      ),
    ]),
  ];
}

function refineRouteSections(
  sections: HomeSearchVisualSection[],
  startTimestamp: number,
  endTimestamp: number,
  showConsideredDistance: boolean,
): HomeSearchVisualSection[] {
  return sections.map((routeSection) => ({
    ...routeSection,
    rows: routeSection.rows
      .filter(
        (routeRow) =>
          routeRow.id !== 'points' &&
          (showConsideredDistance || !routeRow.id.startsWith('km-considerado')),
      )
      .map((routeRow) => {
        if (routeRow.id === 'start') return { ...routeRow, value: formatTime(startTimestamp) };
        if (routeRow.id === 'end') return { ...routeRow, value: formatTime(endTimestamp) };
        return routeRow;
      }),
  }));
}

function routeSummarySections(result: HomeSearchRouteSummaryResult): HomeSearchVisualSection[] {
  return refineRouteSections(
    baseRouteSummarySections(result),
    result.data.startTimestamp,
    result.data.endTimestamp,
    hasMultipleRoutesOnDay(result.data.sessions),
  );
}

function routeSessionSections(
  result: HomeSearchRouteSummaryResult,
  session: HomeSearchRouteSummaryResult['data']['sessions'][number],
): HomeSearchVisualSection[] {
  const sessionsOnDay = result.data.sessions.filter(({ date }) => date === session.date);
  return refineRouteSections(
    baseRouteSessionSections(result, session),
    session.startTimestamp,
    session.endTimestamp,
    hasMultipleRoutesOnDay(sessionsOnDay),
  );
}

function routeSessionVisualItems(result: HomeSearchRouteSummaryResult): HomeSearchVisualResult[] {
  const sessions = [...result.data.sessions].sort(
    (left, right) =>
      right.date.localeCompare(left.date) ||
      right.startTimestamp - left.startTimestamp ||
      right.endTimestamp - left.endTimestamp ||
      right.sessionId.localeCompare(left.sessionId),
  );
  return sessions.map((session) => ({
    hideQueryContext: true,
    header: { systemImage: iconForResult(result.type), title: routeSessionTitle(session.date) },
    id: `${result.id}:${session.sessionId}`,
    route: { sessionIds: [session.sessionId] },
    sections: routeSessionSections(result, session),
  }));
}

function carSections(result: HomeSearchCarSettingResult): HomeSearchVisualSection[] {
  return [
    section('car-consumption', 'Consumo', 'car.fill', [
      row('gasoline', 'Gasolina', `${formatNumber(result.data.gasolineKmPerLiter)} km/l`, {
        monospaced: true,
      }),
      row('alcohol', 'Álcool', `${formatNumber(result.data.alcoholKmPerLiter)} km/l`, {
        monospaced: true,
      }),
    ]),
  ];
}

function periodSummarySections(result: HomeSearchPeriodSummaryResult): HomeSearchVisualSection[] {
  const financial = result.data.financial;
  const factory = result.data.factory;
  const routes = result.data.routes;
  return [
    section('period-financial', 'Finanças', 'chart.bar.fill', [
      row('deliveries', 'Entregas', formatNumber(financial.quantidadeEntregas), {
        monospaced: true,
      }),
      row('buckets', 'Baldes', formatNumber(financial.quantidadeBaldes), { monospaced: true }),
      row('revenue', 'Faturamento', formatCurrency(financial.faturamento), { monospaced: true }),
      row('paid', 'Pago', formatCurrency(financial.valoresPagos), {
        monospaced: true,
        tone: 'success',
      }),
      row('pending', 'Pendente', formatCurrency(financial.valoresPendentes), {
        monospaced: true,
        tone: financial.valoresPendentes > 0 ? 'warning' : 'success',
      }),
      row('net-profit', 'Lucro líquido', formatCurrency(financial.lucroLiquido), {
        monospaced: true,
      }),
    ]),
    section('period-operations', 'Operação', 'shippingbox', [
      row('factory-receipts', 'Compras da fábrica', formatNumber(factory.receiptCount), {
        monospaced: true,
      }),
      row('factory-buckets', 'Baldes comprados', formatNumber(factory.totalBuckets), {
        monospaced: true,
      }),
      row('factory-open', 'A pagar na fábrica', formatCurrency(factory.openValue), {
        monospaced: true,
        tone: factory.openValue > 0 ? 'warning' : 'success',
      }),
      row('routes', 'Rotas', formatNumber(routes.routeCount), { monospaced: true }),
      row('distance', 'Distância das rotas', formatDistance(routes.distanceKm), {
        monospaced: true,
      }),
    ]),
  ];
}

function resultSections(
  response: HomeSearchResponse,
  result: HomeSearchResult,
  presentation: ReturnType<typeof createHomeSearchResultsPresentation>,
): HomeSearchVisualSection[] {
  if (presentation.typeLabel === 'Período' && response.query.period && !response.query.text) {
    const deliveries = response.results.filter((item) => item.type === 'delivery');
    const quantity = deliveries.reduce((total, item) => total + item.data.quantity, 0);
    return [
      section('period-deliveries', 'Entregas', 'shippingbox', [
        row('delivery-count', 'Entregas', formatNumber(deliveries.length), { monospaced: true }),
        row('bucket-quantity', 'Baldes', formatNumber(quantity), { monospaced: true }),
      ]),
    ];
  }
  if (result.type === 'client') return clientSections(result, presentation);
  if (result.type === 'delivery') return deliverySections(result);
  if (result.type === 'factoryPurchase') return factoryPurchaseSections(result);
  if (result.type === 'financialMetric') return financialSections(result);
  if (result.type === 'factorySummary') return factorySummarySections(result);
  if (result.type === 'routeSummary') return routeSummarySections(result);
  if (result.type === 'carSetting') return carSections(result);
  return periodSummarySections(result);
}

function concreteResultVisualItem(
  result: Extract<HomeSearchResult, { type: 'delivery' | 'factoryPurchase' }>,
): HomeSearchVisualResult {
  if (result.type === 'delivery') {
    return {
      context: resultDateContext(result.date),
      header: { systemImage: iconForResult(result.type), title: result.title },
      id: result.id,
      sections: deliverySections(result),
    };
  }

  return {
    context: resultDateContext(result.date),
    header: { systemImage: iconForResult(result.type), title: result.title },
    id: result.id,
    sections: factoryPurchaseSections(result),
  };
}

function multipleConcreteResultItems(
  response: HomeSearchResponse,
): HomeSearchVisualResult[] | null {
  if (!response.query.paymentStatus) return null;

  const deliveryResults = response.results.filter(
    (result): result is Extract<HomeSearchResult, { type: 'delivery' }> =>
      result.type === 'delivery',
  );
  if (deliveryResults.length <= 1) return null;

  const concreteResults = response.results.filter(
    (result): result is Extract<HomeSearchResult, { type: 'delivery' | 'factoryPurchase' }> =>
      result.type === 'delivery' || result.type === 'factoryPurchase',
  );
  return concreteResults.map(concreteResultVisualItem);
}

function unavailableDescription(
  result: HomeSearchResult,
  presentation: ReturnType<typeof createHomeSearchResultsPresentation>,
): string | null {
  if (result.type === 'financialMetric' && !result.data.available)
    return presentation.relatedCount ?? 'Dados financeiros indisponíveis';
  if (result.type === 'factorySummary' && !result.data.available)
    return 'Filtro por data do pagamento não é suportado.';
  if (result.type === 'carSetting' && !result.data.available)
    return 'Configuração de consumo ainda não informada.';
  return null;
}

export function createHomeSearchResultVisualModel(
  response: HomeSearchResponse,
): HomeSearchResultVisualModel {
  const presentation = createHomeSearchResultsPresentation(response);
  if (presentation.empty) {
    return {
      empty: true,
      id: 'empty',
      items: [],
      query: presentation.query,
      sections: [],
      state: {
        description: presentation.query,
        kind: 'empty',
        systemImage: 'magnifyingglass',
        title: 'Nenhum resultado',
      },
    };
  }

  const result = response.results[0];
  const description = unavailableDescription(result, presentation);
  const isClient = result.type === 'client';
  const isRoute = result.type === 'routeSummary';
  const isSingleDayRoute =
    isRoute && (result.data.period.kind === 'date' || result.data.period.kind === 'dayMonth');
  const primaryItem: HomeSearchVisualResult = {
    ...(isRoute || isClient ? { hideQueryContext: true } : {}),
    header: {
      systemImage: iconForResult(result.type),
      title: presentation.primaryTitle ?? result.title,
    },
    id: result.id,
    metric:
      description || isClient || isRoute
        ? undefined
        : {
            monospaced: result.type !== 'delivery',
            value: presentation.relatedCount ?? '',
          },
    sections: resultSections(response, result, presentation),
  };

  if (description) {
    primaryItem.state = unavailableState(result, description);
  }
  if (result.type === 'routeSummary') {
    primaryItem.route = { sessionIds: result.relations.sessionIds };
  }

  const routeItems =
    result.type === 'routeSummary' && result.data.sessions.length > 1
      ? routeSessionVisualItems(result)
      : null;
  const items = routeItems ?? multipleConcreteResultItems(response) ?? [primaryItem];
  return {
    ...items[0],
    empty: false,
    items,
    query: presentation.query,
    ...(routeItems ? { routePager: true } : {}),
    ...(isSingleDayRoute ? { singleDayRoute: true } : {}),
    ...(isClient ? { isClient: true } : {}),
  };
}
