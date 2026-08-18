import { createHomeSearchResultsPresentation } from '@/features/home/components/HomeSearchResultsPresentation';
import { HomeSearchQueryParser } from '@/features/home/search/HomeSearchQueryParser';
import type {
  HomeSearchClientResult,
  HomeSearchDeliveryResult,
  HomeSearchFinancialMetricResult,
  HomeSearchParsedQuery,
  HomeSearchResponse,
  HomeSearchResult,
} from '@/features/home/search/HomeSearchTypes';

const referenceDate = new Date(2026, 7, 13, 12);

function delivery(
  id: string,
  title: string,
  quantity: number,
  date = '2026-08-12',
): HomeSearchDeliveryResult {
  return {
    type: 'delivery',
    id,
    title,
    date,
    score: 500,
    data: {
      quantity,
      value: quantity * 50,
      paymentStatus: 'Pago',
      delivered: true,
      facets: [],
    },
    relations: {},
  };
}

function client(title: string, deliveryCount: number, quantity: number): HomeSearchClientResult {
  const clientId = `client:${title.toLowerCase()}` as const;
  return {
    type: 'client',
    id: clientId,
    clientId,
    title,
    score: 1200,
    data: {
      usesInvoice: false,
      usesBoleto: false,
      aggregation: {
        deliveryIds: [],
        deliveryCount,
        quantity,
        revenue: quantity * 50,
        paid: quantity * 50,
        pending: 0,
        netProfit: quantity * 30,
        revenueShare: 10,
        netProfitShare: 10,
      },
    },
    relations: { deliveryIds: [] },
  };
}

function response(query: HomeSearchParsedQuery, results: HomeSearchResult[]): HomeSearchResponse {
  return {
    query,
    results,
    counts: {
      client: results.filter(({ type }) => type === 'client').length,
      delivery: results.filter(({ type }) => type === 'delivery').length,
      factoryPurchase: results.filter(({ type }) => type === 'factoryPurchase').length,
      financialMetric: results.filter(({ type }) => type === 'financialMetric').length,
      factorySummary: results.filter(({ type }) => type === 'factorySummary').length,
      routeSummary: results.filter(({ type }) => type === 'routeSummary').length,
      carSetting: results.filter(({ type }) => type === 'carSetting').length,
      periodSummary: results.filter(({ type }) => type === 'periodSummary').length,
    },
    coverage: [],
    errors: [],
    durationMs: 1,
    stale: false,
  };
}

function financialResult(
  overrides: Partial<HomeSearchFinancialMetricResult['data']> = {},
): HomeSearchFinancialMetricResult {
  return {
    type: 'financialMetric',
    id: 'financialMetric:netMargin:global:2026-08',
    title: 'Margem líquida',
    score: 2_000,
    data: {
      available: true,
      metric: 'netMargin',
      period: { kind: 'month', month: 8, year: 2026 },
      unit: 'percentage',
      value: 25.4,
      ...overrides,
    },
    relations: {},
  };
}

const parser = new HomeSearchQueryParser();
const periodDeliveries = [
  delivery('delivery-vaticano', 'Vaticano', 2),
  delivery('delivery-luciano', 'Luciano', 5, '2026-08-10'),
  delivery('delivery-marcia', 'Márcia', 3, '2026-08-08'),
];

