import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { homeSearchQueryParser, normalizeHomeSearchText } from './HomeSearchQueryParser';
import type {
  HomeSearchAnalysisGroupBy,
  HomeSearchAnalysisOperation,
  HomeSearchAnalysisOrder,
  HomeSearchAssistantContext,
  HomeSearchAssistantStatus,
  HomeSearchCarMetric,
  HomeSearchClientField,
  HomeSearchDetectedType,
  HomeSearchDocumentType,
  HomeSearchFactoryMetric,
  HomeSearchFactoryStatus,
  HomeSearchFinancialMetric,
  HomeSearchParsedQuery,
  HomeSearchPaymentStatus,
  HomeSearchPeriod,
  HomeSearchRouteMetric,
} from './HomeSearchTypes';

export type NativeAppleIntelligenceSearchIntent = {
  confidence: number;
  intent: string;
  text: string;
  periodKind: string;
  date: string;
  startDate: string;
  endDate: string;
  day: number;
  month: number;
  year: number;
  quantity: number;
  money: number;
  paymentStatus: string;
  documentType: string;
  financialMetric: string;
  clientField: string;
  factoryMetric: string;
  factoryStatus: string;
  factoryPaymentDateUnsupported: boolean;
  routeMetric: string;
  carMetric: string;
  periodSummary: boolean;
  operation: string;
  groupBy: string;
  order: string;
  comparisonStartMonth: number;
  comparisonStartYear: number;
  comparisonEndMonth: number;
  comparisonEndYear: number;
  limit?: number;
  numeratorMetric?: string;
  denominatorMetric?: string;
};

type NativeAppleIntelligenceModule = {
  isAvailable?: boolean;
  availability?: string;
  localeIdentifier?: string;
  supportsLocale?: boolean;
  interpret(
    query: string,
    referenceDateISO: string,
  ): Promise<string | NativeAppleIntelligenceSearchIntent | null>;
  prewarm?: () => Promise<void>;
};

const nativeAppleIntelligence =
  Platform.OS === 'ios'
    ? requireOptionalNativeModule<NativeAppleIntelligenceModule>('NativeAppleIntelligence')
    : null;

function appleIntelligenceDevLog(event: string, details?: unknown): void {
  if (__DEV__) console.info('[APPLE INTELLIGENCE]', event, details ?? '');
}

function semanticErrorKind(
  error: unknown,
): 'contextOverflow' | 'modelUnavailable' | 'generationError' {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  if (
    normalized.includes('context') &&
    (normalized.includes('window') || normalized.includes('size'))
  ) {
    return 'contextOverflow';
  }
  if (normalized.includes('unavailable') || normalized.includes('not enabled')) {
    return 'modelUnavailable';
  }
  return 'generationError';
}

function sanitizeNativeIntentPayload(value: unknown): unknown {
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, fieldValue]) => {
      if (key === 'text') return [key, '<redacted>'];
      if (key === 'money' && typeof fieldValue === 'number' && fieldValue >= 0) {
        return [key, '<redacted>'];
      }
      return [key, fieldValue];
    }),
  );
}

function logParserRejection(stage: string, details: Record<string, unknown> = {}): void {
  appleIntelligenceDevLog('structured-intent-rejected', { stage, ...details });
}

const FINANCIAL_METRICS: ReadonlySet<HomeSearchFinancialMetric> = new Set([
  'bucketsSold',
  'deliveryCount',
  'revenue',
  'grossProfit',
  'netProfit',
  'received',
  'receivable',
  'bucketCost',
  'fuelCost',
  'otherCosts',
  'electricityCost',
  'averageDeliveryCost',
  'grossMargin',
  'netMargin',
  'salePerBucket',
  'profitPerBucket',
  'costPerBucket',
  'bucketPrice',
  'totalCost',
  'distanceKm',
  'factoryCost',
  'marginPercentage',
  'profitPerDelivery',
  'revenuePerDelivery',
  'costPerDelivery',
  'profitPerKm',
  'revenuePerKm',
  'costPerKm',
]);

