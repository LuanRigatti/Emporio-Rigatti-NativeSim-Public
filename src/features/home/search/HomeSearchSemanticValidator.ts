import { normalizeHomeSearchText } from './HomeSearchQueryParser';
import type {
  HomeSearchAnalysis,
  HomeSearchAnalysisGroupBy,
  HomeSearchAnalysisOperation,
  HomeSearchFinancialMetric,
} from './HomeSearchTypes';

type SemanticValidationFailure = {
  reason:
    | 'dimensionMismatch'
    | 'operationMismatch'
    | 'missingComparisonPeriods'
    | 'missingRatioMetrics'
    | 'missingTopNLimit'
    | 'unsupportedMetricDimension';
};

type SemanticValidationResult = { valid: true } | ({ valid: false } & SemanticValidationFailure);

type DimensionCue = {
  dimension: HomeSearchAnalysisGroupBy;
  terms: readonly string[];
};

const DIMENSION_CUES: readonly DimensionCue[] = [
  {
    dimension: 'day',
    terms: [
      'por dia',
      'diario',
      'diaria',
      'qual dia',
      'dia que',
      'dia teve',
      'melhor dia',
      'pior dia',
      'maior dia',
      'menor dia',
      'cada dia',
    ],
  },
  {
    dimension: 'week',
    terms: [
      'por semana',
      'semanal',
      'qual semana',
      'semana que',
      'semana teve',
      'melhor semana',
      'pior semana',
    ],
  },
  {
    dimension: 'client',
    terms: [
      'por cliente',
      'qual cliente',
      'cliente que',
      'clientes que',
      'melhor cliente',
      'pior cliente',
    ],
  },
  {
    dimension: 'month',
    terms: [
      'por mes',
      'mensal',
      'qual mes',
      'mes que',
      'mes teve',
      'melhor mes',
      'pior mes',
      'cada mes',
    ],
  },
  { dimension: 'year', terms: ['por ano', 'anual', 'qual ano', 'ano que', 'ano teve', 'cada ano'] },
  {
    dimension: 'route',
    terms: ['por rota', 'qual rota', 'rota mais', 'rota menos', 'melhor rota', 'pior rota'],
  },
  {
    dimension: 'factory',
    terms: ['por fabrica', 'fabrica que', 'compra da fabrica', 'melhor compra', 'pior compra'],
  },
];

const MAX_TERMS = ['mais', 'maior', 'melhor', 'maiores', 'melhores', 'maximo', 'maxima', 'top'];
const MIN_TERMS = ['menos', 'menor', 'pior', 'menores', 'piores', 'minimo', 'minima'];
const AVERAGE_TERMS = ['media', 'medio', 'media de'];
const COMPARISON_TERMS = ['compare', 'comparar', 'cresceu', 'caiu', 'variacao', 'em relacao'];
const REPORT_TERMS = ['relatorio', 'resumo financeiro'];
const RATIO_TERMS = ['por entrega', 'por km', 'por quilometro', 'por balde', 'margem'];
const NATURAL_QUESTION_TERMS = [
  'qual',
  'quais',
  'quanto',
  'quantos',
  'quantas',
  'como',
  'onde',
  'quando',
  'mostre',
  'me diga',
  'faca',
  'calcule',
  'some',
  'compare',
  'explique',
];

function containsAny(normalized: string, terms: readonly string[]): boolean {
  const searchable = ` ${normalized.replace(/[?!.,;:]/g, ' ')} `;
  return terms.some((term) => searchable.includes(` ${term} `));
}

function explicitDimensions(original: string): HomeSearchAnalysisGroupBy[] {
  const normalized = normalizeHomeSearchText(original);
  return DIMENSION_CUES.filter((cue) => containsAny(normalized, cue.terms)).map(
    (cue) => cue.dimension,
  );
}

