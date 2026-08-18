import { expenseCalculationService } from '@/services/expenses/ExpenseCalculationService';
import { factoryCalculationService } from '@/services/finance/FactoryCalculationService';
import { financialCalculationService } from '@/services/finance/FinancialCalculationService';
import { financialFiltersForSelection } from '@/services/finance/FinancialPeriodService';
import { parseKmPerLiter } from '@/services/expenses/FuelCostCalculationService';
import {
  summarizeRouteDistance,
  summarizeRouteKilometersByDate,
} from '@/services/routes/routeTrackingDistance';
import type {
  ClientId,
  ClientModel,
  Delivery,
  FactoryReceipt,
  FinancialPeriodSelection,
} from '@/types/data';

import {
  homeSearchFinancialMetricDefinition,
  homeSearchFinancialMetricValue,
} from './HomeSearchFinancialMetrics';
import { homeSearchQueryParser, normalizeHomeSearchText } from './HomeSearchQueryParser';
import type {
  HomeSearchClientAggregation,
  HomeSearchClientResult,
  HomeSearchDataSource,
  HomeSearchDeliveryFacet,
  HomeSearchDeliveryResult,
  HomeSearchDomainCounts,
  HomeSearchFactoryPurchaseResult,
  HomeSearchFactoryAggregate,
  HomeSearchFactoryReceiptSummary,
  HomeSearchFactorySummaryResult,
  HomeSearchCarSettingResult,
  HomeSearchFinancialData,
  HomeSearchFinancialMetric,
  HomeSearchFinancialMetricResult,
  HomeSearchParsedQuery,
  HomeSearchPeriodSummaryResult,
  HomeSearchPeriod,
  HomeSearchRouteSummaryResult,
  HomeSearchResponse,
  HomeSearchResult,
} from './HomeSearchTypes';

const EMPTY_COUNTS: HomeSearchDomainCounts = {
  client: 0,
  delivery: 0,
  factoryPurchase: 0,
  financialMetric: 0,
  factorySummary: 0,
  routeSummary: 0,
  carSetting: 0,
  periodSummary: 0,
};

function matchesPeriod(date: string, period: HomeSearchPeriod | undefined): boolean {
  if (!period) return true;
  if (period.kind === 'date') return date === period.date;
  if (period.kind === 'year') return date.startsWith(`${period.year}-`);
  if (period.kind === 'dayMonth') {
    return (
      date.slice(5) ===
      `${String(period.month).padStart(2, '0')}-${String(period.day).padStart(2, '0')}`
    );
  }
  const month = String(period.month).padStart(2, '0');
  return period.year ? date.startsWith(`${period.year}-${month}-`) : date.slice(5, 7) === month;
}

function matchesNumber(actual: number, expected: number | undefined): boolean {
  return expected === undefined || Math.abs(actual - expected) < 0.005;
}

function textScore(value: string, query: string): number {
  if (!query) return 0;
  const normalized = normalizeHomeSearchText(value);
  if (normalized === query) return 1_000;
  if (normalized.startsWith(query)) return 800;
  if (normalized.includes(query)) return 600;
  return -1;
}

function clientForDelivery(
  delivery: Delivery,
  clientsById: ReadonlyMap<ClientId, ClientModel>,
  clientsByName: ReadonlyMap<string, ClientModel>,
): ClientModel | undefined {
  if (delivery.clientId) return clientsById.get(delivery.clientId);
  return clientsByName.get(normalizeHomeSearchText(delivery.cliente));
}

function deliveryFacets(delivery: Delivery, client?: ClientModel): HomeSearchDeliveryFacet[] {
  const facets: HomeSearchDeliveryFacet[] = [];
  if (normalizeHomeSearchText(delivery.status) !== 'pago') facets.push('receivable');
  if (client?.usesInvoice) facets.push('invoice');
  if (client?.usesBoleto) facets.push('boleto');
  return facets;
}