const CLIENT_FIELDS: ReadonlySet<HomeSearchClientField> = new Set([
  'currentPrice',
  'address',
  'usesInvoice',
  'usesBoleto',
]);

const FACTORY_METRICS: ReadonlySet<HomeSearchFactoryMetric> = new Set([
  'purchases',
  'bucketsPurchased',
  'purchaseValue',
  'payments',
  'paidValue',
  'openValue',
]);

const FACTORY_STATUSES: ReadonlySet<HomeSearchFactoryStatus> = new Set([
  'paid',
  'partial',
  'open',
  'outstanding',
]);

const ROUTE_METRICS: ReadonlySet<HomeSearchRouteMetric> = new Set(['distance', 'routes']);
const CAR_METRICS: ReadonlySet<HomeSearchCarMetric> = new Set([
  'gasolineAutonomy',
  'alcoholAutonomy',
  'consumption',
]);
const PAYMENT_STATUSES: ReadonlySet<HomeSearchPaymentStatus> = new Set(['paid', 'open']);
const DOCUMENT_TYPES: ReadonlySet<HomeSearchDocumentType> = new Set(['invoice', 'boleto']);
const SUPPORTED_INTENTS = new Set([
  'client',
  'delivery',
  'financialanalysis',
  'financialmetric',
  'factorymetric',
  'routemetric',
  'carmetric',
  'periodsummary',
  'clientfield',
  'search',
  'clarification',
  'unsupporteddomain',
  'unsupportedmetric',
]);
const ANALYSIS_OPERATIONS: ReadonlySet<HomeSearchAnalysisOperation> = new Set([
  'max',
  'min',
  'compare',
  'sum',
  'average',
  'rank',
  'topN',
  'percentageChange',
  'ratio',
  'trend',
  'report',
]);
const ANALYSIS_GROUPINGS: ReadonlySet<HomeSearchAnalysisGroupBy> = new Set([
  'day',
  'client',
  'month',
  'week',
  'route',
  'factory',
]);
const ANALYSIS_ORDERS: ReadonlySet<HomeSearchAnalysisOrder> = new Set(['ascending', 'descending']);

const ASSISTANT_INTENTS: ReadonlyMap<string, HomeSearchAssistantStatus> = new Map([
  ['clarification', 'clarification'],
  ['unsupporteddomain', 'unsupportedDomain'],
  ['unsupportedmetric', 'unsupportedMetric'],
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN;
}

function integerValue(value: unknown): number {
  const number = numberValue(value);
  return Number.isFinite(number) ? Math.trunc(number) : -1;
}

function inSet<T extends string>(value: string, values: ReadonlySet<T>): value is T {
  return values.has(value as T);
}

function normalizeAnalysisOperation(value: string): HomeSearchAnalysisOperation | '' {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'topn') return 'topN';
  if (normalized === 'percentagechange') return 'percentageChange';
  return normalized as HomeSearchAnalysisOperation;
}

function validYear(value: number): boolean {
  return Number.isInteger(value) && value >= 1900 && value <= 2100;
}

function validMonth(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 12;
}

function validDay(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 31;
}

