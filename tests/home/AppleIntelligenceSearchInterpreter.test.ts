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
    ['Qual foi o dia que menos vendi em agosto?', 'revenue', 'min', 'day'],
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