function matchesDeliveryFilters(
  delivery: Delivery,
  query: HomeSearchParsedQuery,
  client?: ClientModel,
): boolean {
  if (!matchesPeriod(delivery.data, query.period)) return false;
  if (!matchesNumber(delivery.quantidade, query.quantity)) return false;
  if (!matchesNumber(delivery.valor, query.money)) return false;
  if (query.paymentStatus) {
    const paid = normalizeHomeSearchText(delivery.status) === 'pago';
    if (query.paymentStatus === 'paid' ? !paid : paid) return false;
  }
  if (query.documentType && !deliveryFacets(delivery, client).includes(query.documentType)) {
    return false;
  }
  if (!query.text) return true;
  return (
    textScore(delivery.cliente, query.text) >= 0 ||
    textScore(client?.canonicalName ?? '', query.text) >= 0 ||
    textScore(client?.address ?? '', query.text) >= 0
  );
}

function matchesFactoryFilters(receipt: FactoryReceipt, query: HomeSearchParsedQuery): boolean {
  if (query.text || query.documentType) return false;
  if (!matchesPeriod(receipt.data, query.period)) return false;
  if (!matchesNumber(receipt.quantidade, query.quantity)) return false;
  if (!matchesNumber(receipt.valorTotal, query.money)) return false;
  if (query.paymentStatus) {
    const paid = factoryCalculationService.isWithinSettlementTolerance(receipt);
    if (query.paymentStatus === 'paid' ? !paid : paid) return false;
  }
  return true;
}

function relatedDeliveriesForClient(
  client: ClientModel,
  deliveries: readonly Delivery[],
): Delivery[] {
  return deliveries.filter((delivery) => {
    if (delivery.clientId) return delivery.clientId === client.clientId;
    return normalizeHomeSearchText(delivery.cliente) === client.normalizedName;
  });
}

function aggregateClient(
  client: ClientModel,
  deliveries: readonly Delivery[],
  globalDeliveries: readonly Delivery[] = deliveries,
  financialData?: HomeSearchFinancialData,
): HomeSearchClientAggregation {
  const deliveryIds = deliveries.map((delivery) => delivery.id);
  const deliveryCount = deliveries.length;
  const quantity = financialCalculationService.calculateQuantidade(deliveries as Delivery[]);
  const revenue = financialCalculationService.calculateFaturamento(deliveries as Delivery[]);
  const paid = financialCalculationService.calculatePago(deliveries as Delivery[]);
  const pending = financialCalculationService.calculatePendente(deliveries as Delivery[]);

  const bucketCost = financialCalculationService.calculateCustoTotalBaldes(
    deliveries as Delivery[],
  );
  const grossProfit = financialCalculationService.calculateLucroBruto(revenue, bucketCost);

  let netProfit = grossProfit;
  if (
    financialData &&
    (Object.keys(financialData.dailyExpenses).length > 0 ||
      Object.keys(financialData.monthlyExpenses).length > 0)
  ) {
    const allocation = expenseCalculationService.calculateClientAllocation(
      deliveries as Delivery[],
      globalDeliveries as Delivery[],
      'month',
      financialData.dailyExpenses,
      financialData.monthlyExpenses,
      'Todos',
    );
    netProfit = financialCalculationService.calculateLucroLiquido(
      grossProfit,
      allocation.estar,
      allocation.combustivel,
      allocation.luz,
      0,
    );
  }

  const globalRevenue = financialCalculationService.calculateFaturamento(
    globalDeliveries as Delivery[],
  );
  const rawRevenueShare = globalRevenue > 0 && revenue > 0 ? (revenue / globalRevenue) * 100 : 0;
  const revenueShare = Number.isFinite(rawRevenueShare) ? Math.max(0, rawRevenueShare) : 0;

  const globalBucketCost = financialCalculationService.calculateCustoTotalBaldes(
    globalDeliveries as Delivery[],
  );
  let globalNetProfit = financialCalculationService.calculateLucroBruto(
    globalRevenue,
    globalBucketCost,
  );
  if (
    financialData &&
    (Object.keys(financialData.dailyExpenses).length > 0 ||
      Object.keys(financialData.monthlyExpenses).length > 0)
  ) {
    const globalSummary = financialCalculationService.calculateResumo({
      deliveries: globalDeliveries as Delivery[],
      dailyExpenses: financialData.dailyExpenses,
      monthlyExpenses: financialData.monthlyExpenses,
      filters: { periodo: 'todos' },
    });
    globalNetProfit = globalSummary.lucroLiquido;
  }

  const rawNetProfitShare =
    globalNetProfit > 0 && netProfit > 0 ? (netProfit / globalNetProfit) * 100 : 0;
  const netProfitShare = Number.isFinite(rawNetProfitShare) ? Math.max(0, rawNetProfitShare) : 0;

  return {
    deliveryIds,
    deliveryCount,
    quantity,
    revenue,
    paid,
    pending,
    ...(client.currentPrice !== undefined ? { currentPrice: client.currentPrice } : {}),
    netProfit,
    revenueShare,
    netProfitShare,
  };
}