function validISODate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!validYear(year) || !validMonth(month) || !validDay(day)) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function buildPeriod(intent: NativeAppleIntelligenceSearchIntent): {
  valid: boolean;
  period?: HomeSearchPeriod;
} {
  const kind = intent.periodKind.toLowerCase();
  if (!kind || kind === 'none') return { valid: true };

  if (kind === 'date') {
    return validISODate(intent.date)
      ? { valid: true, period: { kind: 'date', date: intent.date } }
      : { valid: false };
  }
  if (kind === 'daymonth') {
    return validMonth(intent.month) && validDay(intent.day)
      ? { valid: true, period: { kind: 'dayMonth', day: intent.day, month: intent.month } }
      : { valid: false };
  }
  if (kind === 'month') {
    if (!validMonth(intent.month)) return { valid: false };
    if (intent.year === -1) return { valid: true, period: { kind: 'month', month: intent.month } };
    return validYear(intent.year)
      ? { valid: true, period: { kind: 'month', month: intent.month, year: intent.year } }
      : { valid: false };
  }
  if (kind === 'year') {
    return validYear(intent.year)
      ? { valid: true, period: { kind: 'year', year: intent.year } }
      : { valid: false };
  }
  if (kind === 'range') {
    return validISODate(intent.startDate) &&
      validISODate(intent.endDate) &&
      intent.startDate <= intent.endDate
      ? {
          valid: true,
          period: { kind: 'range', startDate: intent.startDate, endDate: intent.endDate },
        }
      : { valid: false };
  }
  return { valid: false };
}

function resolvePeriodFromReference(
  original: string,
  period: HomeSearchPeriod | undefined,
  referenceDate: Date | undefined,
): HomeSearchPeriod | undefined {
  if (!period || !referenceDate || period.kind !== 'month' || period.year !== undefined) {
    return period;
  }

  const parserPeriod = homeSearchQueryParser.parse(original, referenceDate).period;
  if (
    parserPeriod?.kind === 'month' &&
    parserPeriod.month === period.month &&
    parserPeriod.year !== undefined
  ) {
    return { ...period, year: parserPeriod.year };
  }

  return { ...period, year: referenceDate.getFullYear() };
}

function addDetectedType(types: HomeSearchDetectedType[], type: HomeSearchDetectedType): void {
  if (!types.includes(type)) types.push(type);
}

function readNativeIntent(value: unknown): NativeAppleIntelligenceSearchIntent | null {
  const object = typeof value === 'string' ? parseJSON(value) : value;
  if (!isRecord(object)) return null;

  return {
    confidence: numberValue(object.confidence),
    intent: stringValue(object.intent),
    text: stringValue(object.text),
    periodKind: stringValue(object.periodKind),
    date: stringValue(object.date),
    startDate: stringValue(object.startDate),
    endDate: stringValue(object.endDate),
    day: integerValue(object.day),
    month: integerValue(object.month),
    year: integerValue(object.year),
    quantity: numberValue(object.quantity),
    money: numberValue(object.money),
    paymentStatus: stringValue(object.paymentStatus),
    documentType: stringValue(object.documentType),
    financialMetric: stringValue(object.financialMetric),
    clientField: stringValue(object.clientField),
    factoryMetric: stringValue(object.factoryMetric),
    factoryStatus: stringValue(object.factoryStatus),
    factoryPaymentDateUnsupported: object.factoryPaymentDateUnsupported === true,
    routeMetric: stringValue(object.routeMetric),
    carMetric: stringValue(object.carMetric),
    periodSummary: object.periodSummary === true,
    operation: stringValue(object.operation),
    groupBy: stringValue(object.groupBy),
    order: stringValue(object.order),
    comparisonStartMonth: integerValue(object.comparisonStartMonth),
    comparisonStartYear: integerValue(object.comparisonStartYear),
    comparisonEndMonth: integerValue(object.comparisonEndMonth),
    comparisonEndYear: integerValue(object.comparisonEndYear),
    limit: integerValue(object.limit),
    numeratorMetric: stringValue(object.numeratorMetric),
    denominatorMetric: stringValue(object.denominatorMetric),
  };
}