export function hasSemanticAnalysisSignals(original: string): boolean {
  const normalized = normalizeHomeSearchText(original);
  return Boolean(
    explicitDimensions(normalized).length > 0 ||
    containsAny(normalized, MAX_TERMS) ||
    containsAny(normalized, MIN_TERMS) ||
    containsAny(normalized, AVERAGE_TERMS) ||
    containsAny(normalized, COMPARISON_TERMS) ||
    containsAny(normalized, REPORT_TERMS) ||
    containsAny(normalized, RATIO_TERMS),
  );
}

export function hasNaturalLanguageQuestionSignals(original: string): boolean {
  const normalized = normalizeHomeSearchText(original);
  return normalized.endsWith('?') || containsAny(normalized, NATURAL_QUESTION_TERMS);
}

function operationMatchesLanguage(
  normalized: string,
  operation: HomeSearchAnalysisOperation,
): boolean {
  if (containsAny(normalized, MAX_TERMS)) {
    return ['max', 'rank', 'topN'].includes(operation);
  }
  if (containsAny(normalized, MIN_TERMS)) {
    return ['min', 'rank', 'topN'].includes(operation);
  }
  if (containsAny(normalized, AVERAGE_TERMS)) {
    return ['average', 'ratio'].includes(operation);
  }
  if (containsAny(normalized, COMPARISON_TERMS)) {
    return ['compare', 'percentageChange'].includes(operation);
  }
  if (containsAny(normalized, REPORT_TERMS)) return operation === 'report';
  return true;
}

function metricSupportsGroupBy(
  metric: HomeSearchFinancialMetric | undefined,
  groupBy: HomeSearchAnalysisGroupBy,
): boolean {
  if (!metric) return true;
  if (metric === 'bucketPrice') return groupBy === 'client';
  if (groupBy === 'route') return metric === 'distanceKm';
  if (groupBy === 'factory') {
    return ['factoryCost', 'bucketsSold', 'received', 'receivable'].includes(metric);
  }
  if (['factoryCost'].includes(metric)) return false;
  if (['distanceKm', 'profitPerKm', 'revenuePerKm', 'costPerKm'].includes(metric)) {
    return groupBy !== 'client';
  }
  return true;
}

export function validateHomeSearchAnalysis(
  original: string,
  analysis: HomeSearchAnalysis,
  metric?: HomeSearchFinancialMetric,
): SemanticValidationResult {
  const normalized = normalizeHomeSearchText(original);
  const dimensions = [...new Set(explicitDimensions(normalized))];
  if (dimensions.length === 1 && dimensions[0] !== analysis.groupBy) {
    return { valid: false, reason: 'dimensionMismatch' };
  }
  if (!operationMatchesLanguage(normalized, analysis.operation)) {
    return { valid: false, reason: 'operationMismatch' };
  }
  if (!metricSupportsGroupBy(metric, analysis.groupBy)) {
    return { valid: false, reason: 'unsupportedMetricDimension' };
  }
  if (['max', 'min', 'rank', 'topN'].includes(analysis.operation) && !analysis.groupBy) {
    return { valid: false, reason: 'dimensionMismatch' };
  }
  if (['compare', 'percentageChange'].includes(analysis.operation)) {
    if (!analysis.comparisonPeriods) {
      return { valid: false, reason: 'missingComparisonPeriods' };
    }
  }
  if (
    analysis.operation === 'ratio' &&
    (!analysis.numeratorMetric || !analysis.denominatorMetric)
  ) {
    return { valid: false, reason: 'missingRatioMetrics' };
  }
  if (analysis.operation === 'topN' && (!analysis.limit || analysis.limit < 1)) {
    return { valid: false, reason: 'missingTopNLimit' };
  }
  if (
    analysis.secondaryMetric &&
    !metricSupportsGroupBy(analysis.secondaryMetric, analysis.groupBy)
  ) {
    return { valid: false, reason: 'unsupportedMetricDimension' };
  }
  return { valid: true };
}