function clientResult(
  client: ClientModel,
  matchingDeliveries: readonly Delivery[],
  query: HomeSearchParsedQuery,
  globalDeliveries: readonly Delivery[] = matchingDeliveries,
  financialData?: HomeSearchFinancialData,
): HomeSearchClientResult | undefined {
  const nameScore = textScore(client.canonicalName, query.text);
  const addressScore = textScore(client.address ?? '', query.text);
  const directScore = Math.max(nameScore, addressScore >= 0 ? addressScore - 150 : -1);
  const hasNonTextFilter = Boolean(
    query.period ||
    query.quantity !== undefined ||
    query.money !== undefined ||
    query.paymentStatus,
  );
  const matchesDocument =
    query.clientField ||
    !query.documentType ||
    (query.documentType === 'invoice' ? client.usesInvoice : client.usesBoleto);

  if (!matchesDocument) return undefined;
  if (query.text && directScore < 0) return undefined;
  if (!query.clientField && hasNonTextFilter && matchingDeliveries.length === 0) return undefined;
  if (!query.clientField && !query.text && !query.documentType && matchingDeliveries.length === 0) {
    return undefined;
  }

  const aggregation = aggregateClient(client, matchingDeliveries, globalDeliveries, financialData);
  const score = directScore >= 0 ? directScore + 200 : 300;
  return {
    type: 'client',
    id: client.clientId,
    clientId: client.clientId,
    title: client.canonicalName,
    score,
    data: {
      ...(client.address ? { address: client.address } : {}),
      usesInvoice: client.usesInvoice,
      usesBoleto: client.usesBoleto,
      aggregation,
      ...(query.clientField ? { matchedField: clientMatchedField(client, query.clientField) } : {}),
    },
    relations: { deliveryIds: aggregation.deliveryIds },
  };
}

function clientMatchedField(
  client: ClientModel,
  field: NonNullable<HomeSearchParsedQuery['clientField']>,
): NonNullable<HomeSearchClientResult['data']['matchedField']> {
  if (field === 'currentPrice') {
    return {
      field,
      available: client.currentPrice !== undefined,
      unit: 'currency',
      ...(client.currentPrice === undefined ? {} : { value: client.currentPrice }),
    };
  }
  if (field === 'address') {
    return {
      field,
      available: Boolean(client.address),
      unit: 'text',
      ...(client.address ? { value: client.address } : {}),
    };
  }
  return {
    field,
    available: true,
    unit: 'boolean',
    value: field === 'usesInvoice' ? client.usesInvoice : client.usesBoleto,
  };
}

