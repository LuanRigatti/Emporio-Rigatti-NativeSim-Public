import { HomeSearchService } from '@/features/home/search/HomeSearchService';
import { maskCurrency } from '@/utils/presentation/testModeValues';
import {
  toHomeSearchParsedQuery,
  type HomeSearchSearchInterpreter,
  type NativeAppleIntelligenceSearchIntent,
} from '@/features/home/search/AppleIntelligenceSearchInterpreter';
import type { HomeSearchDataSet } from '@/features/home/search/HomeSearchTypes';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(undefined),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

const emptyData: HomeSearchDataSet = {
  clients: [],
  deliveries: [],
  factoryPurchases: [],
  coverage: [],
  errors: [],
};

const baseIntent: NativeAppleIntelligenceSearchIntent = {
  confidence: 0.94,
  intent: 'financialMetric',
  text: '',
  periodKind: 'month',
  date: '',
  startDate: '',
  endDate: '',
  day: -1,
  month: 8,
  year: 2026,
  quantity: -1,
  money: -1,
  paymentStatus: '',
  documentType: '',
  financialMetric: 'netProfit',
  clientField: '',
  factoryMetric: '',
  factoryStatus: '',
  factoryPaymentDateUnsupported: false,
  routeMetric: '',
  carMetric: '',
  periodSummary: false,
  operation: '',
  groupBy: '',
  order: '',
  comparisonStartMonth: -1,
  comparisonStartYear: -1,
  comparisonEndMonth: -1,
  comparisonEndYear: -1,
};

