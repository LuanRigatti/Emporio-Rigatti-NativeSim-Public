import type {
  ClientId,
  ClientModel,
  DailyExpenses,
  Delivery,
  FactoryReceipt,
  FinancialSummary,
  MonthlyExpenses,
} from '@/types/data';
import type { CarSettings } from '@/services/car/CarSettingsStorage';
import type { RouteTrackingSession } from '@/types/routeTracking';

export type HomeSearchDetectedType =
  | 'text'
  | 'date'
  | 'dayMonth'
  | 'month'
  | 'year'
  | 'range'
  | 'quantity'
  | 'money'
  | 'paymentStatus'
  | 'document'
  | 'financialMetric'
  | 'clientField'
  | 'factoryMetric'
  | 'routeMetric'
  | 'carMetric'
  | 'periodSummary';

export type HomeSearchPeriod =
  | { kind: 'date'; date: string }
  | { kind: 'dayMonth'; day: number; month: number }
  | { kind: 'month'; month: number; year?: number }
  | { kind: 'year'; year: number }
  | { kind: 'range'; startDate: string; endDate: string; label?: string };

export type HomeSearchPaymentStatus = 'paid' | 'open';
export type HomeSearchDocumentType = 'invoice' | 'boleto';
export type HomeSearchFinancialMetric =
  | 'bucketsSold'
  | 'revenue'
  | 'grossProfit'
  | 'netProfit'
  | 'received'
  | 'receivable'
  | 'bucketCost'
  | 'fuelCost'
  | 'otherCosts'
  | 'electricityCost'
  | 'averageDeliveryCost'
  | 'grossMargin'
  | 'netMargin'
  | 'salePerBucket'
  | 'profitPerBucket'
  | 'costPerBucket';
export type HomeSearchFinancialUnit = 'count' | 'currency' | 'percentage';
export type HomeSearchFinancialClientScope = 'direct' | 'allocated' | 'unsupported';
export type HomeSearchClientField = 'currentPrice' | 'address' | 'usesInvoice' | 'usesBoleto';
export type HomeSearchFactoryMetric =
  'purchases' | 'bucketsPurchased' | 'purchaseValue' | 'payments' | 'paidValue' | 'openValue';
export type HomeSearchFactoryStatus = 'paid' | 'partial' | 'open' | 'outstanding';
export type HomeSearchRouteMetric = 'distance' | 'routes';
export type HomeSearchCarMetric = 'gasolineAutonomy' | 'alcoholAutonomy' | 'consumption';

export type HomeSearchParsedQuery = {
  original: string;
  normalized: string;
  text: string;
  period?: HomeSearchPeriod;
  quantity?: number;
  money?: number;
  paymentStatus?: HomeSearchPaymentStatus;
  documentType?: HomeSearchDocumentType;
  financialMetric?: HomeSearchFinancialMetric;
  financialMetricAlias?: string;
  clientField?: HomeSearchClientField;
  factoryMetric?: HomeSearchFactoryMetric;
  factoryStatus?: HomeSearchFactoryStatus;
  factoryPaymentDateUnsupported?: boolean;
  routeMetric?: HomeSearchRouteMetric;
  carMetric?: HomeSearchCarMetric;
  periodSummary?: true;
  detectedTypes: HomeSearchDetectedType[];
};

export type HomeSearchSourceName =
  'clients' | 'deliveries' | 'factoryPurchases' | 'financialData' | 'routeHistory' | 'carSettings';
export type HomeSearchSourceMode =
  'memory' | 'cache' | 'remote' | 'local' | 'localFallback' | 'skipped';

export type HomeSearchCoverage = {
  source: HomeSearchSourceName;
  mode: HomeSearchSourceMode;
  reason?: string;
};

export type HomeSearchSourceError = {
  source: HomeSearchSourceName;
  message: string;
};

export type HomeSearchDataSet = {
  clients: ClientModel[];
  deliveries: Delivery[];
  globalDeliveries?: Delivery[];
  factoryPurchases: FactoryReceipt[];
  financial?: HomeSearchFinancialData;
  routeSessions?: RouteTrackingSession[];
  carSettings?: CarSettings;
  coverage: HomeSearchCoverage[];
  errors: HomeSearchSourceError[];
};

export type HomeSearchFinancialData = {
  costsAvailable: boolean;
  dailyExpenses: DailyExpenses;
  deliveries: Delivery[];
  monthlyExpenses: MonthlyExpenses;
};

export interface HomeSearchDataSource {
  load(query: HomeSearchParsedQuery): Promise<HomeSearchDataSet>;
}

export type HomeSearchClientAggregation = {
  deliveryIds: string[];
  deliveryCount: number;
  quantity: number;
  revenue: number;
  paid: number;
  pending: number;
  currentPrice?: number;
  netProfit: number;
  revenueShare: number;
  netProfitShare: number;
};

export type HomeSearchClientResult = {
  type: 'client';
  id: string;
  clientId: ClientId;
  title: string;
  score: number;
  data: {
    address?: string;
    usesInvoice: boolean;
    usesBoleto: boolean;
    aggregation: HomeSearchClientAggregation;
    matchedField?: {
      field: HomeSearchClientField;
      available: boolean;
      unit: 'currency' | 'text' | 'boolean';
      value?: number | string | boolean;
    };
  };
  relations: {
    deliveryIds: string[];
  };
};

