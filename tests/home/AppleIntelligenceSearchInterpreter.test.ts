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

  it('accepts a valid structured intent at the observed model confidence', () => {
    const query = toHomeSearchParsedQuery('qual meu lucro em julho', {
      ...baseIntent,
      confidence: 0.65,
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

  it('rejects invalid JSON and genuinely low-confidence or unsupported intents', () => {
    expect(
      toHomeSearchParsedQuery('quanto eu lucrei?', { ...baseIntent, confidence: 0.59 }),
    ).toBeNull();
    expect(
      toHomeSearchParsedQuery('quanto eu lucrei?', {
        ...baseIntent,
        financialMetric: 'inventedMetric',
      }),
    ).toBeNull();
    expect(toHomeSearchParsedQuery('quanto eu lucrei?', '{invalid-json')).toBeNull();
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