function deliveryResult(
  delivery: Delivery,
  client: ClientModel | undefined,
  query: HomeSearchParsedQuery,
): HomeSearchDeliveryResult {
  const directScore = textScore(delivery.cliente, query.text);
  const score = query.text ? Math.max(250, directScore - 100) : 500;
  return {
    type: 'delivery',
    id: delivery.id,
    ...(delivery.clientId ? { clientId: delivery.clientId } : {}),
    title: delivery.cliente,
    date: delivery.data,
    score,
    data: {
      quantity: delivery.quantidade,
      value: delivery.valor,
      paymentStatus: delivery.status,
      delivered: delivery.entregue,
      ...(delivery.invoiceStatus ? { invoiceStatus: delivery.invoiceStatus } : {}),
      ...(delivery.metodoPagamento ? { paymentMethod: delivery.metodoPagamento } : {}),
      facets: deliveryFacets(delivery, client),
    },
    relations: { ...(delivery.clientId ? { clientId: delivery.clientId } : {}) },
  };
}

function factoryPurchaseResult(
  receipt: FactoryReceipt,
  query: HomeSearchParsedQuery,
): HomeSearchFactoryPurchaseResult {
  const totalPaid = factoryCalculationService.totalPaid(receipt);
  const paymentIds = receipt.pagamentos.map((payment) => payment.id);
  return {
    type: 'factoryPurchase',
    id: receipt.id,
    title: 'Compra da f\u00e1brica',
    date: receipt.data,
    score: query.period ? 450 : 350,
    data: {
      quantity: receipt.quantidade,
      totalValue: receipt.valorTotal,
      totalPaid,
      openValue: factoryCalculationService.openValue(receipt),
      completed: factoryCalculationService.isWithinSettlementTolerance(receipt),
      paymentIds,
    },
    relations: { paymentIds },
  };
}

function sortResults(left: HomeSearchResult, right: HomeSearchResult): number {
  const typePriority: Record<HomeSearchResult['type'], number> = {
    financialMetric: 0,
    client: 0,
    delivery: 1,
    factoryPurchase: 2,
    factorySummary: 0,
    routeSummary: 0,
    carSetting: 0,
    periodSummary: 0,
  };
  const leftDate = 'date' in left ? left.date : '';
  const rightDate = 'date' in right ? right.date : '';
  return (
    right.score - left.score ||
    typePriority[left.type] - typePriority[right.type] ||
    rightDate.localeCompare(leftDate) ||
    left.title.localeCompare(right.title, 'pt-BR') ||
    left.id.localeCompare(right.id)
  );
}

function factoryReceiptSummary(receipt: FactoryReceipt): HomeSearchFactoryReceiptSummary {
  const totalPaid = factoryCalculationService.totalPaid(receipt);
  return {
    receiptId: receipt.id,
    date: receipt.data,
    quantity: receipt.quantidade,
    totalValue: receipt.valorTotal,
    totalPaid,
    openValue: factoryCalculationService.openValue(receipt),
    progress: factoryCalculationService.paymentProgress(receipt),
    status: factoryCalculationService.settlementStatus(receipt),
    paymentIds: receipt.pagamentos.map((payment) => payment.id),
  };
}

function factoryAggregate(receipts: readonly FactoryReceipt[]): HomeSearchFactoryAggregate {
  const summary = factoryCalculationService.summarize([...receipts]);
  return {
    receiptCount: summary.totalReceipts,
    totalBuckets: summary.totalBuckets,
    totalValue: summary.totalValue,
    totalPaid: summary.totalPaid,
    openValue: summary.openValue,
    paymentCount: receipts.reduce((total, receipt) => total + receipt.pagamentos.length, 0),
    progress: factoryCalculationService.paymentProgressForValues(
      summary.totalPaid,
      summary.totalValue,
    ),
  };
}

function matchesFactoryStatus(
  receipt: FactoryReceipt,
  status: HomeSearchParsedQuery['factoryStatus'],
): boolean {
  if (!status) return true;
  const actual = factoryCalculationService.settlementStatus(receipt);
  return status === 'outstanding' ? actual !== 'paid' : actual === status;
}