function buildComparisonPeriods(intent: NativeAppleIntelligenceSearchIntent): {
  valid: boolean;
  periods?: [HomeSearchPeriod, HomeSearchPeriod];
} {
  const values = [
    intent.comparisonStartMonth,
    intent.comparisonStartYear,
    intent.comparisonEndMonth,
    intent.comparisonEndYear,
  ];
  if (values.every((value) => value === -1)) return { valid: true };
  if (
    !validMonth(intent.comparisonStartMonth) ||
    !validYear(intent.comparisonStartYear) ||
    !validMonth(intent.comparisonEndMonth) ||
    !validYear(intent.comparisonEndYear)
  ) {
    return { valid: false };
  }
  return {
    valid: true,
    periods: [
      {
        kind: 'month',
        month: intent.comparisonStartMonth,
        year: intent.comparisonStartYear,
      },
      {
        kind: 'month',
        month: intent.comparisonEndMonth,
        year: intent.comparisonEndYear,
      },
    ],
  };
}

function parseJSON(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function assistantQuery(
  original: string,
  status: HomeSearchAssistantStatus,
  context?: HomeSearchAssistantContext,
): HomeSearchParsedQuery {
  return {
    assistantStatus: status,
    ...(context ? { assistantContext: context } : {}),
    detectedTypes: ['assistant'],
    normalized: normalizeHomeSearchText(original),
    original,
    text: '',
  };
}

export function toHomeSearchParsedQuery(
  original: string,
  rawIntent: unknown,
  referenceDate?: Date,
): HomeSearchParsedQuery | null {
  const effectiveReferenceDate = referenceDate ?? new Date();
  const intent = readNativeIntent(rawIntent);
  if (!intent) {
    logParserRejection('decode', { reason: 'payloadIsNotAnObjectOrValidJson' });
    return null;
  }

  const intentKind = intent.intent.toLowerCase();
  const inferredIntentKind = intentKind || (intent.financialMetric ? 'financialmetric' : '');
  if (!SUPPORTED_INTENTS.has(inferredIntentKind)) {
    logParserRejection('intent', { reason: 'unsupportedValue' });
    return null;
  }

  const assistantStatus = ASSISTANT_INTENTS.get(inferredIntentKind);
  if (assistantStatus) return assistantQuery(original, assistantStatus);

  const periodResult = buildPeriod(intent);
  if (!periodResult.valid) {
    logParserRejection('period', { reason: 'invalidPeriodFields' });
    return null;
  }

  let period = resolvePeriodFromReference(original, periodResult.period, effectiveReferenceDate);
  const query: HomeSearchParsedQuery = {
    original,
    normalized: normalizeHomeSearchText(original),
    text: normalizeHomeSearchText(intent.text),
    ...(period ? { period } : {}),
    detectedTypes: [],
  };

  if (query.text) addDetectedType(query.detectedTypes, 'text');
  if (query.period) addDetectedType(query.detectedTypes, query.period.kind);

  if (Number.isFinite(intent.quantity) && intent.quantity >= 0) {
    query.quantity = intent.quantity;
    addDetectedType(query.detectedTypes, 'quantity');
  }
  if (Number.isFinite(intent.money) && intent.money >= 0) {
    query.money = intent.money;
    addDetectedType(query.detectedTypes, 'money');
  }
  if (inSet(intent.paymentStatus, PAYMENT_STATUSES)) {
    query.paymentStatus = intent.paymentStatus;
    addDetectedType(query.detectedTypes, 'paymentStatus');
  } else if (intent.paymentStatus) {
    logParserRejection('paymentStatus', { reason: 'unsupportedValue' });
    return null;
  }
  if (inSet(intent.documentType, DOCUMENT_TYPES)) {
    query.documentType = intent.documentType;
    addDetectedType(query.detectedTypes, 'document');
  } else if (intent.documentType) {
    logParserRejection('documentType', { reason: 'unsupportedValue' });
    return null;
  }
  if (inSet(intent.financialMetric, FINANCIAL_METRICS)) {
    query.financialMetric = intent.financialMetric;
    addDetectedType(query.detectedTypes, 'financialMetric');
  } else if (intent.financialMetric) {
    logParserRejection('financialMetric', { reason: 'unsupportedValue' });
    return null;
  }
  const numeratorMetric = (intent.numeratorMetric ?? '').trim();
  const denominatorMetric = (intent.denominatorMetric ?? '').trim();
  if (numeratorMetric && !inSet(numeratorMetric, FINANCIAL_METRICS)) {
    logParserRejection('numeratorMetric', { reason: 'unsupportedValue' });
    return null;
  }
  if (denominatorMetric && !inSet(denominatorMetric, FINANCIAL_METRICS)) {
    logParserRejection('denominatorMetric', { reason: 'unsupportedValue' });
    return null;
  }
  if (inSet(intent.clientField, CLIENT_FIELDS)) {
    query.clientField = intent.clientField;
    addDetectedType(query.detectedTypes, 'clientField');
  } else if (intent.clientField) {
    logParserRejection('clientField', { reason: 'unsupportedValue' });
    return null;
  }
  if (inSet(intent.factoryMetric, FACTORY_METRICS)) {
    query.factoryMetric = intent.factoryMetric;
    addDetectedType(query.detectedTypes, 'factoryMetric');
  } else if (intent.factoryMetric) {
    logParserRejection('factoryMetric', { reason: 'unsupportedValue' });
    return null;
  }
  if (inSet(intent.factoryStatus, FACTORY_STATUSES)) {
    query.factoryStatus = intent.factoryStatus;
  } else if (intent.factoryStatus) {
    logParserRejection('factoryStatus', { reason: 'unsupportedValue' });
    return null;
  }
  if (intent.factoryPaymentDateUnsupported) query.factoryPaymentDateUnsupported = true;
  if (inSet(intent.routeMetric, ROUTE_METRICS)) {
    query.routeMetric = intent.routeMetric;
    addDetectedType(query.detectedTypes, 'routeMetric');
  } else if (intent.routeMetric) {
    logParserRejection('routeMetric', { reason: 'unsupportedValue' });
    return null;
  }
  if (inSet(intent.carMetric, CAR_METRICS)) {
    query.carMetric = intent.carMetric;
    addDetectedType(query.detectedTypes, 'carMetric');
  } else if (intent.carMetric) {
    logParserRejection('carMetric', { reason: 'unsupportedValue' });
    return null;
  }

  if (intent.periodSummary || intentKind === 'periodsummary') {
    query.periodSummary = true;
    addDetectedType(query.detectedTypes, 'periodSummary');
  }

  const operation = normalizeAnalysisOperation(intent.operation);
  const groupBy = intent.groupBy.toLowerCase();
  const order = intent.order.toLowerCase();
  const hasAnalysisFields = Boolean(operation || groupBy);
  const isAnalysisIntent = inferredIntentKind === 'financialanalysis' || hasAnalysisFields;
  const declaredAnalysis = inferredIntentKind === 'financialanalysis' || hasAnalysisFields;
  if (operation && !inSet(operation, ANALYSIS_OPERATIONS)) {
    logParserRejection('operation', { reason: 'unsupportedValue' });
    return declaredAnalysis ? assistantQuery(original, 'clarification') : null;
  }
  if (groupBy && !inSet(groupBy, ANALYSIS_GROUPINGS)) {
    logParserRejection('groupBy', { reason: 'unsupportedValue' });
    return declaredAnalysis ? assistantQuery(original, 'clarification') : null;
  }
  if (order && !inSet(order, ANALYSIS_ORDERS)) {
    logParserRejection('order', { reason: 'unsupportedValue' });
    return declaredAnalysis ? assistantQuery(original, 'clarification') : null;
  }
  if (isAnalysisIntent) {
    const effectiveGroupBy = operation === 'report' && !groupBy ? 'month' : groupBy;
    if (!inSet(operation, ANALYSIS_OPERATIONS) || !inSet(effectiveGroupBy, ANALYSIS_GROUPINGS)) {
      logParserRejection('analysis', { reason: 'missingOperationOrGroupBy' });
      return assistantQuery(original, 'clarification');
    }
    if (!query.financialMetric) {
      if (operation === 'report') {
        query.financialMetric = 'revenue';
        addDetectedType(query.detectedTypes, 'financialMetric');
      } else {
        logParserRejection('analysis', { reason: 'missingFinancialMetric' });
        return assistantQuery(original, 'clarification');
      }
    }
    if (!period && query.financialMetric !== 'bucketPrice') {
      period = {
        kind: 'month',
        month: effectiveReferenceDate.getMonth() + 1,
        year: effectiveReferenceDate.getFullYear(),
      };
      query.period = period;
      addDetectedType(query.detectedTypes, 'month');
    }
    const comparison = buildComparisonPeriods(intent);
    if (
      !comparison.valid ||
      (['compare', 'percentageChange'].includes(operation) && !comparison.periods)
    ) {
      logParserRejection('analysis', { reason: 'invalidComparisonPeriods' });
      return assistantQuery(original, 'clarification');
    }
    const limit =
      Number.isInteger(intent.limit) && intent.limit! >= 1
        ? Math.min(intent.limit!, 100)
        : undefined;
    if (operation === 'topN' && limit === undefined) {
      logParserRejection('analysis', { reason: 'missingLimit' });
      return assistantQuery(original, 'clarification');
    }
    if (operation === 'ratio' && (!numeratorMetric || !denominatorMetric)) {
      logParserRejection('analysis', { reason: 'missingRatioMetrics' });
      return assistantQuery(original, 'clarification');
    }
    const parsedNumeratorMetric = numeratorMetric
      ? (numeratorMetric as HomeSearchFinancialMetric)
      : undefined;
    const parsedDenominatorMetric = denominatorMetric
      ? (denominatorMetric as HomeSearchFinancialMetric)
      : undefined;
    query.analysis = {
      operation,
      groupBy: effectiveGroupBy,
      ...(order ? { order: order as HomeSearchAnalysisOrder } : {}),
      ...(limit !== undefined ? { limit } : {}),
      ...(parsedNumeratorMetric ? { numeratorMetric: parsedNumeratorMetric } : {}),
      ...(parsedDenominatorMetric ? { denominatorMetric: parsedDenominatorMetric } : {}),
      ...(comparison.periods ? { comparisonPeriods: comparison.periods } : {}),
    };
    addDetectedType(query.detectedTypes, 'analysis');
  }

  if (intent.financialMetric === 'bucketPrice') {
    if (!query.analysis) {
      logParserRejection('analysis', { reason: 'bucketPriceRequiresAnalysis' });
      return null;
    }
    if (query.analysis.groupBy !== 'client') {
      logParserRejection('analysis', { reason: 'bucketPriceRequiresClientGrouping' });
      return null;
    }
    if (query.analysis.operation === 'compare') {
      logParserRejection('analysis', { reason: 'bucketPriceComparisonUnsupported' });
      return null;
    }
  }

  if (inferredIntentKind === 'financialmetric' && !query.financialMetric) {
    logParserRejection('intent', { reason: 'missingFinancialMetric' });
    return null;
  }
  if (inferredIntentKind === 'factorymetric' && !query.factoryMetric) {
    logParserRejection('intent', { reason: 'missingFactoryMetric' });
    return null;
  }
  if (inferredIntentKind === 'routemetric' && !query.routeMetric) {
    logParserRejection('intent', { reason: 'missingRouteMetric' });
    return null;
  }
  if (inferredIntentKind === 'carmetric' && !query.carMetric) {
    logParserRejection('intent', { reason: 'missingCarMetric' });
    return null;
  }
  if (inferredIntentKind === 'clientfield' && !query.clientField) {
    logParserRejection('intent', { reason: 'missingClientField' });
    return null;
  }

  const hasMeaningfulIntent =
    query.text ||
    query.period ||
    query.quantity !== undefined ||
    query.money !== undefined ||
    query.paymentStatus ||
    query.documentType ||
    query.financialMetric ||
    query.clientField ||
    query.factoryMetric ||
    query.routeMetric ||
    query.carMetric ||
    query.periodSummary ||
    query.analysis;
  if (!hasMeaningfulIntent) {
    logParserRejection('intent', { reason: 'noMeaningfulField' });
    return null;
  }

  return query;
}

export interface HomeSearchSearchInterpreter {
  interpret(original: string, referenceDate: Date): Promise<HomeSearchParsedQuery | null>;
}

export class AppleIntelligenceSearchInterpreter implements HomeSearchSearchInterpreter {
  public async interpret(
    original: string,
    referenceDate: Date,
  ): Promise<HomeSearchParsedQuery | null> {
    if (!nativeAppleIntelligence) {
      appleIntelligenceDevLog('fallback', { reason: 'nativeModuleUnavailable' });
      return null;
    }
    appleIntelligenceDevLog('request', {
      availability: nativeAppleIntelligence.availability ?? 'unknown',
      locale: nativeAppleIntelligence.localeIdentifier ?? 'unknown',
      modelIsAvailable: nativeAppleIntelligence.isAvailable ?? 'unknown',
      queryLength: original.length,
      supportsLocale: nativeAppleIntelligence.supportsLocale ?? 'unknown',
    });
    if (nativeAppleIntelligence.isAvailable === false) {
      appleIntelligenceDevLog('fallback', { reason: 'modelUnavailable' });
      return null;
    }
    const startedAt = Date.now();
    try {
      const rawIntent = await nativeAppleIntelligence.interpret(
        original,
        calendarDateISO(referenceDate),
      );
      const rawObject = typeof rawIntent === 'string' ? parseJSON(rawIntent) : rawIntent;
      appleIntelligenceDevLog('raw-response', {
        payload: sanitizeNativeIntentPayload(rawObject),
        type:
          typeof rawIntent === 'string'
            ? 'json-string'
            : rawIntent && typeof rawIntent === 'object'
              ? 'object'
              : rawIntent === null
                ? 'null'
                : typeof rawIntent,
      });
      const parsedIntent = toHomeSearchParsedQuery(original, rawIntent, referenceDate);
      appleIntelligenceDevLog('response', {
        confidence: isRecord(rawObject) ? rawObject.confidence : undefined,
        durationMs: Date.now() - startedAt,
        parsed: parsedIntent
          ? {
              detectedTypes: parsedIntent.detectedTypes,
              financialMetric: parsedIntent.financialMetric,
              period: parsedIntent.period,
              textLength: parsedIntent.text?.length ?? 0,
            }
          : null,
        rawShape:
          typeof rawIntent === 'string'
            ? 'json-string'
            : rawIntent && typeof rawIntent === 'object'
              ? Object.keys(rawIntent)
              : rawIntent === null
                ? 'null'
                : typeof rawIntent,
      });
      if (!parsedIntent) {
        appleIntelligenceDevLog('fallback', {
          reason: rawIntent ? 'structuredIntentRejected' : 'emptyStructuredIntent',
        });
      }
      return parsedIntent;
    } catch (error) {
      const kind = semanticErrorKind(error);
      appleIntelligenceDevLog('error', {
        durationMs: Date.now() - startedAt,
        kind,
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}

function calendarDateISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

export async function prewarmAppleIntelligence(): Promise<void> {
  if (!nativeAppleIntelligence?.prewarm) return;
  try {
    await nativeAppleIntelligence.prewarm();
    appleIntelligenceDevLog('prewarmCompleted');
  } catch (error) {
    appleIntelligenceDevLog('prewarmError', {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export const appleIntelligenceSearchInterpreter: HomeSearchSearchInterpreter | null =
  nativeAppleIntelligence ? new AppleIntelligenceSearchInterpreter() : null;