describe('HomeSearchResultsPresentation', () => {
  it('does not select a client or delivery as primary for agosto', () => {
    const presentation = createHomeSearchResultsPresentation(
      response(parser.parse('agosto', referenceDate), periodDeliveries),
    );

    expect(presentation).toMatchObject({
      primaryTitle: 'Agosto de 2026',
      typeLabel: 'Período',
    });
    expect(presentation.primaryTitle).not.toBe('Vaticano');
    expect(presentation.period).toBeUndefined();
  });

  it('creates a period summary for 08/2026', () => {
    const presentation = createHomeSearchResultsPresentation(
      response(parser.parse('08/2026', referenceDate), periodDeliveries),
    );

    expect(presentation).toMatchObject({
      primaryTitle: 'Agosto de 2026',
      relatedCount: '3 entregas',
      typeLabel: 'Período',
    });
  });

  it('aggregates buckets from every returned delivery in the period', () => {
    const presentation = createHomeSearchResultsPresentation(
      response(parser.parse('agosto', referenceDate), periodDeliveries),
    );

    expect(presentation.quantity).toBe(10);
  });

  it('keeps Luciano as primary for client plus period', () => {
    const luciano = client('Luciano', 5, 16);
    const presentation = createHomeSearchResultsPresentation(
      response(parser.parse('Luciano agosto', referenceDate), [luciano, ...periodDeliveries]),
    );

    expect(presentation).toMatchObject({
      primaryTitle: 'Luciano',
      typeLabel: 'Cliente',
      relatedCount: '5 entregas relacionadas',
      quantity: 16,
      period: 'Agosto de 2026',
    });
  });

  it('creates a date summary when an exact date has no client text', () => {
    const presentation = createHomeSearchResultsPresentation(
      response(parser.parse('12/08/2026', referenceDate), [periodDeliveries[0]]),
    );

    expect(presentation).toMatchObject({
      primaryTitle: '12 de agosto de 2026',
      typeLabel: 'Período',
      relatedCount: '1 entrega',
      quantity: 2,
    });
    expect(presentation.primaryTitle).not.toBe('Vaticano');
  });

  it('keeps an empty period in the empty state', () => {
    const presentation = createHomeSearchResultsPresentation(
      response(parser.parse('01/2099', referenceDate), []),
    );

    expect(presentation).toMatchObject({
      empty: true,
      query: '01/2099',
    });
    expect(presentation.primaryTitle).toBeUndefined();
  });

  it('presents a global financial metric instead of an arbitrary delivery', () => {
    const query = parser.parse('margem líquida agosto', referenceDate);
    const presentation = createHomeSearchResultsPresentation(response(query, [financialResult()]));

    expect(presentation).toMatchObject({
      primaryTitle: 'Agosto de 2026',
      typeLabel: 'Margem líquida',
      relatedCount: '25.4%',
    });
    expect(presentation.period).toBeUndefined();
  });

  it('presents a client financial metric with its interpreted period', () => {
    const query = parser.parse('faturamento Luciano agosto', referenceDate);
    const presentation = createHomeSearchResultsPresentation(
      response(query, [
        financialResult({
          clientId: 'client:luciano',
          clientName: 'Luciano',
          metric: 'revenue',
          unit: 'currency',
          value: 800,
        }),
      ]),
    );

    expect(presentation).toMatchObject({
      primaryTitle: 'Luciano',
      typeLabel: 'Faturamento',
      relatedCount: 'R$ 800,00',
      period: 'Agosto de 2026',
    });
  });

  it('presents unsupported client net profit semantically', () => {
    const query = parser.parse('lucro líquido Luciano agosto', referenceDate);
    const presentation = createHomeSearchResultsPresentation(
      response(query, [
        financialResult({
          available: false,
          clientId: 'client:luciano',
          clientName: 'Luciano',
          metric: 'netProfit',
          unit: 'currency',
          unavailableReason: 'clientScopeUnsupported',
          value: undefined,
        }),
      ]),
    );

    expect(presentation).toMatchObject({
      primaryTitle: 'Luciano',
      typeLabel: 'Lucro líquido',
      relatedCount: 'Não disponível por cliente',
    });
  });

  it('presents a structured client field instead of delivery aggregation', () => {
    const luciano = client('Luciano', 0, 0);
    luciano.data.matchedField = {
      field: 'currentPrice',
      available: true,
      unit: 'currency',
      value: 49.8,
    };
    const presentation = createHomeSearchResultsPresentation(
      response(parser.parse('valor do balde Luciano', referenceDate), [luciano]),
    );

    expect(presentation).toMatchObject({
      primaryTitle: 'Luciano',
      typeLabel: 'Valor do balde',
    });
    expect(presentation.relatedCount).toContain('49,80');
  });

  it('presents aggregated factory buckets without choosing a receipt', () => {
    const result: HomeSearchResult = {
      type: 'factorySummary',
      id: 'factorySummary:buckets',
      title: 'Fábrica',
      score: 2_000,
      data: {
        available: true,
        metric: 'bucketsPurchased',
        period: { kind: 'month', month: 8, year: 2026 },
        aggregate: {
          receiptCount: 3,
          totalBuckets: 11,
          totalValue: 550,
          totalPaid: 250,
          openValue: 300,
          paymentCount: 2,
          progress: 250 / 550,
        },
        receipts: [],
      },
      relations: { receiptIds: ['one', 'two', 'three'], paymentIds: [] },
    };

    expect(
      createHomeSearchResultsPresentation(
        response(parser.parse('baldes comprados agosto', referenceDate), [result]),
      ),
    ).toMatchObject({
      primaryTitle: 'Agosto de 2026',
      typeLabel: 'Fábrica',
      relatedCount: '11 baldes comprados',
    });
  });

  it('presents route, car and period summary intents semantically', () => {
    const route: HomeSearchResult = {
      type: 'routeSummary',
      id: 'routeSummary:day',
      title: 'Rota',
      score: 2_000,
      data: {
        period: { kind: 'date', date: '2026-08-12' },
        metric: 'distance',
        distanceKm: 20,
        routeCount: 2,
        durationSeconds: 1200,
        pointsCount: 4,
        startTimestamp: 1_000,
        endTimestamp: 601_000,
        consideredDistanceKm: 20,
        sessions: [],
      },
      relations: { sessionIds: ['one', 'two'] },
    };
    const car: HomeSearchResult = {
      type: 'carSetting',
      id: 'carSetting:gasolineAutonomy',
      title: 'Carro',
      score: 2_000,
      data: {
        metric: 'gasolineAutonomy',
        available: true,
        gasolineKmPerLiter: 7.4,
        alcoholKmPerLiter: 5.6,
      },
      relations: {},
    };
    const summary: HomeSearchResult = {
      type: 'periodSummary',
      id: 'periodSummary:month',
      title: 'Resumo do período',
      score: 2_000,
      data: {
        period: { kind: 'month', month: 8, year: 2026 },
        financial: {
          faturamento: 250,
          valoresPagos: 150,
          valoresPendentes: 100,
          quantidadeBaldes: 5,
          custoTotalBaldes: 175,
          custoCombustivel: 10,
          custoEstar: 0,
          custoOutros: 0,
          custoLuz: 0,
          custoTotal: 185,
          lucroBruto: 75,
          lucroLiquido: 65,
          margemBruta: 30,
          margemLiquida: 26,
          custoMedioBalde: 37,
          precoMedioBalde: 50,
          lucroLiquidoPorBalde: 13,
          quantidadeEntregas: 2,
          custoMedioCombustivelPorEntrega: 5,
        },
        factory: {
          receiptCount: 1,
          totalBuckets: 10,
          totalValue: 350,
          totalPaid: 100,
          openValue: 250,
          paymentCount: 1,
          progress: 100 / 350,
        },
        routes: { routeCount: 2, distanceKm: 20 },
      },
      relations: { deliveryIds: [], paymentIds: [], receiptIds: [], sessionIds: [] },
    };

    expect(
      createHomeSearchResultsPresentation(
        response(parser.parse('km 12/08', referenceDate), [route]),
      ),
    ).toMatchObject({
      primaryTitle: '12 de agosto de 2026',
      typeLabel: 'Rota',
      relatedCount: '20 km',
      details: expect.arrayContaining([
        expect.stringMatching(/^Início:/),
        expect.stringMatching(/^Fim:/),
        'Duração: 20 min 00 s',
        'Distância: 20,00 km',
        'Km considerado no dia: 20,00 km',
      ]),
    });
    expect(
      createHomeSearchResultsPresentation(response(parser.parse('autonomia gasolina'), [car])),
    ).toMatchObject({
      primaryTitle: 'Carro',
      typeLabel: 'Autonomia gasolina',
      relatedCount: '7,4 km/l',
    });
    expect(
      createHomeSearchResultsPresentation(
        response(parser.parse('resumo agosto', referenceDate), [summary]),
      ),
    ).toMatchObject({ primaryTitle: 'Agosto de 2026', typeLabel: 'Resumo do período' });
  });
});
