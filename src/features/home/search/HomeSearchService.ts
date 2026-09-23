import { expenseCalculationService } from '@/services/expenses/ExpenseCalculationService';
import { factoryCalculationService } from '@/services/finance/FactoryCalculationService';
import { financialCalculationService } from '@/services/finance/FinancialCalculationService';
import { financialDailyDetailService } from '@/services/finance/FinancialDailyDetailService';
import { financialFiltersForSelection } from '@/services/finance/FinancialPeriodService';
import { parseKmPerLiter } from '@/services/expenses/FuelCostCalculationService';
import {
  summarizeConsolidatedKilometers,
  summarizeRouteDistance,
  summarizeRouteKilometersByDate,
} from '@/services/routes/routeTrackingDistance';
import { normalizeLegacyDate } from '@/utils/data';
import type {
  ClientId,
  ClientModel,
  Delivery,
  FactoryReceipt,
  FinancialPeriodSelection,
} from '@/types/data';

import {
  homeSearchFinancialMetricDefinition,
  homeSearchFinancialMetricIsAnalysisOnly,
  homeSearchFinancialMetricValue,
} from './HomeSearchFinancialMetrics';
import {
  averageValues,
  classifyTrend,
  percentageChange,
  previousComparablePeriod,
  safeDivide,
  sumValues,
} from './HomeSearchAnalysisMath';
import {
  appleIntelligenceSearchInterpreter,
  type HomeSearchSearchInterpreter,
} from './AppleIntelligenceSearchInterpreter';
import {
  homeSearchQueryParser,
  normalizeHomeSearchEntityText,
  normalizeHomeSearchText,
} from './HomeSearchQueryParser';
import {
  hasNaturalLanguageQuestionSignals,
  hasSemanticAnalysisSignals,
} from './HomeSearchSemanticValidator';
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
  HomeSearchAnalysisGroupBy,
  HomeSearchAnalysisOperation,
  HomeSearchAnalysisOrder,
  HomeSearchAnalysisPoint,
  HomeSearchAssistantResult,
  HomeSearchFinancialData,
  HomeSearchFinancialAnalysisComparison,
  HomeSearchFinancialMetric,
  HomeSearchFinancialMetricResult,
  HomeSearchFinancialReport,
  HomeSearchParsedQuery,
  HomeSearchPeriodSummaryResult,
  HomeSearchPeriod,
  HomeSearchRouteSummaryResult,
  HomeSearchResponse,
  HomeSearchResult,
  HomeSearchTemporalContext,
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
  assistant: 0,
};

