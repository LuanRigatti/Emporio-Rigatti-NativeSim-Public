import type {
  HomeSearchDetectedType,
  HomeSearchDocumentType,
  HomeSearchParsedQuery,
  HomeSearchPaymentStatus,
  HomeSearchPeriod,
} from './HomeSearchTypes';
import { matchHomeSearchBusinessIntent } from './HomeSearchBusinessIntents';
import { matchHomeSearchFinancialMetric } from './HomeSearchFinancialMetrics';

const MONTHS = new Map<string, number>([
  ['janeiro', 1],
  ['fevereiro', 2],
  ['marco', 3],
  ['abril', 4],
  ['maio', 5],
  ['junho', 6],
  ['julho', 7],
  ['agosto', 8],
  ['setembro', 9],
  ['outubro', 10],
  ['novembro', 11],
  ['dezembro', 12],
]);

export function normalizeHomeSearchText(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function validDateParts(day: number, month: number, year: number): boolean {
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function isoDate(day: number, month: number, year: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parsePeriod(
  normalized: string,
  currentYear: number,
  referenceDate = new Date(),
): { period?: HomeSearchPeriod; matched?: string } {
  const isoDateMatch = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(normalized);
  if (isoDateMatch) {
    const [, yearValue, monthValue, dayValue] = isoDateMatch;
    const day = Number(dayValue);
    const month = Number(monthValue);
    const year = Number(yearValue);
    return validDateParts(day, month, year)
      ? { period: { kind: 'date', date: isoDate(day, month, year) }, matched: isoDateMatch[0] }
      : {};
  }

  const fullDate = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/.exec(normalized);
  if (fullDate) {
    const [, dayValue, monthValue, yearValue] = fullDate;
    const day = Number(dayValue);
    const month = Number(monthValue);
    const year = Number(yearValue);
    if (validDateParts(day, month, year)) {
      return { period: { kind: 'date', date: isoDate(day, month, year) }, matched: fullDate[0] };
    }
    return {};
  }

  const isoMonth = /\b(\d{4})-(0?[1-9]|1[0-2])\b/.exec(normalized);
  if (isoMonth) {
    return {
      period: { kind: 'month', month: Number(isoMonth[2]), year: Number(isoMonth[1]) },
      matched: isoMonth[0],
    };
  }

  const slashMonth = /\b(0?[1-9]|1[0-2])\/(\d{4})\b/.exec(normalized);
  if (slashMonth) {
    return {
      period: { kind: 'month', month: Number(slashMonth[1]), year: Number(slashMonth[2]) },
      matched: slashMonth[0],
    };
  }

  const yearSlashMonth = /\b(\d{4})\/(0?[1-9]|1[0-2])\b/.exec(normalized);
  if (yearSlashMonth) {
    return {
      period: {
        kind: 'month',
        month: Number(yearSlashMonth[2]),
        year: Number(yearSlashMonth[1]),
      },
      matched: yearSlashMonth[0],
    };
  }

  for (const [name, month] of MONTHS) {
    const namedMonth = new RegExp(`\\b${name}(?:\\s+de)?(?:\\s+(\\d{4}))?\\b`).exec(normalized);
    if (namedMonth) {
      return {
        period: {
          kind: 'month',
          month,
          year: namedMonth[1] ? Number(namedMonth[1]) : currentYear,
        },
        matched: namedMonth[0],
      };
    }
  }

  const dayMonth = /\b(\d{1,2})\/(0?[1-9]|1[0-2])\b/.exec(normalized);
  if (dayMonth) {
    const day = Number(dayMonth[1]);
    const month = Number(dayMonth[2]);
    if (validDateParts(day, month, currentYear)) {
      return {
        period: { kind: 'date', date: isoDate(day, month, currentYear) },
        matched: dayMonth[0],
      };
    }
  }

  const today = /\bhoje\b/.exec(normalized);
  if (today) {
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth() + 1;
    const day = referenceDate.getDate();
    return { period: { kind: 'date', date: isoDate(day, month, year) }, matched: today[0] };
  }

  const year = /\b(20\d{2})\b/.exec(normalized);
  return year ? { period: { kind: 'year', year: Number(year[1]) }, matched: year[0] } : {};
}

function parsePaymentStatus(normalized: string): {
  status?: HomeSearchPaymentStatus;
  matched?: string;
} {
  const open = /\b(nao\s+pag(?:o|os|a|as)|em\s+aberto|pendente|pendentes)\b/.exec(normalized);
  if (open) return { status: 'open', matched: open[0] };
  const paid = /\b(pag(?:o|os|a|as)|quitad(?:o|os|a|as))\b/.exec(normalized);
  return paid ? { status: 'paid', matched: paid[0] } : {};
}

function parseDocument(normalized: string): {
  documentType?: HomeSearchDocumentType;
  matched?: string;
} {
  const invoice = /\b(nota\s+fiscal|notas\s+fiscais)\b/.exec(normalized);
  if (invoice) return { documentType: 'invoice', matched: invoice[0] };
  const boleto = /\b(boleto|boletos)\b/.exec(normalized);
  return boleto ? { documentType: 'boleto', matched: boleto[0] } : {};
}

function removeMatched(value: string, matched?: string): string {
  return matched ? value.replace(matched, ' ') : value;
}

export class HomeSearchQueryParser {
  public parse(original: string, referenceDate = new Date()): HomeSearchParsedQuery {
    const normalized = normalizeHomeSearchText(original);
    if (!normalized) {
      return { original, normalized, text: '', detectedTypes: [] };
    }

    const financialResult = matchHomeSearchFinancialMetric(normalized);
    const businessResult = financialResult ? undefined : matchHomeSearchBusinessIntent(normalized);
    const normalizedWithoutFinancial = removeMatched(normalized, financialResult?.alias);
    const normalizedWithoutIntent = removeMatched(
      normalizedWithoutFinancial,
      businessResult?.alias,
    );
    const parsedPeriod = parsePeriod(normalized, referenceDate.getFullYear(), referenceDate);
    const defaultsToCurrentMonth = Boolean(
      financialResult ||
      businessResult?.routeMetric ||
      businessResult?.periodSummary ||
      (businessResult?.factoryMetric && !businessResult.factoryStatus),
    );
    const periodResult =
      defaultsToCurrentMonth && !parsedPeriod.period
        ? {
            period: {
              kind: 'month' as const,
              month: referenceDate.getMonth() + 1,
              year: referenceDate.getFullYear(),
            },
          }
        : parsedPeriod;
    const statusResult = parsePaymentStatus(normalizedWithoutIntent);
    const documentResult = parseDocument(normalizedWithoutIntent);
    const quantityMatch = /\b(\d+(?:[.,]\d+)?)\s*baldes?\b/.exec(normalizedWithoutIntent);
    const moneyMatch =
      /(?:\br\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})|\d+(?:[.,]\d{1,2})?)|(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})|\d+(?:[.,]\d{1,2})?)\s*reais?\b)/.exec(
        normalized,
      );
    const quantity = quantityMatch ? Number(quantityMatch[1].replace(',', '.')) : undefined;
    const moneyValue = moneyMatch?.[1] ?? moneyMatch?.[2];
    const money = moneyValue ? Number(moneyValue.replace(/\./g, '').replace(',', '.')) : undefined;

    let text = normalized;
    text = removeMatched(text, financialResult?.alias);
    text = removeMatched(text, businessResult?.alias);
    text = removeMatched(text, periodResult.matched);
    text = removeMatched(text, statusResult.matched);
    text = removeMatched(text, documentResult.matched);
    text = removeMatched(text, quantityMatch?.[0]);
    if (money !== undefined) text = removeMatched(text, moneyMatch?.[0]);
    text = text.replace(/\s+/g, ' ').trim();
    const clientField =
      businessResult?.clientField ??
      (text &&
      documentResult.documentType &&
      !periodResult.period &&
      quantity === undefined &&
      money === undefined &&
      !statusResult.status
        ? documentResult.documentType === 'invoice'
          ? ('usesInvoice' as const)
          : ('usesBoleto' as const)
        : undefined);

    const detectedTypes: HomeSearchDetectedType[] = [];
    if (text) detectedTypes.push('text');
    if (periodResult.period) detectedTypes.push(periodResult.period.kind);
    if (quantity !== undefined) detectedTypes.push('quantity');
    if (money !== undefined) detectedTypes.push('money');
    if (statusResult.status) detectedTypes.push('paymentStatus');
    if (documentResult.documentType) detectedTypes.push('document');
    if (financialResult) detectedTypes.push('financialMetric');
    if (clientField) detectedTypes.push('clientField');
    if (businessResult?.factoryMetric) detectedTypes.push('factoryMetric');
    if (businessResult?.routeMetric) detectedTypes.push('routeMetric');
    if (businessResult?.carMetric) detectedTypes.push('carMetric');
    if (businessResult?.periodSummary) detectedTypes.push('periodSummary');

    return {
      original,
      normalized,
      text,
      ...(periodResult.period ? { period: periodResult.period } : {}),
      ...(quantity !== undefined ? { quantity } : {}),
      ...(money !== undefined ? { money } : {}),
      ...(statusResult.status ? { paymentStatus: statusResult.status } : {}),
      ...(documentResult.documentType ? { documentType: documentResult.documentType } : {}),
      ...(financialResult
        ? {
            financialMetric: financialResult.definition.metric,
            financialMetricAlias: financialResult.alias,
          }
        : {}),
      ...(clientField ? { clientField } : {}),
      ...(businessResult?.factoryMetric ? { factoryMetric: businessResult.factoryMetric } : {}),
      ...(businessResult?.factoryStatus ? { factoryStatus: businessResult.factoryStatus } : {}),
      ...(businessResult?.factoryPaymentDateUnsupported
        ? { factoryPaymentDateUnsupported: true as const }
        : {}),
      ...(businessResult?.routeMetric ? { routeMetric: businessResult.routeMetric } : {}),
      ...(businessResult?.carMetric ? { carMetric: businessResult.carMetric } : {}),
      ...(businessResult?.periodSummary ? { periodSummary: true as const } : {}),
      detectedTypes,
    };
  }
}

export const homeSearchQueryParser = new HomeSearchQueryParser();