function factorySummaryResults(
  data: Awaited<ReturnType<HomeSearchDataSource['load']>>,
  query: HomeSearchParsedQuery,
): HomeSearchFactorySummaryResult[] {
  const metric = query.factoryMetric;
  if (!metric) return [];
  if (query.factoryPaymentDateUnsupported) {
    return [
      {
        type: 'factorySummary',
        id: `factorySummary:unsupported:${query.normalized}`,
        title: 'Fábrica',
        score: 2_000,
        data: {
          available: false,
          metric,
          ...(query.period ? { period: query.period } : {}),
          receipts: [],
          unsupportedReason: 'paymentDateFilter',
        },
        relations: { receiptIds: [], paymentIds: [] },
      },
    ];
  }
  const receipts = data.factoryPurchases
    .filter((receipt) => matchesPeriod(receipt.data, query.period))
    .filter((receipt) => matchesFactoryStatus(receipt, query.factoryStatus));
  if (receipts.length === 0) return [];
  const receiptSummaries = receipts.map(factoryReceiptSummary);
  return [
    {
      type: 'factorySummary',
      id: `factorySummary:${metric}:${query.normalized}`,
      title: 'Fábrica',
      score: 2_000,
      data: {
        available: true,
        metric,
        ...(query.period ? { period: query.period } : {}),
        ...(query.factoryStatus ? { status: query.factoryStatus } : {}),
        aggregate: factoryAggregate(receipts),
        receipts: receiptSummaries,
      },
      relations: {
        receiptIds: receipts.map((receipt) => receipt.id),
        paymentIds: receiptSummaries.flatMap((receipt) => receipt.paymentIds),
      },
    },
  ];
}

function routeSummaryResults(
  data: Awaited<ReturnType<HomeSearchDataSource['load']>>,
  query: HomeSearchParsedQuery,
): HomeSearchRouteSummaryResult[] {
  const period = query.period;
  const metric = query.routeMetric;
  const sessions = (data.routeSessions ?? []).filter((session) =>
    matchesPeriod(session.date, period),
  );
  if (!period || !metric || sessions.length === 0) return [];
  const distance = summarizeRouteDistance(sessions);
  const dailySummaries = new Map(
    [...new Set(sessions.map((session) => session.date))].map((date) => [
      date,
      summarizeRouteDistance(sessions.filter((session) => session.date === date)),
    ]),
  );
  const startTimestamp = Math.min(...sessions.map((session) => session.startTimestamp));
  const endTimestamp = Math.max(...sessions.map((session) => session.endTimestamp));
  const durationSeconds = sessions.reduce(
    (total, session) => total + Math.max(0, session.durationSeconds),
    0,
  );
  const pointsCount = sessions.reduce((total, session) => total + session.pointsCount, 0);
  const consideredDistanceKm = [...dailySummaries.values()].reduce(
    (total, summary) => total + summary.totalKilometers,
    0,
  );
  return [
    {
      type: 'routeSummary',
      id: `routeSummary:${query.normalized}`,
      title: 'Rota',
      score: 2_000,
      data: {
        period,
        metric,
        distanceKm: distance.totalKilometers,
        routeCount: distance.routeCount,
        durationSeconds,
        pointsCount,
        startTimestamp,
        endTimestamp,
        consideredDistanceKm,
        sessions: sessions.map((session) => ({
          sessionId: session.id,
          date: session.date,
          distanceKm: session.distanceMeters / 1_000,
          dailyDistanceKm: dailySummaries.get(session.date)?.totalKilometers ?? 0,
          durationSeconds: session.durationSeconds,
          pointsCount: session.pointsCount,
          startTimestamp: session.startTimestamp,
          endTimestamp: session.endTimestamp,
        })),
      },
      relations: { sessionIds: sessions.map((session) => session.id) },
    },
  ];
}

