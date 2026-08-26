import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { normalizeHomeSearchText } from './HomeSearchQueryParser';
import type {
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

const MIN_INTERPRETATION_CONFIDENCE = 0.6;

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

const FINANCIAL_METRICS: ReadonlySet<HomeSearchFinancialMetric> = new Set([
  'bucketsSold',
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
  'financialmetric',
  'factorymetric',
  'routemetric',
  'carmetric',
  'periodsummary',
  'clientfield',
  'search',
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
  };
}

function parseJSON(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export function toHomeSearchParsedQuery(
  original: string,
  rawIntent: unknown,
): HomeSearchParsedQuery | null {
  const intent = readNativeIntent(rawIntent);
  if (
    !intent ||
    !Number.isFinite(intent.confidence) ||
    intent.confidence < MIN_INTERPRETATION_CONFIDENCE ||
    intent.confidence > 1
  ) {
    return null;
  }

  const intentKind = intent.intent.toLowerCase();
  if (!SUPPORTED_INTENTS.has(intentKind)) return null;

  const periodResult = buildPeriod(intent);
  if (!periodResult.valid) return null;

  const query: HomeSearchParsedQuery = {
    original,
    normalized: normalizeHomeSearchText(original),
    text: normalizeHomeSearchText(intent.text),
    ...(periodResult.period ? { period: periodResult.period } : {}),
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
    return null;
  }
  if (inSet(intent.documentType, DOCUMENT_TYPES)) {
    query.documentType = intent.documentType;
    addDetectedType(query.detectedTypes, 'document');
  } else if (intent.documentType) {
    return null;
  }
  if (inSet(intent.financialMetric, FINANCIAL_METRICS)) {
    query.financialMetric = intent.financialMetric;
    addDetectedType(query.detectedTypes, 'financialMetric');
  } else if (intent.financialMetric) {
    return null;
  }
  if (inSet(intent.clientField, CLIENT_FIELDS)) {
    query.clientField = intent.clientField;
    addDetectedType(query.detectedTypes, 'clientField');
  } else if (intent.clientField) {
    return null;
  }
  if (inSet(intent.factoryMetric, FACTORY_METRICS)) {
    query.factoryMetric = intent.factoryMetric;
    addDetectedType(query.detectedTypes, 'factoryMetric');
  } else if (intent.factoryMetric) {
    return null;
  }
  if (inSet(intent.factoryStatus, FACTORY_STATUSES)) {
    query.factoryStatus = intent.factoryStatus;
  } else if (intent.factoryStatus) {
    return null;
  }
  if (intent.factoryPaymentDateUnsupported) query.factoryPaymentDateUnsupported = true;
  if (inSet(intent.routeMetric, ROUTE_METRICS)) {
    query.routeMetric = intent.routeMetric;
    addDetectedType(query.detectedTypes, 'routeMetric');
  } else if (intent.routeMetric) {
    return null;
  }
  if (inSet(intent.carMetric, CAR_METRICS)) {
    query.carMetric = intent.carMetric;
    addDetectedType(query.detectedTypes, 'carMetric');
  } else if (intent.carMetric) {
    return null;
  }

  if (intent.periodSummary || intentKind === 'periodsummary') {
    query.periodSummary = true;
    addDetectedType(query.detectedTypes, 'periodSummary');
  }

  if (intentKind === 'financialmetric' && !query.financialMetric) return null;
  if (intentKind === 'factorymetric' && !query.factoryMetric) return null;
  if (intentKind === 'routemetric' && !query.routeMetric) return null;
  if (intentKind === 'carmetric' && !query.carMetric) return null;
  if (intentKind === 'clientfield' && !query.clientField) return null;

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
    query.periodSummary;
  return hasMeaningfulIntent ? query : null;
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
      const parsedIntent = toHomeSearchParsedQuery(original, rawIntent);
      const rawObject = typeof rawIntent === 'string' ? parseJSON(rawIntent) : rawIntent;
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
      appleIntelligenceDevLog('error', {
        durationMs: Date.now() - startedAt,
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