describe('Apple Intelligence Home Search intent conversion', () => {
  it('converts a valid structured intent without calculating any value', () => {
    const query = toHomeSearchParsedQuery('quanto eu lucrei em agosto?', baseIntent);

    expect(query).toMatchObject({
      financialMetric: 'netProfit',
      period: { kind: 'month', month: 8, year: 2026 },
    });
    expect(query).not.toHaveProperty('value');
    expect(query).not.toHaveProperty('total');
  });

  it('keeps a scalar monthly metric distinct from an analytical daily maximum', () => {
    const scalar = toHomeSearchParsedQuery('Quanto faturei em agosto?', {
      ...baseIntent,
      financialMetric: 'revenue',
    });
    const analysis = toHomeSearchParsedQuery('Qual dia teve o maior faturamento em agosto?', {
      ...baseIntent,
      intent: 'financialAnalysis',
      financialMetric: 'revenue',
      operation: 'max',
      groupBy: 'day',
    });

    expect(scalar).not.toHaveProperty('analysis');
    expect(analysis).toMatchObject({
      analysis: { groupBy: 'day', operation: 'max' },
      financialMetric: 'revenue',
    });
  });

  it.each([
    ['Qual foi o melhor cliente que eu vendi no mês passado?', 'revenue', 'max', 'client'],
    ['Qual foi o melhor dia de venda do mês passado?', 'revenue', 'max', 'day'],
    ['Qual foi o dia que menos vendi em agosto?', 'revenue', 'min', 'day'],
    ['Qual foi o pior dia de venda de agosto?', 'revenue', 'min', 'day'],
    ['Qual cliente mais comprou em agosto?', 'revenue', 'max', 'client'],
    ['Em qual dia tive mais entregas?', 'deliveryCount', 'max', 'day'],
    ['Qual mês teve maior lucro este ano?', 'netProfit', 'max', 'month'],
  ] as const)('converts analytical intent for %s', (queryText, metric, operation, groupBy) => {
    const query = toHomeSearchParsedQuery(queryText, {
      ...baseIntent,
      intent: 'financialAnalysis',
      financialMetric: metric,
      operation,
      groupBy,
      ...(groupBy === 'month' ? { periodKind: 'year', month: -1 } : {}),
    });

    expect(query).toMatchObject({
      analysis: { groupBy, operation },
      financialMetric: metric,
    });
  });

  it.each(['Qual cliente tem o balde mais caro?', 'Qual o balde mais caro e de qual cliente?'])(
    'converts current client bucket price analysis for %s',
    (queryText) => {
      const query = toHomeSearchParsedQuery(queryText, {
        ...baseIntent,
        intent: 'financialAnalysis',
        financialMetric: 'bucketPrice',
        periodKind: 'none',
        month: -1,
        year: -1,
        operation: 'max',
        groupBy: 'client',
      });

      expect(query).toMatchObject({
        analysis: { groupBy: 'client', operation: 'max' },
        financialMetric: 'bucketPrice',
      });
      expect(query?.period).toBeUndefined();
    },
  );

  it('resolves a missing native monthly year from the search reference date', () => {
    const query = toHomeSearchParsedQuery(
      'Qual cliente mais comprou no mês passado?',
      {
        ...baseIntent,
        intent: 'financialAnalysis',
        financialMetric: 'revenue',
        operation: 'max',
        groupBy: 'client',
        month: 8,
        year: -1,
      },
      new Date(2026, 8, 9, 12),
    );

    expect(query?.period).toEqual({ kind: 'month', month: 8, year: 2026 });
  });

  it('resolves a relative month across a year boundary', () => {
    const query = toHomeSearchParsedQuery(
      'Qual cliente mais comprou no mês passado?',
      {
        ...baseIntent,
        intent: 'financialAnalysis',
        financialMetric: 'revenue',
        operation: 'max',
        groupBy: 'client',
        month: 12,
        year: -1,
      },
      new Date(2026, 0, 9, 12),
    );

    expect(query?.period).toEqual({ kind: 'month', month: 12, year: 2025 });
  });

  it('defaults an otherwise valid analysis to the explicit reference month', () => {
    const query = toHomeSearchParsedQuery(
      'Meu faturamento está subindo?',
      {
        ...baseIntent,
        intent: 'financialAnalysis',
        periodKind: 'none',
        financialMetric: 'revenue',
        operation: 'trend',
        groupBy: 'month',
        month: -1,
        year: -1,
      },
      new Date(2026, 8, 9, 12),
    );

    expect(query?.period).toEqual({ kind: 'month', month: 9, year: 2026 });
  });

  it('rejects bucket price outside a client analysis', () => {
    expect(
      toHomeSearchParsedQuery('preço do balde', {
        ...baseIntent,
        intent: 'financialMetric',
        financialMetric: 'bucketPrice',
      }),
    ).toBeNull();
  });

  it('converts a two-month comparison without collapsing it into one month', () => {
    const query = toHomeSearchParsedQuery('Compare julho com agosto', {
      ...baseIntent,
      intent: 'financialAnalysis',
      financialMetric: 'revenue',
      operation: 'compare',
      groupBy: 'month',
      periodKind: 'range',
      startDate: '2026-07-01',
      endDate: '2026-08-31',
      month: -1,
      year: -1,
      comparisonStartMonth: 7,
      comparisonStartYear: 2026,
      comparisonEndMonth: 8,
      comparisonEndYear: 2026,
    });

    expect(query).toMatchObject({
      analysis: {
        comparisonPeriods: [
          { kind: 'month', month: 7, year: 2026 },
          { kind: 'month', month: 8, year: 2026 },
        ],
        groupBy: 'month',
        operation: 'compare',
      },
      period: { kind: 'range', startDate: '2026-07-01', endDate: '2026-08-31' },
    });
  });

  it('accepts the extended analytical operation, grouping and derived-metric fields', () => {
    const topN = toHomeSearchParsedQuery('meus 5 melhores clientes', {
      ...baseIntent,
      intent: 'financialAnalysis',
      financialMetric: 'revenue',
      operation: 'topN',
      groupBy: 'client',
      limit: 5,
      order: 'descending',
    });
    expect(topN).toMatchObject({
      analysis: { operation: 'topN', groupBy: 'client', limit: 5, order: 'descending' },
    });

    const bottomN = toHomeSearchParsedQuery('meus 3 menores clientes', {
      ...baseIntent,
      intent: 'financialAnalysis',
      financialMetric: 'revenue',
      operation: 'topN',
      groupBy: 'client',
      limit: 3,
      order: 'ascending',
    });
    expect(bottomN).toMatchObject({ analysis: { operation: 'topN', order: 'ascending' } });

    const ratio = toHomeSearchParsedQuery('lucro por entrega', {
      ...baseIntent,
      intent: 'financialAnalysis',
      financialMetric: 'profitPerDelivery',
      operation: 'ratio',
      groupBy: 'month',
      numeratorMetric: 'netProfit',
      denominatorMetric: 'deliveryCount',
    });
    expect(ratio).toMatchObject({
      analysis: {
        operation: 'ratio',
        numeratorMetric: 'netProfit',
        denominatorMetric: 'deliveryCount',
      },
    });

    const report = toHomeSearchParsedQuery('relatório de agosto', {
      ...baseIntent,
      intent: 'financialAnalysis',
      financialMetric: '',
      operation: 'report',
      groupBy: '',
    });
    expect(report).toMatchObject({
      financialMetric: 'revenue',
      analysis: { operation: 'report', groupBy: 'month' },
    });
  });

  it.each([
    'qual foi o melhor dia de faturamento no mês passado?',
    'em que dia mais vendi no mês anterior?',
    'qual dia teve a maior receita no último mês?',
  ])('converges equivalent natural-language forms to one daily plan: %s', (queryText) => {
    const query = toHomeSearchParsedQuery(queryText, {
      ...baseIntent,
      intent: 'financialAnalysis',
      financialMetric: 'revenue',
      operation: 'max',
      groupBy: 'day',
      month: 8,
      year: 2026,
    });

    expect(query).toMatchObject({
      analysis: { operation: 'max', groupBy: 'day' },
      financialMetric: 'revenue',
      period: { kind: 'month', month: 8, year: 2026 },
    });
  });

  it('resolves a relative multi-period span from the supplied reference date', () => {
    const query = toHomeSearchParsedQuery(
      'some o faturamento dos últimos 3 meses',
      {
        ...baseIntent,
        intent: 'financialAnalysis',
        financialMetric: 'revenue',
        operation: 'sum',
        groupBy: 'month',
        periodKind: 'none',
        month: -1,
        year: -1,
        periodSpanUnit: 'month',
        periodSpanDirection: 'last',
        periodSpanCount: 3,
      },
      new Date(2026, 8, 9, 12),
    );

    expect(query).toMatchObject({
      period: { kind: 'range', startDate: '2026-07-01', endDate: '2026-09-09' },
      periodSpan: { unit: 'month', direction: 'last', count: 3 },
    });
  });

  it('keeps filters and a secondary metric in the structured plan', () => {
    const query = toHomeSearchParsedQuery('clientes pagos por faturamento', {
      ...baseIntent,
      intent: 'financialAnalysis',
      financialMetric: 'revenue',
      operation: 'rank',
      groupBy: 'client',
      paymentStatus: 'paid',
      secondaryMetric: 'bucketsSold',
      order: 'descending',
    });

    expect(query).toMatchObject({
      analysis: {
        groupBy: 'client',
        operation: 'rank',
        order: 'descending',
        secondaryMetric: 'bucketsSold',
        filters: { paymentStatus: 'paid' },
      },
    });
  });

  it('blocks a payload whose grouping contradicts the natural-language dimension', () => {
    const query = toHomeSearchParsedQuery('qual foi o melhor dia de faturamento?', {
      ...baseIntent,
      intent: 'financialAnalysis',
      financialMetric: 'revenue',
      operation: 'max',
      groupBy: 'month',
    });

    expect(query).toMatchObject({
      assistantStatus: 'clarification',
      assistantContext: 'incoherentAnalysis',
    });
  });

  it('normalizes a multi-result maximum into topN without changing the metric', () => {
    const query = toHomeSearchParsedQuery('os 5 clientes com maior faturamento', {
      ...baseIntent,
      intent: 'financialAnalysis',
      financialMetric: 'revenue',
      operation: 'max',
      groupBy: 'client',
      limit: 5,
    });

    expect(query).toMatchObject({ analysis: { operation: 'topN', limit: 5 } });
  });

  it('accepts explicit ISO comparison periods without collapsing them', () => {
    const query = toHomeSearchParsedQuery('quanto cresceu de julho para agosto?', {
      ...baseIntent,
      intent: 'financialAnalysis',
      financialMetric: 'revenue',
      operation: 'percentageChange',
      groupBy: 'month',
      periodKind: 'none',
      month: -1,
      year: -1,
      comparisonInitialStartDate: '2026-07-01',
      comparisonInitialEndDate: '2026-07-31',
      comparisonFinalStartDate: '2026-08-01',
      comparisonFinalEndDate: '2026-08-31',
    });

    expect(query).toMatchObject({
      period: { kind: 'range', startDate: '2026-07-01', endDate: '2026-08-31' },
      analysis: {
        comparisonPeriods: [
          { kind: 'range', startDate: '2026-07-01', endDate: '2026-07-31' },
          { kind: 'range', startDate: '2026-08-01', endDate: '2026-08-31' },
        ],
      },
    });
  });

  it.each([
    ['sum', 'month', 'revenue'],
    ['average', 'month', 'revenue'],
    ['rank', 'client', 'netProfit'],
    ['topN', 'client', 'revenue'],
    ['percentageChange', 'month', 'revenue'],
    ['ratio', 'month', 'profitPerDelivery'],
    ['trend', 'month', 'revenue'],
    ['report', 'month', 'revenue'],
  ] as const)('accepts operation %s with grouping %s', (operation, groupBy, metric) => {
    const query = toHomeSearchParsedQuery(`analysis ${operation}`, {
      ...baseIntent,
      intent: 'financialAnalysis',
      financialMetric: metric,
      operation,
      groupBy,
      ...(operation === 'topN' ? { limit: 5 } : {}),
      ...(operation === 'ratio'
        ? { numeratorMetric: 'netProfit', denominatorMetric: 'deliveryCount' }
        : {}),
      ...(operation === 'percentageChange'
        ? {
            periodKind: 'range',
            startDate: '2026-07-01',
            endDate: '2026-08-31',
            month: -1,
            year: -1,
            comparisonStartMonth: 7,
            comparisonStartYear: 2026,
            comparisonEndMonth: 8,
            comparisonEndYear: 2026,
          }
        : {}),
    });

    expect(query).toMatchObject({ financialMetric: metric, analysis: { operation, groupBy } });
  });

  it.each([
    ['clarification', 'clarification'],
    ['unsupportedDomain', 'unsupportedDomain'],
    ['unsupportedMetric', 'unsupportedMetric'],
  ] as const)('keeps explicit assistant state %s instead of falling back', (intent, status) => {
    const query = toHomeSearchParsedQuery('pergunta', {
      ...baseIntent,
      intent,
      financialMetric: '',
      periodKind: 'none',
      month: -1,
      year: -1,
    });

    expect(query).toMatchObject({ assistantStatus: status, detectedTypes: ['assistant'] });
  });

  it('accepts a structurally valid intent even when model confidence is low', () => {
    const query = toHomeSearchParsedQuery('qual meu lucro em julho', {
      ...baseIntent,
      confidence: 0,
      month: 7,
    });

    expect(query).toMatchObject({
      financialMetric: 'netProfit',
      period: { kind: 'month', month: 7, year: 2026 },
    });
  });

  it('converts a native object and a JSON string through the same bridge contract', () => {
    expect(toHomeSearchParsedQuery('lucro líquido agosto', baseIntent)).toMatchObject({
      financialMetric: 'netProfit',
    });
    expect(
      toHomeSearchParsedQuery('lucro líquido agosto', JSON.stringify(baseIntent)),
    ).toMatchObject({
      financialMetric: 'netProfit',
    });
  });

  it('rejects invalid JSON and unsupported structured fields', () => {
    expect(
      toHomeSearchParsedQuery('quanto eu lucrei?', {
        ...baseIntent,
        financialMetric: 'inventedMetric',
      }),
    ).toBeNull();
    expect(toHomeSearchParsedQuery('quanto eu lucrei?', '{invalid-json')).toBeNull();
  });

  it.each([
    {
      query: 'Qual meu lucro no mes passado?',
      payload: {
        ...baseIntent,
        confidence: 0,
        month: 8,
        year: 2026,
      },
      expected: {
        financialMetric: 'netProfit',
        period: { kind: 'month', month: 8, year: 2026 },
      },
    },
    {
      query: 'Quanto faturei em agosto?',
      payload: {
        ...baseIntent,
        confidence: 0,
        financialMetric: '',
        month: 8,
        year: 2026,
      },
      expected: null,
    },
    {
      query: 'Quanto tenho em aberto?',
      payload: {
        ...baseIntent,
        confidence: 0.3,
        financialMetric: '',
        paymentStatus: 'open',
        periodKind: 'none',
        month: -1,
        year: -1,
      },
      expected: null,
    },
    {
      query: 'Quantas entregas fiz hoje?',
      payload: {
        ...baseIntent,
        confidence: 0.2,
        intent: 'delivery',
        financialMetric: '',
        periodKind: 'date',
        date: '2026-09-01',
        month: -1,
        year: -1,
      },
      expected: {
        period: { kind: 'date', date: '2026-09-01' },
      },
    },
  ])('handles captured Foundation Models payload: $query', ({ query, payload, expected }) => {
    const parsed = toHomeSearchParsedQuery(query, payload);

    if (expected === null) {
      expect(parsed).toBeNull();
      return;
    }

    expect(parsed).toMatchObject(expected);
  });

  it('accepts the native metric fields required by the financial examples', () => {
    expect(
      toHomeSearchParsedQuery('Quanto faturei em agosto?', {
        ...baseIntent,
        confidence: 0,
        financialMetric: 'revenue',
        month: 8,
        year: 2026,
      }),
    ).toMatchObject({
      financialMetric: 'revenue',
      period: { kind: 'month', month: 8, year: 2026 },
    });

    expect(
      toHomeSearchParsedQuery('Quanto tenho em aberto?', {
        ...baseIntent,
        confidence: 0.3,
        financialMetric: 'receivable',
        paymentStatus: 'open',
        periodKind: 'none',
        month: -1,
        year: -1,
      }),
    ).toMatchObject({
      financialMetric: 'receivable',
      paymentStatus: 'open',
    });
  });

  it('does not activate or bypass the existing Modo Teste presentation masking', () => {
    const query = toHomeSearchParsedQuery('quanto eu lucrei?', baseIntent);

    expect(query).not.toHaveProperty('testMode');
    expect(maskCurrency(123.45, true)).toContain('0,00');
    expect(maskCurrency(123.45, true)).not.toContain('123');
    expect(maskCurrency(123.45, false)).toContain('123');
  });
});

describe('Home Search fallback', () => {
  const dataSource = { load: async () => emptyData };

  it('uses the existing parser when Apple Intelligence is unavailable', async () => {
    const unavailable: HomeSearchSearchInterpreter = {
      interpret: async () => null,
    };
    const response = await new HomeSearchService(dataSource, unavailable).search('Luciano');

    expect(response.query.text).toBe('luciano');
  });

  it('uses the existing parser when the optional interpreter fails', async () => {
    const failing: HomeSearchSearchInterpreter = {
      interpret: async () => {
        throw new Error('Foundation Models unavailable');
      },
    };
    const response = await new HomeSearchService(dataSource, failing).search(
      'Histórico agosto',
      new Date(2026, 7, 13),
    );

    expect(response.query.period).toEqual({ kind: 'month', month: 8, year: 2026 });
  });
});