function carSettingResults(
  data: Awaited<ReturnType<HomeSearchDataSource['load']>>,
  query: HomeSearchParsedQuery,
): HomeSearchCarSettingResult[] {
  const metric = query.carMetric;
  const settings = data.carSettings;
  if (!metric || !settings) return [];
  const gasolineKmPerLiter = parseKmPerLiter(settings.gasolineAutonomy);
  const alcoholKmPerLiter = parseKmPerLiter(settings.alcoholAutonomy);
  const available =
    metric === 'gasolineAutonomy'
      ? gasolineKmPerLiter > 0
      : metric === 'alcoholAutonomy'
        ? alcoholKmPerLiter > 0
        : gasolineKmPerLiter > 0 && alcoholKmPerLiter > 0;
  return [
    {
      type: 'carSetting',
      id: `carSetting:${metric}`,
      title: 'Carro',
      score: 2_000,
      data: { metric, available, gasolineKmPerLiter, alcoholKmPerLiter },
      relations: {},
    },
  ];
}

function periodSummaryResults(
  data: Awaited<ReturnType<HomeSearchDataSource['load']>>,
  query: HomeSearchParsedQuery,
): HomeSearchPeriodSummaryResult[] {
  const period = query.period;
  const financial = data.financial;
  if (!period || !financial) return [];
  const deliveries = financial.deliveries.filter((delivery) =>
    matchesPeriod(delivery.data, period),
  );
  const dailyDates = Object.keys(financial.dailyExpenses).filter((date) =>
    matchesPeriod(date, period),
  );
  const monthlyKeys = Object.keys(financial.monthlyExpenses).filter((month) =>
    period.kind === 'year'
      ? month.startsWith(`${period.year}-`)
      : period.kind === 'month'
        ? month === `${period.year}-${String(period.month).padStart(2, '0')}`
        : false,
  );
  const receipts = data.factoryPurchases.filter((receipt) => matchesPeriod(receipt.data, period));
  const sessions = data.routeSessions ?? [];
  if (
    deliveries.length === 0 &&
    dailyDates.length === 0 &&
    monthlyKeys.length === 0 &&
    receipts.length === 0 &&
    sessions.length === 0
  )
    return [];
  const financialSummary = financialCalculationService.calculateResumo({
    deliveries: financial.deliveries,
    dailyExpenses: financial.dailyExpenses,
    filters: financialFiltersForSelection(financialSelection(period)),
    monthlyExpenses: financial.monthlyExpenses,
    automaticKilometersByDate: summarizeRouteKilometersByDate(sessions),
  });
  const routeSummary = summarizeRouteDistance(sessions);
  return [
    {
      type: 'periodSummary',
      id: `periodSummary:${query.normalized}`,
      title: 'Resumo do período',
      score: 2_000,
      data: {
        period,
        financial: financialSummary,
        factory: factoryAggregate(receipts),
        routes: {
          routeCount: routeSummary.routeCount,
          distanceKm: routeSummary.totalKilometers,
        },
      },
      relations: {
        deliveryIds: deliveries.map((delivery) => delivery.id),
        paymentIds: receipts.flatMap((receipt) => receipt.pagamentos.map((payment) => payment.id)),
        receiptIds: receipts.map((receipt) => receipt.id),
        sessionIds: sessions.map((session) => session.id),
      },
    },
  ];
}

function financialSelection(period: HomeSearchPeriod): FinancialPeriodSelection {
  if (period.kind === 'date') return { kind: 'day', date: period.date };
  if (period.kind === 'year') return { kind: 'year', year: String(period.year) };
  if (period.kind === 'dayMonth') {
    const year = new Date().getFullYear();
    return {
      kind: 'day',
      date: `${year}-${String(period.month).padStart(2, '0')}-${String(period.day).padStart(2, '0')}`,
    };
  }
  const year = period.year ?? new Date().getFullYear();
  return { kind: 'month', month: `${year}-${String(period.month).padStart(2, '0')}` };
}