export type HomeSearchDeliveryFacet = 'receivable' | 'invoice' | 'boleto';

export type HomeSearchDeliveryResult = {
  type: 'delivery';
  id: string;
  clientId?: ClientId;
  title: string;
  date: string;
  score: number;
  data: {
    quantity: number;
    value: number;
    paymentStatus: string;
    delivered: boolean;
    invoiceStatus?: Delivery['invoiceStatus'];
    paymentMethod?: Delivery['metodoPagamento'];
    facets: HomeSearchDeliveryFacet[];
  };
  relations: {
    clientId?: ClientId;
  };
};

export type HomeSearchFactoryPurchaseResult = {
  type: 'factoryPurchase';
  id: string;
  title: string;
  date: string;
  score: number;
  data: {
    quantity: number;
    totalValue: number;
    totalPaid: number;
    openValue: number;
    completed: boolean;
    paymentIds: string[];
  };
  relations: {
    paymentIds: string[];
  };
};

export type HomeSearchFinancialMetricResult = {
  type: 'financialMetric';
  id: string;
  title: string;
  score: number;
  data: {
    available: boolean;
    metric: HomeSearchFinancialMetric;
    unit: HomeSearchFinancialUnit;
    period: HomeSearchPeriod;
    value?: number;
    clientId?: ClientId;
    clientName?: string;
    unavailableReason?: 'clientScopeUnsupported' | 'sourceUnavailable';
    supportingData?: {
      bucketsSold: number;
      deliveryCount: number;
      revenue: number;
      totalCosts?: number;
    };
  };
  relations: {
    clientId?: ClientId;
  };
};

export type HomeSearchFactoryReceiptSummary = {
  receiptId: string;
  date: string;
  quantity: number;
  totalValue: number;
  totalPaid: number;
  openValue: number;
  progress: number;
  status: Exclude<HomeSearchFactoryStatus, 'outstanding'>;
  paymentIds: string[];
};

export type HomeSearchFactoryAggregate = {
  receiptCount: number;
  totalBuckets: number;
  totalValue: number;
  totalPaid: number;
  openValue: number;
  paymentCount: number;
  progress: number;
};

export type HomeSearchFactorySummaryResult = {
  type: 'factorySummary';
  id: string;
  title: string;
  score: number;
  data: {
    available: boolean;
    metric: HomeSearchFactoryMetric;
    period?: HomeSearchPeriod;
    status?: HomeSearchFactoryStatus;
    aggregate?: HomeSearchFactoryAggregate;
    receipts: HomeSearchFactoryReceiptSummary[];
    unsupportedReason?: 'paymentDateFilter';
  };
  relations: {
    receiptIds: string[];
    paymentIds: string[];
  };
};

export type HomeSearchRouteSessionMetadata = {
  sessionId: string;
  date: string;
  distanceKm: number;
  dailyDistanceKm: number;
  durationSeconds: number;
  pointsCount: number;
  startTimestamp: number;
  endTimestamp: number;
};

export type HomeSearchRouteSummaryResult = {
  type: 'routeSummary';
  id: string;
  title: string;
  score: number;
  data: {
    period: HomeSearchPeriod;
    metric: HomeSearchRouteMetric;
    distanceKm: number;
    routeCount: number;
    durationSeconds: number;
    pointsCount: number;
    startTimestamp: number;
    endTimestamp: number;
    consideredDistanceKm: number;
    sessions: HomeSearchRouteSessionMetadata[];
  };
  relations: { sessionIds: string[] };
};

export type HomeSearchCarSettingResult = {
  type: 'carSetting';
  id: string;
  title: string;
  score: number;
  data: {
    metric: HomeSearchCarMetric;
    available: boolean;
    gasolineKmPerLiter: number;
    alcoholKmPerLiter: number;
  };
  relations: Record<string, never>;
};

export type HomeSearchPeriodSummaryResult = {
  type: 'periodSummary';
  id: string;
  title: string;
  score: number;
  data: {
    period: HomeSearchPeriod;
    financial: FinancialSummary;
    factory: HomeSearchFactoryAggregate;
    routes: { routeCount: number; distanceKm: number };
  };
  relations: {
    deliveryIds: string[];
    paymentIds: string[];
    receiptIds: string[];
    sessionIds: string[];
  };
};

export type HomeSearchResult =
  | HomeSearchClientResult
  | HomeSearchDeliveryResult
  | HomeSearchFactoryPurchaseResult
  | HomeSearchFinancialMetricResult
  | HomeSearchFactorySummaryResult
  | HomeSearchRouteSummaryResult
  | HomeSearchCarSettingResult
  | HomeSearchPeriodSummaryResult;

export type HomeSearchDomainCounts = Record<HomeSearchResult['type'], number>;

export type HomeSearchResponse = {
  query: HomeSearchParsedQuery;
  results: HomeSearchResult[];
  counts: HomeSearchDomainCounts;
  coverage: HomeSearchCoverage[];
  errors: HomeSearchSourceError[];
  durationMs: number;
  stale: boolean;
};