function matchesPeriod(date: string, period: HomeSearchPeriod | undefined): boolean {
  if (!period) return true;
  if (period.kind === 'date') return date === period.date;
  if (period.kind === 'range') return date >= period.startDate && date <= period.endDate;
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
    assistant: -1,
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
  const rawSessions = data.routeSessions ?? [];
  const dailyExpenses = data.financial?.dailyExpenses ?? {};
  const consolidated = summarizeConsolidatedKilometers(rawSessions, dailyExpenses, (date) =>
    matchesPeriod(date, period),
  );
  const sessions = rawSessions.filter((session) => matchesPeriod(session.date, period));
  if (!period || !metric || (sessions.length === 0 && consolidated.manualKilometers === 0)) {
    return [];
  }
  const dailySummaries = new Map(
    [...new Set(sessions.map((session) => session.date))].map((date) => [
      date,
      summarizeRouteDistance(sessions.filter((session) => session.date === date)),
    ]),
  );
  const startTimestamp =
    sessions.length > 0 ? Math.min(...sessions.map((session) => session.startTimestamp)) : 0;
  const endTimestamp =
    sessions.length > 0 ? Math.max(...sessions.map((session) => session.endTimestamp)) : 0;
  const durationSeconds = sessions.reduce(
    (total, session) => total + Math.max(0, session.durationSeconds),
    0,
  );
  const pointsCount = sessions.reduce((total, session) => total + session.pointsCount, 0);
  const consideredDistanceKm =
    [...dailySummaries.values()].reduce((total, summary) => total + summary.totalKilometers, 0) +
    consolidated.manualKilometers;
  return [
    {
      type: 'routeSummary',
      id: `routeSummary:${query.normalized}`,
      title: 'Rota',
      score: 2_000,
      data: {
        period,
        metric,
        distanceKm: consolidated.totalKilometers,
        routeCount: consolidated.routeCount,
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
  const monthlyKeys = Object.keys(financial.monthlyExpenses).filter((month) => {
    if (period.kind === 'year') return month.startsWith(`${period.year}-`);
    if (period.kind === 'month') {
      return month === `${period.year}-${String(period.month).padStart(2, '0')}`;
    }
    if (period.kind === 'range') {
      const startMonth = period.startDate.slice(0, 7);
      const endMonth = period.endDate.slice(0, 7);
      return month >= startMonth && month <= endMonth;
    }
    return false;
  });
  const receipts = data.factoryPurchases.filter((receipt) => matchesPeriod(receipt.data, period));
  const rawSessions = data.routeSessions ?? [];
  const sessions = rawSessions.filter((session) => matchesPeriod(session.date, period));
  const consolidatedRoutes = summarizeConsolidatedKilometers(
    rawSessions,
    financial.dailyExpenses,
    (date) => matchesPeriod(date, period),
  );
  if (
    deliveries.length === 0 &&
    dailyDates.length === 0 &&
    monthlyKeys.length === 0 &&
    receipts.length === 0 &&
    sessions.length === 0 &&
    consolidatedRoutes.manualKilometers === 0
  )
    return [];
  const financialSummary = financialCalculationService.calculateResumo({
    deliveries: financial.deliveries,
    dailyExpenses: financial.dailyExpenses,
    filters: financialFiltersForSelection(financialSelection(period)),
    monthlyExpenses: financial.monthlyExpenses,
    automaticKilometersByDate: summarizeRouteKilometersByDate(sessions),
  });
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
          routeCount: consolidatedRoutes.routeCount,
          distanceKm: consolidatedRoutes.totalKilometers,
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
  if (period.kind === 'range')
    return { kind: 'range', start: period.startDate, end: period.endDate };
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

type FinancialAnalysisPoint = HomeSearchAnalysisPoint;
type HomeSearchLoadedData = Awaited<ReturnType<HomeSearchDataSource['load']>>;

const ANALYSIS_MONTH_NAMES = [
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

function normalizedAnalysisDate(value: string): string {
  return normalizeLegacyDate(value) ?? value;
}

function analysisDateLabel(value: string): string {
  const [year, month, day] = value.split('-');
  return day && month && year ? `${day}/${month}/${year}` : value;
}

function analysisMonthLabel(value: string): string {
  const [year, month] = value.split('-').map(Number);
  return Number.isInteger(year) && Number.isInteger(month)
    ? `${ANALYSIS_MONTH_NAMES[month - 1] ?? value} de ${year}`
    : value;
}

function analysisPeriodIncludesMonth(period: HomeSearchPeriod, month: string): boolean {
  if (period.kind === 'month') {
    return (
      `${period.year ?? new Date().getFullYear()}-${String(period.month).padStart(2, '0')}` ===
      month
    );
  }
  if (period.kind === 'year') return month.startsWith(`${period.year}-`);
  if (period.kind === 'range') {
    return month >= period.startDate.slice(0, 7) && month <= period.endDate.slice(0, 7);
  }
  return matchesPeriod(`${month}-01`, period);
}

function localDateFromISO(value: string): Date | undefined {
  const [year, month, day] = value.split('-').map(Number);
  if (![year, month, day].every(Number.isInteger)) return undefined;
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : undefined;
}

function formatAnalysisDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function periodMonthKeys(period: HomeSearchPeriod): string[] {
  if (period.kind === 'month') {
    return [`${period.year ?? new Date().getFullYear()}-${String(period.month).padStart(2, '0')}`];
  }
  if (period.kind === 'year') {
    return Array.from(
      { length: 12 },
      (_, index) => `${period.year}-${String(index + 1).padStart(2, '0')}`,
    );
  }
  if (period.kind === 'date') return [period.date.slice(0, 7)];
  if (period.kind === 'dayMonth') {
    return [`${new Date().getFullYear()}-${String(period.month).padStart(2, '0')}`];
  }
  const start = localDateFromISO(period.startDate);
  const end = localDateFromISO(period.endDate);
  if (!start || !end) return [];
  const months: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1, 12);
  const lastMonth = new Date(end.getFullYear(), end.getMonth(), 1, 12);
  while (cursor <= lastMonth) {
    months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

function periodForWeek(startDate: string): HomeSearchPeriod {
  const start = localDateFromISO(startDate) ?? new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { kind: 'range', startDate, endDate: formatAnalysisDate(end) };
}

function analysisPeriodBounds(period: HomeSearchPeriod): [string, string] | undefined {
  if (period.kind === 'date') return [period.date, period.date];
  if (period.kind === 'dayMonth') return undefined;
  if (period.kind === 'month') {
    const year = period.year ?? new Date().getFullYear();
    const startDate = `${year}-${String(period.month).padStart(2, '0')}-01`;
    return [startDate, formatAnalysisDate(new Date(year, period.month, 0, 12))];
  }
  if (period.kind === 'year') return [`${period.year}-01-01`, `${period.year}-12-31`];
  return [period.startDate, period.endDate];
}

function restrictAnalysisPeriod(
  period: HomeSearchPeriod,
  candidate: HomeSearchPeriod,
): HomeSearchPeriod {
  const periodBounds = analysisPeriodBounds(period);
  const candidateBounds = analysisPeriodBounds(candidate);
  if (!periodBounds || !candidateBounds) return candidate;
  const startDate = periodBounds[0] > candidateBounds[0] ? periodBounds[0] : candidateBounds[0];
  const endDate = periodBounds[1] < candidateBounds[1] ? periodBounds[1] : candidateBounds[1];
  if (startDate === candidateBounds[0] && endDate === candidateBounds[1]) return candidate;
  return { kind: 'range', startDate, endDate };
}

function routeDistanceForPeriod(data: HomeSearchLoadedData, period: HomeSearchPeriod): number {
  const sessions = (data.routeSessions ?? []).filter((session) =>
    matchesPeriod(session.date, period),
  );
  const consolidated = summarizeConsolidatedKilometers(
    sessions,
    data.financial?.dailyExpenses ?? {},
    (date) => matchesPeriod(date, period),
  );
  return consolidated.totalKilometers;
}

function factoryCostForPeriod(data: HomeSearchLoadedData, period: HomeSearchPeriod): number {
  return sumValues(
    data.factoryPurchases
      .filter((receipt) => matchesPeriod(receipt.data, period))
      .map((receipt) => receipt.valorTotal),
  );
}

function summaryForAnalysisPeriod(
  financial: HomeSearchFinancialData,
  data: HomeSearchLoadedData,
  period: HomeSearchPeriod,
  client?: { clientId?: ClientId; label: string },
): ReturnType<typeof financialCalculationService.calculateResumo> {
  const filters = {
    ...financialFiltersForSelection(financialSelection(period)),
    ...(client?.clientId
      ? { clientId: client.clientId, buscaCliente: client.label }
      : client
        ? { buscaCliente: client.label }
        : {}),
  };
  return financialCalculationService.calculateResumo({
    deliveries: financial.deliveries,
    dailyExpenses: financial.dailyExpenses,
    filters,
    fullLightInterval: period.kind === 'range',
    monthlyExpenses: financial.monthlyExpenses,
    automaticKilometersByDate: summarizeRouteKilometersByDate(data.routeSessions ?? []),
  });
}

function financialDataForAnalysis(
  financial: HomeSearchFinancialData,
  data: HomeSearchLoadedData,
  query: HomeSearchParsedQuery,
): HomeSearchFinancialData {
  const filters = query.analysis?.filters;
  const paymentStatus = filters?.paymentStatus ?? query.paymentStatus;
  const documentType = filters?.documentType ?? query.documentType;
  if (!paymentStatus && !documentType) return financial;

  const clientsById = new Map(data.clients.map((client) => [client.clientId, client]));
  const clientsByName = new Map(data.clients.map((client) => [client.normalizedName, client]));
  const deliveries = financial.deliveries.filter((delivery) => {
    const client = clientForDelivery(delivery, clientsById, clientsByName);
    if (paymentStatus) {
      const paid = normalizeHomeSearchText(delivery.status) === 'pago';
      if (paymentStatus === 'paid' ? !paid : paid) return false;
    }
    return !documentType || deliveryFacets(delivery, client).includes(documentType);
  });
  return { ...financial, deliveries };
}

function analysisValue(
  summary: ReturnType<typeof financialCalculationService.calculateResumo>,
  metric: HomeSearchFinancialMetric,
  context: { distanceKm?: number; factoryCost?: number } = {},
): number {
  return homeSearchFinancialMetricValue(summary, metric, context);
}

function analysisPeriodMetricValue(
  financial: HomeSearchFinancialData,
  data: HomeSearchLoadedData,
  period: HomeSearchPeriod,
  metric: HomeSearchFinancialMetric,
): number {
  if (metric === 'distanceKm') return routeDistanceForPeriod(data, period);
  if (metric === 'factoryCost') return factoryCostForPeriod(data, period);
  const summary = summaryForAnalysisPeriod(financial, data, period);
  return analysisValue(summary, metric, {
    distanceKm: routeDistanceForPeriod(data, period),
    factoryCost: factoryCostForPeriod(data, period),
  });
}

function financialAnalysisPointsByDay(
  financial: HomeSearchFinancialData,
  data: Awaited<ReturnType<HomeSearchDataSource['load']>>,
  period: HomeSearchPeriod,
  metric: HomeSearchFinancialMetric,
): FinancialAnalysisPoint[] {
  const months = new Set<string>();
  financial.deliveries.forEach((delivery) =>
    months.add(normalizedAnalysisDate(delivery.data).slice(0, 7)),
  );
  Object.keys(financial.dailyExpenses).forEach((date) =>
    months.add(normalizedAnalysisDate(date).slice(0, 7)),
  );
  (data.routeSessions ?? []).forEach((session) =>
    months.add(normalizedAnalysisDate(session.date).slice(0, 7)),
  );
  periodMonthKeys(period).forEach((month) => months.add(month));

  return [...months]
    .filter((month) => analysisPeriodIncludesMonth(period, month))
    .flatMap((month) =>
      financialDailyDetailService.buildMonth(
        {
          dailyExpenses: financial.dailyExpenses,
          deliveries: financial.deliveries,
          monthlyExpenses: financial.monthlyExpenses,
          routeSessions: data.routeSessions ?? [],
        },
        month,
      ),
    )
    .filter((detail) => matchesPeriod(detail.date, period))
    .map((detail) => ({
      key: detail.date,
      label: `Dia ${analysisDateLabel(detail.date)}`,
      value: analysisValue(detail.summary, metric, { distanceKm: detail.totalKilometers }),
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function financialAnalysisPointsByMonth(
  financial: HomeSearchFinancialData,
  data: Awaited<ReturnType<HomeSearchDataSource['load']>>,
  period: HomeSearchPeriod,
  metric: HomeSearchFinancialMetric,
): FinancialAnalysisPoint[] {
  const months = new Set<string>();
  financial.deliveries.forEach((delivery) =>
    months.add(normalizedAnalysisDate(delivery.data).slice(0, 7)),
  );
  Object.keys(financial.dailyExpenses).forEach((date) =>
    months.add(normalizedAnalysisDate(date).slice(0, 7)),
  );
  Object.keys(financial.monthlyExpenses).forEach((month) => months.add(month.slice(0, 7)));
  (data.routeSessions ?? []).forEach((session) =>
    months.add(normalizedAnalysisDate(session.date).slice(0, 7)),
  );
  periodMonthKeys(period).forEach((month) => months.add(month));

  return [...months]
    .filter((month) => analysisPeriodIncludesMonth(period, month))
    .sort()
    .map((month) => {
      const [year, monthNumber] = month.split('-').map(Number);
      const monthPeriod: HomeSearchPeriod = { kind: 'month', month: monthNumber, year };
      const scopedPeriod = restrictAnalysisPeriod(period, monthPeriod);
      const summary = summaryForAnalysisPeriod(financial, data, scopedPeriod);
      return {
        key: month,
        label: analysisMonthLabel(month),
        value: analysisValue(summary, metric, {
          distanceKm: routeDistanceForPeriod(data, scopedPeriod),
        }),
      };
    });
}

function financialAnalysisPointsByClient(
  financial: HomeSearchFinancialData,
  data: Awaited<ReturnType<HomeSearchDataSource['load']>>,
  period: HomeSearchPeriod,
  metric: HomeSearchFinancialMetric,
): FinancialAnalysisPoint[] {
  const clientsById = new Map(data.clients.map((client) => [client.clientId, client]));
  const clientsByName = new Map(data.clients.map((client) => [client.normalizedName, client]));
  const groups = new Map<string, { clientId?: ClientId; deliveries: Delivery[]; label: string }>();

  financial.deliveries
    .filter((delivery) => matchesPeriod(delivery.data, period))
    .forEach((delivery) => {
      const client = clientForDelivery(delivery, clientsById, clientsByName);
      const key = client?.clientId ?? normalizeHomeSearchText(delivery.cliente);
      const group = groups.get(key) ?? {
        ...(client?.clientId ? { clientId: client.clientId } : {}),
        deliveries: [],
        label: client?.canonicalName ?? delivery.cliente,
      };
      group.deliveries.push(delivery);
      groups.set(key, group);
    });

  const automaticKilometersByDate = summarizeRouteKilometersByDate(data.routeSessions ?? []);
  return [...groups.entries()]
    .map(([key, group]) => {
      const filters = {
        ...financialFiltersForSelection(financialSelection(period)),
        ...(group.clientId
          ? { clientId: group.clientId, buscaCliente: group.label }
          : { buscaCliente: group.label }),
      };
      const summary = financialCalculationService.calculateResumo({
        deliveries: financial.deliveries,
        dailyExpenses: financial.dailyExpenses,
        filters,
        monthlyExpenses: financial.monthlyExpenses,
        automaticKilometersByDate,
      });
      return {
        key,
        label: group.label,
        value: analysisValue(summary, metric),
        ...(group.clientId ? { clientId: group.clientId } : {}),
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'));
}

function financialAnalysisPointsByClientPrice(
  data: HomeSearchLoadedData,
): FinancialAnalysisPoint[] {
  return data.clients
    .filter((client) => client.currentPrice !== undefined && Number.isFinite(client.currentPrice))
    .map((client) => ({
      key: client.clientId,
      label: client.canonicalName,
      value: client.currentPrice!,
      clientId: client.clientId,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'));
}

function analysisWeekKey(value: string): string {
  const date = localDateFromISO(value) ?? new Date();
  date.setDate(date.getDate() - date.getDay());
  return formatAnalysisDate(date);
}

function analysisDateKeys(
  financial: HomeSearchFinancialData,
  data: HomeSearchLoadedData,
  period: HomeSearchPeriod,
): string[] {
  return [
    ...new Set([
      ...financial.deliveries.map((delivery) => normalizedAnalysisDate(delivery.data)),
      ...Object.keys(financial.dailyExpenses).map(normalizedAnalysisDate),
      ...(data.routeSessions ?? []).map((session) => normalizedAnalysisDate(session.date)),
    ]),
  ]
    .filter((date) => matchesPeriod(date, period))
    .sort();
}

function financialAnalysisPointsByWeek(
  financial: HomeSearchFinancialData,
  data: HomeSearchLoadedData,
  period: HomeSearchPeriod,
  metric: HomeSearchFinancialMetric,
): FinancialAnalysisPoint[] {
  const weeks = new Set(analysisDateKeys(financial, data, period).map(analysisWeekKey));
  return [...weeks].sort().map((week) => {
    const weekPeriod = restrictAnalysisPeriod(period, periodForWeek(week));
    const summary = summaryForAnalysisPeriod(financial, data, weekPeriod);
    return {
      key: week,
      label: `Semana de ${analysisDateLabel(week)}`,
      value: analysisValue(summary, metric, {
        distanceKm: routeDistanceForPeriod(data, weekPeriod),
      }),
    };
  });
}

function financialAnalysisPointsByYear(
  financial: HomeSearchFinancialData,
  data: HomeSearchLoadedData,
  period: HomeSearchPeriod,
  metric: HomeSearchFinancialMetric,
): FinancialAnalysisPoint[] {
  const years = new Set<number>();
  financial.deliveries.forEach((delivery) => {
    const year = Number(normalizedAnalysisDate(delivery.data).slice(0, 4));
    if (Number.isInteger(year)) years.add(year);
  });
  Object.keys(financial.dailyExpenses).forEach((date) => {
    const year = Number(normalizedAnalysisDate(date).slice(0, 4));
    if (Number.isInteger(year)) years.add(year);
  });
  Object.keys(financial.monthlyExpenses).forEach((month) => {
    const year = Number(month.slice(0, 4));
    if (Number.isInteger(year)) years.add(year);
  });
  (data.routeSessions ?? []).forEach((session) => {
    const year = Number(normalizedAnalysisDate(session.date).slice(0, 4));
    if (Number.isInteger(year)) years.add(year);
  });
  if (period.kind === 'year') years.add(period.year);
  if (period.kind === 'month' && period.year !== undefined) years.add(period.year);
  if (period.kind === 'range') {
    const startYear = Number(period.startDate.slice(0, 4));
    const endYear = Number(period.endDate.slice(0, 4));
    for (let year = startYear; year <= endYear; year += 1) years.add(year);
  }

  return [...years]
    .sort((left, right) => left - right)
    .flatMap((year) => {
      const yearPeriod: HomeSearchPeriod = { kind: 'year', year };
      const scopedPeriod = restrictAnalysisPeriod(period, yearPeriod);
      if (scopedPeriod.kind === 'range' && scopedPeriod.startDate > scopedPeriod.endDate) {
        return [];
      }
      const value =
        metric === 'distanceKm'
          ? routeDistanceForPeriod(data, scopedPeriod)
          : metric === 'factoryCost'
            ? factoryCostForPeriod(data, scopedPeriod)
            : analysisValue(summaryForAnalysisPeriod(financial, data, scopedPeriod), metric, {
                distanceKm: routeDistanceForPeriod(data, scopedPeriod),
              });
      return [{ key: String(year), label: `Ano ${year}`, value }];
    });
}

function financialAnalysisPointsByRoute(
  data: HomeSearchLoadedData,
  period: HomeSearchPeriod,
  metric: HomeSearchFinancialMetric,
): FinancialAnalysisPoint[] {
  if (metric !== 'distanceKm') return [];
  return (data.routeSessions ?? [])
    .filter((session) => matchesPeriod(session.date, period))
    .map((session) => ({
      key: session.id,
      label: `Rota ${analysisDateLabel(normalizedAnalysisDate(session.date))}`,
      value: session.distanceMeters / 1_000,
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function factoryAnalysisValue(
  receipt: FactoryReceipt,
  metric: HomeSearchFinancialMetric,
): number | undefined {
  if (metric === 'factoryCost') return receipt.valorTotal;
  if (metric === 'bucketsSold') return receipt.quantidade;
  if (metric === 'received') return factoryCalculationService.totalPaid(receipt);
  if (metric === 'receivable') return factoryCalculationService.openValue(receipt);
  return undefined;
}

function financialAnalysisPointsByFactory(
  data: HomeSearchLoadedData,
  period: HomeSearchPeriod,
  metric: HomeSearchFinancialMetric,
  factoryStatus?: HomeSearchParsedQuery['factoryStatus'],
): FinancialAnalysisPoint[] {
  return data.factoryPurchases
    .filter((receipt) => matchesPeriod(receipt.data, period))
    .filter((receipt) => matchesFactoryStatus(receipt, factoryStatus))
    .flatMap((receipt) => {
      const value = factoryAnalysisValue(receipt, metric);
      return value === undefined
        ? []
        : [
            {
              key: receipt.id,
              label: `Compra ${analysisDateLabel(normalizedAnalysisDate(receipt.data))}`,
              value,
            },
          ];
    })
    .sort((left, right) => left.key.localeCompare(right.key));
}

function financialAnalysisPoints(
  financial: HomeSearchFinancialData,
  data: HomeSearchLoadedData,
  period: HomeSearchPeriod,
  groupBy: HomeSearchAnalysisGroupBy,
  metric: HomeSearchFinancialMetric,
  factoryStatus?: HomeSearchParsedQuery['factoryStatus'],
): FinancialAnalysisPoint[] {
  if (groupBy === 'day') return financialAnalysisPointsByDay(financial, data, period, metric);
  if (groupBy === 'month') return financialAnalysisPointsByMonth(financial, data, period, metric);
  if (groupBy === 'week') return financialAnalysisPointsByWeek(financial, data, period, metric);
  if (groupBy === 'year') return financialAnalysisPointsByYear(financial, data, period, metric);
  if (groupBy === 'route') return financialAnalysisPointsByRoute(data, period, metric);
  if (groupBy === 'factory') {
    return financialAnalysisPointsByFactory(data, period, metric, factoryStatus);
  }
  return financialAnalysisPointsByClient(financial, data, period, metric);
}

function analysisPeriodResultLabel(
  operation: HomeSearchAnalysisOperation,
  groupBy: HomeSearchAnalysisGroupBy,
  metric: HomeSearchFinancialMetric,
): string {
  const operationLabels: Record<HomeSearchAnalysisOperation, string> = {
    max: 'Maior',
    min: 'Menor',
    compare: 'Comparação',
    sum: 'Soma',
    average: 'Média',
    rank: 'Ranking',
    topN: 'Top',
    percentageChange: 'Variação',
    ratio: 'Razão',
    trend: 'Tendência',
    report: 'Relatório',
  };
  const groupLabels: Record<HomeSearchAnalysisGroupBy, string> = {
    day: 'diário',
    week: 'semanal',
    year: 'anual',
    client: 'por cliente',
    month: 'mensal',
    route: 'por rota',
    factory: 'por compra da fábrica',
  };
  const operationLabel = operationLabels[operation];
  const groupLabel = groupLabels[groupBy];
  return `${operationLabel} ${homeSearchFinancialMetricDefinition(metric).label.toLowerCase()} ${groupLabel}`;
}

function analysisSupportsGroupBy(
  metric: HomeSearchFinancialMetric,
  groupBy: HomeSearchAnalysisGroupBy,
): boolean {
  if (groupBy === 'route') return metric === 'distanceKm';
  if (groupBy === 'factory') {
    return ['factoryCost', 'bucketsSold', 'received', 'receivable'].includes(metric);
  }
  if (metric === 'factoryCost') return false;
  if (['distanceKm', 'profitPerKm', 'revenuePerKm', 'costPerKm'].includes(metric)) {
    return groupBy !== 'client';
  }
  return true;
}

function analysisClientMetricSupported(metric: HomeSearchFinancialMetric): boolean {
  return ![
    'distanceKm',
    'factoryCost',
    'profitPerKm',
    'revenuePerKm',
    'costPerKm',
    'otherCosts',
  ].includes(metric);
}

function analysisPeriodLabel(period: HomeSearchPeriod): string {
  if (period.kind === 'month') {
    return analysisMonthLabel(
      `${period.year ?? new Date().getFullYear()}-${String(period.month).padStart(2, '0')}`,
    );
  }
  if (period.kind === 'date') return analysisDateLabel(period.date);
  if (period.kind === 'dayMonth') {
    return `${period.day}/${String(period.month).padStart(2, '0')}`;
  }
  if (period.kind === 'year') return `Ano ${period.year}`;
  return `${analysisDateLabel(period.startDate)} a ${analysisDateLabel(period.endDate)}`;
}

function unavailableAnalysisResult(
  query: HomeSearchParsedQuery,
  reason: NonNullable<HomeSearchFinancialMetricResult['data']['unavailableReason']>,
): HomeSearchFinancialMetricResult[] {
  const metric = query.financialMetric ?? 'revenue';
  const definition = homeSearchFinancialMetricDefinition(metric);
  const analysis = query.analysis;
  return [
    {
      type: 'financialMetric',
      id: `financialAnalysis:unavailable:${metric}:${query.normalized}`,
      title: analysis
        ? analysisPeriodResultLabel(analysis.operation, analysis.groupBy, metric)
        : definition.label,
      score: 2_200,
      data: {
        available: false,
        metric,
        unit: definition.unit,
        ...(query.period ? { period: query.period } : {}),
        unavailableReason: reason,
        ...(analysis
          ? {
              analysis: {
                ...analysis,
                ...(query.period ? { period: query.period } : {}),
              },
            }
          : {}),
      },
      relations: {},
    },
  ];
}

function financialAnalysisMetricResult(
  query: HomeSearchParsedQuery,
  value: number,
  analysis: NonNullable<HomeSearchFinancialMetricResult['data']['analysis']>,
  title = analysisPeriodResultLabel(analysis.operation, analysis.groupBy, query.financialMetric!),
  clientId?: ClientId,
): HomeSearchFinancialMetricResult {
  const metric = query.financialMetric!;
  const definition = homeSearchFinancialMetricDefinition(metric);
  return {
    type: 'financialMetric',
    id: `financialAnalysis:${metric}:${analysis.operation}:${analysis.groupBy}:${query.normalized}`,
    title,
    score: 2_200,
    data: {
      available: true,
      metric,
      unit: definition.unit,
      ...(query.period ? { period: query.period } : {}),
      value,
      analysis,
    },
    relations: { ...(clientId ? { clientId } : {}) },
  };
}

function sortAnalysisPoints(
  points: readonly FinancialAnalysisPoint[],
  direction: 'ascending' | 'descending' = 'descending',
): FinancialAnalysisPoint[] {
  return [...points].sort((left, right) => {
    const valueOrder =
      direction === 'descending' ? right.value - left.value : left.value - right.value;
    return valueOrder || left.key.localeCompare(right.key);
  });
}

function analysisComparison(
  initialPeriod: HomeSearchPeriod,
  initialValue: number,
  finalPeriod: HomeSearchPeriod,
  finalValue: number,
): HomeSearchFinancialAnalysisComparison {
  return {
    initialPeriod,
    initialValue,
    finalPeriod,
    finalValue,
    absoluteChange: finalValue - initialValue,
    percentageChange: percentageChange(finalValue, initialValue),
  };
}

function hasFinancialDataForPeriod(
  financial: HomeSearchFinancialData,
  data: HomeSearchLoadedData,
  period: HomeSearchPeriod,
): boolean {
  return (
    financial.deliveries.some((delivery) => matchesPeriod(delivery.data, period)) ||
    Object.keys(financial.dailyExpenses).some((date) => matchesPeriod(date, period)) ||
    Object.keys(financial.monthlyExpenses).some((month) =>
      analysisPeriodIncludesMonth(period, month.slice(0, 7)),
    ) ||
    (data.routeSessions ?? []).some((session) => matchesPeriod(session.date, period))
  );
}

function financialReportForPeriod(
  financial: HomeSearchFinancialData,
  data: HomeSearchLoadedData,
  period: HomeSearchPeriod,
): HomeSearchFinancialReport {
  const summary = summaryForAnalysisPeriod(financial, data, period);
  const dayPoints = financialAnalysisPointsByDay(financial, data, period, 'revenue');
  const clientPoints = financialAnalysisPointsByClient(financial, data, period, 'revenue');
  const receipts = data.factoryPurchases.filter((receipt) => matchesPeriod(receipt.data, period));
  const previousPeriod = previousComparablePeriod(period);
  const previousReport =
    previousPeriod && hasFinancialDataForPeriod(financial, data, previousPeriod)
      ? summaryForAnalysisPeriod(financial, data, previousPeriod)
      : undefined;
  const revenue = summary.faturamento;
  const netProfit = summary.lucroLiquido;
  return {
    period,
    revenue,
    netProfit,
    totalCost: summary.custoTotal,
    bucketsSold: summary.quantidadeBaldes,
    deliveryCount: summary.quantidadeEntregas,
    received: summary.valoresPagos,
    receivable: summary.valoresPendentes,
    ...(receipts.length > 0
      ? { factoryCost: sumValues(receipts.map((receipt) => receipt.valorTotal)) }
      : {}),
    ...(data.routeSessions ? { distanceKm: routeDistanceForPeriod(data, period) } : {}),
    fuelCost: summary.custoCombustivel,
    ...(dayPoints.length > 0
      ? {
          bestDay: sortAnalysisPoints(dayPoints, 'descending')[0],
          worstDay: sortAnalysisPoints(dayPoints, 'ascending')[0],
        }
      : {}),
    ...(clientPoints.length > 0 ? { topClient: sortAnalysisPoints(clientPoints)[0] } : {}),
    ...(previousPeriod && previousReport
      ? {
          previousPeriod: {
            period: previousPeriod,
            revenue: previousReport.faturamento,
            netProfit: previousReport.lucroLiquido,
            revenueChange: analysisComparison(
              previousPeriod,
              previousReport.faturamento,
              period,
              revenue,
            ),
            netProfitChange: analysisComparison(
              previousPeriod,
              previousReport.lucroLiquido,
              period,
              netProfit,
            ),
          },
        }
      : {}),
  };
}

function financialReportResults(
  data: HomeSearchLoadedData,
  query: HomeSearchParsedQuery,
): HomeSearchFinancialMetricResult[] {
  const financial = data.financial;
  const period = query.period;
  if (!financial || !period) return unavailableAnalysisResult(query, 'insufficientData');
  if (!financial.costsAvailable) return unavailableAnalysisResult(query, 'sourceUnavailable');
  const report = financialReportForPeriod(
    financialDataForAnalysis(financial, data, query),
    data,
    period,
  );
  return [
    financialAnalysisMetricResult(
      query,
      report.revenue,
      {
        operation: 'report',
        groupBy: query.analysis?.groupBy ?? 'month',
        period,
        report,
      },
      `Relatório de ${analysisPeriodLabel(period)}`,
    ),
  ];
}

function financialAnalysisResults(
  data: HomeSearchLoadedData,
  query: HomeSearchParsedQuery,
): HomeSearchFinancialMetricResult[] {
  const period = query.period;
  const analysis = query.analysis;
  const metric = query.financialMetric;
  if (!analysis || !metric) return [];

  const definition = homeSearchFinancialMetricDefinition(metric);
  const factoryStatus = analysis.filters?.factoryStatus ?? query.factoryStatus;
  const baseAnalysis = {
    groupBy: analysis.groupBy,
    operation: analysis.operation,
    ...(analysis.order ? { order: analysis.order } : {}),
    ...(analysis.limit !== undefined ? { limit: analysis.limit } : {}),
    ...(analysis.numeratorMetric ? { numeratorMetric: analysis.numeratorMetric } : {}),
    ...(analysis.denominatorMetric ? { denominatorMetric: analysis.denominatorMetric } : {}),
    ...(analysis.secondaryMetric ? { secondaryMetric: analysis.secondaryMetric } : {}),
    ...(analysis.filters ? { filters: analysis.filters } : {}),
    ...(period ? { period } : {}),
  };

  if (analysis.groupBy === 'client' && !analysisClientMetricSupported(metric)) {
    return unavailableAnalysisResult(query, 'unsupportedMetric');
  }
  if (!analysisSupportsGroupBy(metric, analysis.groupBy)) {
    return unavailableAnalysisResult(query, 'unsupportedGroupBy');
  }
  if (
    ['compare', 'percentageChange', 'report'].includes(analysis.operation) &&
    analysis.groupBy !== 'month'
  ) {
    return unavailableAnalysisResult(query, 'unsupportedGroupBy');
  }
  if (analysis.operation === 'report') return financialReportResults(data, query);
  if (analysis.operation === 'topN' && (!analysis.limit || analysis.limit < 1)) {
    return unavailableAnalysisResult(query, 'unsupportedMetric');
  }

  if (metric === 'bucketPrice') {
    if (analysis.groupBy !== 'client' || analysis.operation === 'compare') {
      return unavailableAnalysisResult(query, 'unsupportedMetric');
    }
    const points = financialAnalysisPointsByClientPrice(data);
    if (points.length === 0) return unavailableAnalysisResult(query, 'insufficientData');
    return analysisPointOperationResult(query, points, baseAnalysis);
  }

  const financial = data.financial;
  if (!period) return unavailableAnalysisResult(query, 'insufficientData');
  const requiresFinancialData =
    !['route', 'factory'].includes(analysis.groupBy) ||
    ['compare', 'percentageChange', 'ratio'].includes(analysis.operation);
  if (requiresFinancialData && !financial) {
    return unavailableAnalysisResult(query, 'sourceUnavailable');
  }
  if (requiresFinancialData && definition.requiresCosts && !financial?.costsAvailable) {
    return unavailableAnalysisResult(query, 'sourceUnavailable');
  }
  const analysisFinancial: HomeSearchFinancialData = financial
    ? financialDataForAnalysis(financial, data, query)
    : {
        costsAvailable: true,
        dailyExpenses: {},
        deliveries: [],
        monthlyExpenses: {},
      };

  if (analysis.operation === 'compare') {
    const comparisonPeriods = analysis.comparisonPeriods;
    if (!comparisonPeriods) return unavailableAnalysisResult(query, 'insufficientData');
    const comparisons = comparisonPeriods.map((comparisonPeriod, index) => {
      return {
        key: `${comparisonPeriod.kind}-${index}`,
        label: analysisPeriodLabel(comparisonPeriod),
        value: analysisPeriodMetricValue(analysisFinancial, data, comparisonPeriod, metric),
      };
    });
    return [
      financialAnalysisMetricResult(query, comparisons.at(-1)?.value ?? 0, {
        ...baseAnalysis,
        comparisons,
      }),
    ];
  }

  if (analysis.operation === 'percentageChange') {
    const comparisonPeriods = analysis.comparisonPeriods;
    if (!comparisonPeriods) return unavailableAnalysisResult(query, 'insufficientData');
    const initialValue = analysisPeriodMetricValue(
      analysisFinancial,
      data,
      comparisonPeriods[0],
      metric,
    );
    const finalValue = analysisPeriodMetricValue(
      analysisFinancial,
      data,
      comparisonPeriods[1],
      metric,
    );
    const comparison = analysisComparison(
      comparisonPeriods[0],
      initialValue,
      comparisonPeriods[1],
      finalValue,
    );
    return [financialAnalysisMetricResult(query, finalValue, { ...baseAnalysis, comparison })];
  }

  if (analysis.operation === 'ratio') {
    if (!analysis.numeratorMetric || !analysis.denominatorMetric) {
      return unavailableAnalysisResult(query, 'unsupportedMetric');
    }
    if (
      analysis.numeratorMetric === 'bucketPrice' ||
      analysis.denominatorMetric === 'bucketPrice'
    ) {
      return unavailableAnalysisResult(query, 'unsupportedMetric');
    }
    const numerator = analysisPeriodMetricValue(
      analysisFinancial,
      data,
      period,
      analysis.numeratorMetric,
    );
    const denominator = analysisPeriodMetricValue(
      analysisFinancial,
      data,
      period,
      analysis.denominatorMetric,
    );
    if (analysis.groupBy === 'month') {
      return [
        financialAnalysisMetricResult(query, safeDivide(numerator, denominator), {
          ...baseAnalysis,
          aggregateValue: safeDivide(numerator, denominator),
          ratio: { numerator, denominator },
        }),
      ];
    }
    const numeratorPoints = financialAnalysisPoints(
      analysisFinancial,
      data,
      period,
      analysis.groupBy,
      analysis.numeratorMetric,
      factoryStatus,
    );
    const denominatorPoints = financialAnalysisPoints(
      analysisFinancial,
      data,
      period,
      analysis.groupBy,
      analysis.denominatorMetric,
      factoryStatus,
    );
    const denominatorByKey = new Map(denominatorPoints.map((point) => [point.key, point]));
    const ratioPoints = numeratorPoints.flatMap((point) => {
      const denominatorPoint = denominatorByKey.get(point.key);
      return denominatorPoint
        ? [{ ...point, value: safeDivide(point.value, denominatorPoint.value) }]
        : [];
    });
    if (ratioPoints.length === 0) return unavailableAnalysisResult(query, 'insufficientData');
    const aggregateValue = averageValues(ratioPoints.map((point) => point.value));
    return [
      financialAnalysisMetricResult(query, aggregateValue, {
        ...baseAnalysis,
        aggregateValue,
        ratio: { numerator, denominator },
        ranking: ratioPoints,
      }),
    ];
  }

  let points = financialAnalysisPoints(
    analysisFinancial,
    data,
    period,
    analysis.groupBy,
    metric,
    factoryStatus,
  );
  if (points.length === 0) return unavailableAnalysisResult(query, 'insufficientData');
  if (analysis.secondaryMetric) {
    const secondaryPoints = financialAnalysisPoints(
      analysisFinancial,
      data,
      period,
      analysis.groupBy,
      analysis.secondaryMetric,
      factoryStatus,
    );
    const secondaryByKey = new Map(secondaryPoints.map((point) => [point.key, point.value]));
    points = points.map((point) => {
      const secondaryValue = secondaryByKey.get(point.key);
      return secondaryValue === undefined ? point : { ...point, secondaryValue };
    });
  }

  if (analysis.operation === 'sum') {
    const aggregateValue = sumValues(points.map((point) => point.value));
    return [
      financialAnalysisMetricResult(query, aggregateValue, { ...baseAnalysis, aggregateValue }),
    ];
  }
  if (analysis.operation === 'average') {
    const aggregateValue = averageValues(points.map((point) => point.value));
    return [
      financialAnalysisMetricResult(query, aggregateValue, { ...baseAnalysis, aggregateValue }),
    ];
  }
  if (analysis.operation === 'trend') {
    const direction = classifyTrend(points);
    return [
      financialAnalysisMetricResult(query, points.at(-1)?.value ?? 0, {
        ...baseAnalysis,
        trend: { direction, points },
      }),
    ];
  }
  return analysisPointOperationResult(query, points, baseAnalysis);
}

function analysisPointOperationResult(
  query: HomeSearchParsedQuery,
  points: readonly FinancialAnalysisPoint[],
  baseAnalysis: NonNullable<HomeSearchFinancialMetricResult['data']['analysis']>,
): HomeSearchFinancialMetricResult[] {
  const operation = query.analysis!.operation;
  if (operation === 'rank' || operation === 'topN') {
    const order: HomeSearchAnalysisOrder = query.analysis!.order ?? 'descending';
    const ranking = sortAnalysisPoints(points, order).map((point, index) => ({
      ...point,
      rank: index + 1,
    }));
    const limited = operation === 'topN' ? ranking.slice(0, query.analysis!.limit) : ranking;
    const first = limited[0];
    const rankingLabel =
      operation === 'topN'
        ? `${order === 'ascending' ? 'Menores' : 'Top'} ${limited.length} ${query.analysis!.groupBy}`
        : 'Ranking';
    return [
      financialAnalysisMetricResult(
        query,
        first?.value ?? 0,
        { ...baseAnalysis, ...(first ? { winner: first } : {}), ranking: limited },
        rankingLabel,
        first?.clientId,
      ),
    ];
  }
  const direction = operation === 'min' ? 'ascending' : 'descending';
  const ordered = sortAnalysisPoints(points, direction);
  const winner = ordered[0];
  if (!winner) return unavailableAnalysisResult(query, 'insufficientData');
  return [
    financialAnalysisMetricResult(
      query,
      winner.value,
      { ...baseAnalysis, winner },
      winner.label,
      winner.clientId,
    ),
  ];
}

function financialResults(
  data: Awaited<ReturnType<HomeSearchDataSource['load']>>,
  query: HomeSearchParsedQuery,
): HomeSearchFinancialMetricResult[] {
  const financial = data.financial;
  const period = query.period;
  const requestedMetric = query.financialMetric;
  if (!financial || !period || !requestedMetric || requestedMetric === 'bucketPrice') return [];
  if (homeSearchFinancialMetricIsAnalysisOnly(requestedMetric)) {
    return unavailableAnalysisResult(query, 'unsupportedMetric');
  }

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
    if (period.kind === 'year') return month.startsWith(`${period.year}-`);
    if (period.kind === 'range') {
      const startMonth = period.startDate.slice(0, 7);
      const endMonth = period.endDate.slice(0, 7);
      return month >= startMonth && month <= endMonth;
    }
    return false;
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

function assistantResult(query: HomeSearchParsedQuery): HomeSearchAssistantResult[] {
  if (!query.assistantStatus) return [];
  const content =
    query.assistantStatus === 'clarification'
      ? query.assistantContext === 'incompleteAnalysis'
        ? {
            title: 'Não consegui identificar a análise',
            message:
              'Especifique a operação, a dimensão ou a métrica que deseja analisar para eu consultar os dados reais do app.',
          }
        : query.assistantContext === 'incoherentAnalysis'
          ? {
              title: 'Não consegui confirmar a análise',
              message:
                'A interpretação trouxe critérios conflitantes. Tente informar novamente a métrica, a dimensão e a operação desejadas.',
            }
          : {
              title: 'Preciso de um critério',
              message:
                'Posso comparar margem líquida, lucro por entrega, lucro por km ou custo por entrega. Qual análise você quer?',
              options: [
                'Maior margem líquida',
                'Maior lucro por entrega',
                'Maior lucro por km',
                'Menor custo por entrega',
              ],
            }
      : query.assistantStatus === 'unsupportedMetric'
        ? {
            title: 'Métrica não disponível',
            message: 'Não encontrei dados confiáveis no app para executar essa métrica.',
          }
        : {
            title: 'Fora do escopo',
            message: 'A Pesquisa responde sobre os dados e recursos do Empório Rigatti.',
          };
  return [
    {
      type: 'assistant',
      id: `assistant:${query.assistantStatus}:${query.normalized}`,
      title: content.title,
      score: 2_500,
      data: {
        status: query.assistantStatus,
        message: content.message,
        ...('options' in content ? { options: content.options } : {}),
      },
      relations: {},
    },
  ];
}

function parserHasPotentialSemanticAnalysis(query: HomeSearchParsedQuery): boolean {
  const residualTokenCount = query.text ? query.text.split(/\s+/).filter(Boolean).length : 0;
  return (
    hasSemanticAnalysisSignals(query.original) ||
    hasNaturalLanguageQuestionSignals(query.original) ||
    (residualTokenCount > 1 &&
      Boolean(query.financialMetric || query.period || query.periodSummary))
  );
}

function homeSearchDevLog(event: string): void {
  if (__DEV__) console.info('[APPLE INTELLIGENCE]', event);
}

function parserProducedExecutableQuery(query: HomeSearchParsedQuery): boolean {
  if (query.financialMetric && homeSearchFinancialMetricIsAnalysisOnly(query.financialMetric)) {
    return false;
  }

  const hasStructuredParserResult = Boolean(
    query.assistantStatus ||
    query.analysis ||
    query.periodSummary ||
    query.financialMetric ||
    query.factoryMetric ||
    query.routeMetric ||
    query.carMetric ||
    query.clientField ||
    query.factoryStatus ||
    query.factoryPaymentDateUnsupported ||
    query.paymentStatus ||
    query.documentType ||
    query.quantity !== undefined ||
    query.money !== undefined,
  );

  if (!query.text) return hasStructuredParserResult || Boolean(query.period);

  if (
    parserHasPotentialSemanticAnalysis(query) ||
    hasNaturalLanguageQuestionSignals(query.original)
  ) {
    return false;
  }
  return true;
}

function clarificationForIncompleteAnalysis(original: string): HomeSearchParsedQuery {
  return {
    assistantContext: 'incompleteAnalysis',
    assistantStatus: 'clarification',
    detectedTypes: ['assistant'],
    normalized: normalizeHomeSearchText(original),
    original,
    text: '',
  };
}

function mergeSemanticQuery(
  deterministicQuery: HomeSearchParsedQuery,
  semanticQuery: HomeSearchParsedQuery,
): HomeSearchParsedQuery {
  if (deterministicQuery.clientField && !semanticQuery.clientField) {
    return {
      ...deterministicQuery,
      text: normalizeHomeSearchEntityText(semanticQuery.text || deterministicQuery.text),
    };
  }
  if (semanticQuery.assistantStatus) return semanticQuery;

  const text = semanticQuery.text
    ? semanticQuery.clientField
      ? normalizeHomeSearchEntityText(semanticQuery.text)
      : semanticQuery.text
    : semanticQuery.analysis
      ? ''
      : normalizeHomeSearchEntityText(deterministicQuery.text);

  return {
    ...semanticQuery,
    text,
    ...(semanticQuery.period || !deterministicQuery.period
      ? {}
      : { period: deterministicQuery.period }),
    ...(semanticQuery.periodSpan || !deterministicQuery.periodSpan
      ? {}
      : { periodSpan: deterministicQuery.periodSpan }),
    ...(semanticQuery.quantity !== undefined || deterministicQuery.quantity === undefined
      ? {}
      : { quantity: deterministicQuery.quantity }),
    ...(semanticQuery.money !== undefined || deterministicQuery.money === undefined
      ? {}
      : { money: deterministicQuery.money }),
    ...(semanticQuery.paymentStatus || !deterministicQuery.paymentStatus
      ? {}
      : { paymentStatus: deterministicQuery.paymentStatus }),
    ...(semanticQuery.documentType || !deterministicQuery.documentType
      ? {}
      : { documentType: deterministicQuery.documentType }),
    ...(semanticQuery.clientField || !deterministicQuery.clientField
      ? {}
      : { clientField: deterministicQuery.clientField }),
    ...(semanticQuery.financialMetric || !deterministicQuery.financialMetric
      ? {}
      : { financialMetric: deterministicQuery.financialMetric }),
    ...(semanticQuery.financialMetricAlias || !deterministicQuery.financialMetricAlias
      ? {}
      : { financialMetricAlias: deterministicQuery.financialMetricAlias }),
    ...(semanticQuery.factoryMetric || !deterministicQuery.factoryMetric
      ? {}
      : { factoryMetric: deterministicQuery.factoryMetric }),
    ...(semanticQuery.factoryStatus || !deterministicQuery.factoryStatus
      ? {}
      : { factoryStatus: deterministicQuery.factoryStatus }),
    ...(semanticQuery.factoryPaymentDateUnsupported ||
    !deterministicQuery.factoryPaymentDateUnsupported
      ? {}
      : { factoryPaymentDateUnsupported: true }),
    ...(semanticQuery.routeMetric || !deterministicQuery.routeMetric
      ? {}
      : { routeMetric: deterministicQuery.routeMetric }),
    ...(semanticQuery.carMetric || !deterministicQuery.carMetric
      ? {}
      : { carMetric: deterministicQuery.carMetric }),
    ...(semanticQuery.periodSummary || !deterministicQuery.periodSummary
      ? {}
      : { periodSummary: deterministicQuery.periodSummary }),
    ...(semanticQuery.analysis || !deterministicQuery.analysis
      ? {}
      : { analysis: deterministicQuery.analysis }),
    detectedTypes: [
      ...new Set([...deterministicQuery.detectedTypes, ...semanticQuery.detectedTypes]),
    ],
  };
}

export class HomeSearchService {
  private latestRequest = 0;

  public constructor(
    private readonly dataSource: HomeSearchDataSource,
    private readonly interpreter: HomeSearchSearchInterpreter | null = appleIntelligenceSearchInterpreter,
  ) {}

  public async search(
    original: string,
    referenceDate = new Date(),
    temporalContext?: HomeSearchTemporalContext,
  ): Promise<HomeSearchResponse> {
    const request = ++this.latestRequest;
    const fallbackQuery = homeSearchQueryParser.parse(original, referenceDate, temporalContext);
    if (!fallbackQuery.normalized) {
      homeSearchDevLog('parser-success');
      return this.searchParsedInternal(fallbackQuery, request);
    }

    if (parserProducedExecutableQuery(fallbackQuery)) {
      homeSearchDevLog('parser-success');
      return this.searchParsedInternal(fallbackQuery, request);
    }

    homeSearchDevLog('parser-failed -> semantic');
    if (!this.interpreter) {
      homeSearchDevLog('semantic-fallback: interpreter-unavailable');
      if (parserHasPotentialSemanticAnalysis(fallbackQuery)) {
        return this.searchParsedInternal(clarificationForIncompleteAnalysis(original), request);
      }
      return this.searchParsedInternal(fallbackQuery, request);
    }

    homeSearchDevLog('semantic-start');
    let interpretedQuery: HomeSearchParsedQuery | null = null;
    try {
      interpretedQuery =
        (await (temporalContext
          ? this.interpreter.interpret(original, referenceDate, temporalContext)
          : this.interpreter.interpret(original, referenceDate))) ?? null;
    } catch {
      interpretedQuery = null;
    }
    homeSearchDevLog(interpretedQuery ? 'semantic-success' : 'semantic-fallback');
    if (
      interpretedQuery &&
      !interpretedQuery.analysis &&
      !interpretedQuery.assistantStatus &&
      (hasSemanticAnalysisSignals(original) ||
        (hasNaturalLanguageQuestionSignals(original) &&
          !(
            interpretedQuery.financialMetric ||
            interpretedQuery.factoryMetric ||
            interpretedQuery.routeMetric ||
            interpretedQuery.carMetric ||
            interpretedQuery.clientField ||
            interpretedQuery.periodSummary
          )))
    ) {
      return this.searchParsedInternal(clarificationForIncompleteAnalysis(original), request);
    }
    if (!interpretedQuery && parserHasPotentialSemanticAnalysis(fallbackQuery)) {
      if (fallbackQuery.clientField) {
        return this.searchParsedInternal(fallbackQuery, request);
      }
      return this.searchParsedInternal(clarificationForIncompleteAnalysis(original), request);
    }
    const query = interpretedQuery
      ? mergeSemanticQuery(fallbackQuery, interpretedQuery)
      : fallbackQuery;
    return this.searchParsedInternal(query, request);
  }

  public async searchParsed(query: HomeSearchParsedQuery): Promise<HomeSearchResponse> {
    const request = ++this.latestRequest;
    return this.searchParsedInternal(query, request);
  }

  private async searchParsedInternal(
    query: HomeSearchParsedQuery,
    request: number,
  ): Promise<HomeSearchResponse> {
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

    if (query.assistantStatus) {
      const results = assistantResult(query);
      return {
        query,
        results,
        counts: countResults(results),
        coverage: [],
        errors: [],
        durationMs: Date.now() - startedAt,
        stale: request !== this.latestRequest,
      };
    }

    const data = await this.dataSource.load(query);
    const rawGlobalDeliveries =
      data.globalDeliveries && data.globalDeliveries.length > 0
        ? data.globalDeliveries
        : data.deliveries;
    const scopedGlobalDeliveries = rawGlobalDeliveries.filter((delivery) =>
      matchesPeriod(delivery.data, query.period),
    );

    if (query.analysis) {
      const results = financialAnalysisResults(data, query).sort(sortResults);
      return this.response(query, data, results, request, startedAt);
    }
    if (query.clientField) {
      const results = data.clients
        .map((client) => clientResult(client, [], query, scopedGlobalDeliveries, data.financial))
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
        scopedGlobalDeliveries,
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