function financialClients(
  clients: readonly ClientModel[],
  query: HomeSearchParsedQuery,
): ClientModel[] {
  if (!query.text) return [];
  return clients.filter((client) => {
    const address = normalizeHomeSearchText(client.address ?? '');
    return client.normalizedName.includes(query.text) || address.includes(query.text);
  });
}

function effectiveClientMetric(query: HomeSearchParsedQuery): HomeSearchFinancialMetric {
  return query.financialMetricAlias === 'lucro' ? 'grossProfit' : query.financialMetric!;
}

function financialResults(
  data: Awaited<ReturnType<HomeSearchDataSource['load']>>,
  query: HomeSearchParsedQuery,
): HomeSearchFinancialMetricResult[] {
  const financial = data.financial;
  const period = query.period;
  const requestedMetric = query.financialMetric;
  if (!financial || !period || !requestedMetric) return [];

  const periodDeliveries = financial.deliveries.filter((delivery) =>
    matchesPeriod(delivery.data, period),
  );
  const hasDailyData = Object.keys(financial.dailyExpenses).some((date) =>
    matchesPeriod(date, period),
  );
  const hasMonthlyData = Object.keys(financial.monthlyExpenses).some((month) => {
    if (period.kind === 'month') {
      return month === `${period.year}-${String(period.month).padStart(2, '0')}`;
    }
    return period.kind === 'year' ? month.startsWith(`${period.year}-`) : false;
  });
  const hasPeriodData = periodDeliveries.length > 0 || hasDailyData || hasMonthlyData;
  if (!hasPeriodData) return [];

  const clients = financialClients(data.clients, query);
  const scopes: (ClientModel | undefined)[] = query.text ? clients : [undefined];
  const automaticKilometersByDate = summarizeRouteKilometersByDate(data.routeSessions ?? []);

  return scopes.flatMap((client) => {
    const metric = client ? effectiveClientMetric(query) : requestedMetric;
    const definition = homeSearchFinancialMetricDefinition(metric);
    const filters = {
      ...financialFiltersForSelection(financialSelection(period)),
      ...(client ? { buscaCliente: client.canonicalName, clientId: client.clientId } : {}),
    };
    const clientDeliveries = client
      ? financialCalculationService.filterDeliveries(financial.deliveries, filters)
      : financial.deliveries;
    if (client && clientDeliveries.length === 0) return [];

    const unavailableReason =
      client && definition.clientScope === 'unsupported'
        ? ('clientScopeUnsupported' as const)
        : definition.requiresCosts && !financial.costsAvailable
          ? ('sourceUnavailable' as const)
          : undefined;
    const title = client?.canonicalName ?? definition.label;
    const base: HomeSearchFinancialMetricResult = {
      type: 'financialMetric',
      id: `financialMetric:${metric}:${client?.clientId ?? 'global'}:${query.normalized}`,
      title,
      score: client ? textScore(client.canonicalName, query.text) + 1_500 : 2_000,
      data: {
        available: unavailableReason === undefined,
        metric,
        unit: definition.unit,
        period,
        ...(client ? { clientId: client.clientId, clientName: client.canonicalName } : {}),
        ...(unavailableReason ? { unavailableReason } : {}),
      },
      relations: { ...(client ? { clientId: client.clientId } : {}) },
    };
    if (unavailableReason) return [base];

    const summary = financialCalculationService.calculateResumo({
      deliveries: financial.deliveries,
      dailyExpenses: financial.dailyExpenses,
      filters,
      monthlyExpenses: financial.monthlyExpenses,
      automaticKilometersByDate,
    });
    return [
      {
        ...base,
        data: {
          ...base.data,
          value: homeSearchFinancialMetricValue(summary, metric),
          supportingData: {
            bucketsSold: summary.quantidadeBaldes,
            deliveryCount: summary.quantidadeEntregas,
            revenue: summary.faturamento,
            ...(financial.costsAvailable && !client ? { totalCosts: summary.custoTotal } : {}),
          },
        },
      },
    ];
  });
}

function countResults(results: readonly HomeSearchResult[]): HomeSearchDomainCounts {
  return results.reduce<HomeSearchDomainCounts>(
    (counts, result) => ({ ...counts, [result.type]: counts[result.type] + 1 }),
    { ...EMPTY_COUNTS },
  );
}

export class HomeSearchService {
  private latestRequest = 0;

  public constructor(private readonly dataSource: HomeSearchDataSource) {}

  public async search(original: string): Promise<HomeSearchResponse> {
    return this.searchParsed(homeSearchQueryParser.parse(original));
  }

  public async searchParsed(query: HomeSearchParsedQuery): Promise<HomeSearchResponse> {
    const request = ++this.latestRequest;
    const startedAt = Date.now();
    if (!query.normalized) {
      return {
        query,
        results: [],
        counts: { ...EMPTY_COUNTS },
        coverage: [],
        errors: [],
        durationMs: Date.now() - startedAt,
        stale: request !== this.latestRequest,
      };
    }

    const data = await this.dataSource.load(query);
    const globalDeliveries =
      data.globalDeliveries && data.globalDeliveries.length > 0
        ? data.globalDeliveries
        : data.deliveries;

    if (query.clientField) {
      const results = data.clients
        .map((client) => clientResult(client, [], query, globalDeliveries, data.financial))
        .filter((result): result is HomeSearchClientResult => result !== undefined)
        .sort(sortResults);
      return this.response(query, data, results, request, startedAt);
    }
    if (query.factoryMetric) {
      const results = factorySummaryResults(data, query);
      return this.response(query, data, results, request, startedAt);
    }
    if (query.routeMetric) {
      const results = routeSummaryResults(data, query);
      return this.response(query, data, results, request, startedAt);
    }
    if (query.carMetric) {
      const results = carSettingResults(data, query);
      return this.response(query, data, results, request, startedAt);
    }
    if (query.periodSummary) {
      const results = periodSummaryResults(data, query);
      return this.response(query, data, results, request, startedAt);
    }
    if (query.financialMetric) {
      const results = financialResults(data, query).sort(sortResults);
      return this.response(query, data, results, request, startedAt);
    }
    const clientsById = new Map(data.clients.map((client) => [client.clientId, client]));
    const clientsByName = new Map(data.clients.map((client) => [client.normalizedName, client]));
    const matchingDeliveries = data.deliveries.filter((delivery) =>
      matchesDeliveryFilters(
        delivery,
        query,
        clientForDelivery(delivery, clientsById, clientsByName),
      ),
    );
    const results: HomeSearchResult[] = [];

    data.clients.forEach((client) => {
      const result = clientResult(
        client,
        relatedDeliveriesForClient(client, matchingDeliveries),
        query,
        globalDeliveries,
        data.financial,
      );
      if (result) results.push(result);
    });
    matchingDeliveries.forEach((delivery) => {
      results.push(
        deliveryResult(delivery, clientForDelivery(delivery, clientsById, clientsByName), query),
      );
    });
    data.factoryPurchases
      .filter((receipt) => matchesFactoryFilters(receipt, query))
      .forEach((receipt) => results.push(factoryPurchaseResult(receipt, query)));

    results.sort(sortResults);
    return {
      query,
      results,
      counts: countResults(results),
      coverage: data.coverage,
      errors: data.errors,
      durationMs: Date.now() - startedAt,
      stale: request !== this.latestRequest,
    };
  }

  private response(
    query: HomeSearchParsedQuery,
    data: Awaited<ReturnType<HomeSearchDataSource['load']>>,
    results: HomeSearchResult[],
    request: number,
    startedAt: number,
  ): HomeSearchResponse {
    return {
      query,
      results,
      counts: countResults(results),
      coverage: data.coverage,
      errors: data.errors,
      durationMs: Date.now() - startedAt,
      stale: request !== this.latestRequest,
    };
  }
}
