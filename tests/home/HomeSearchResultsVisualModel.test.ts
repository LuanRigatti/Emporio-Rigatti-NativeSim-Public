import { createHomeSearchResultVisualModel } from '@/features/home/components/HomeSearchResultsVisualModel';
import type {
  HomeSearchClientResult,
  HomeSearchDeliveryResult,
  HomeSearchParsedQuery,
  HomeSearchResponse,
  HomeSearchResult,
  HomeSearchRouteSummaryResult,
} from '@/features/home/search/HomeSearchTypes';

function response(query: HomeSearchParsedQuery, results: HomeSearchResult[]): HomeSearchResponse {
  return {
    query,
    results,
    counts: {
      carSetting: results.filter(({ type }) => type === 'carSetting').length,
      client: results.filter(({ type }) => type === 'client').length,
      delivery: results.filter(({ type }) => type === 'delivery').length,
      factoryPurchase: results.filter(({ type }) => type === 'factoryPurchase').length,
      factorySummary: results.filter(({ type }) => type === 'factorySummary').length,
      financialMetric: results.filter(({ type }) => type === 'financialMetric').length,
      periodSummary: results.filter(({ type }) => type === 'periodSummary').length,
      routeSummary: results.filter(({ type }) => type === 'routeSummary').length,
      assistant: results.filter(({ type }) => type === 'assistant').length,
    },
    coverage: [],
    errors: [],
    durationMs: 1,
    stale: false,
  };
}

const baseQuery: HomeSearchParsedQuery = {
  detectedTypes: [],
  normalized: '',
  original: '',
  text: '',
};

function deliveryResult(id: string, title: string): HomeSearchDeliveryResult {
  return {
    type: 'delivery',
    id,
    title,
    date: '2026-08-14',
    score: 500,
    data: {
      quantity: 2,
      value: 100,
      paymentStatus: 'Pendente',
      delivered: false,
      facets: ['receivable'],
    },
    relations: {},
  };
}

function routeResult(): HomeSearchRouteSummaryResult {
  return {
    type: 'routeSummary',
    id: 'routeSummary:day',
    title: 'Rotas do dia',
    score: 1,
    data: {
      period: { kind: 'date', date: '2026-08-13' },
      metric: 'routes',
      distanceKm: 12.5,
      routeCount: 2,
      durationSeconds: 3720,
      pointsCount: 42,
      startTimestamp: Date.parse('2026-08-13T08:00:00-03:00'),
      endTimestamp: Date.parse('2026-08-13T09:02:00-03:00'),
      consideredDistanceKm: 10.2,
      sessions: [
        {
          sessionId: 'session-a',
          date: '2026-08-13',
          distanceKm: 7.5,
          dailyDistanceKm: 12.5,
          durationSeconds: 1800,
          pointsCount: 20,
          startTimestamp: Date.parse('2026-08-13T08:00:00-03:00'),
          endTimestamp: Date.parse('2026-08-13T08:30:00-03:00'),
        },
        {
          sessionId: 'session-b',
          date: '2026-08-13',
          distanceKm: 5,
          dailyDistanceKm: 12.5,
          durationSeconds: 1920,
          pointsCount: 22,
          startTimestamp: Date.parse('2026-08-13T08:32:00-03:00'),
          endTimestamp: Date.parse('2026-08-13T09:02:00-03:00'),
        },
      ],
    },
    relations: { sessionIds: ['session-a', 'session-b'] },
  };
}

describe('HomeSearchResultVisualModel', () => {
  it('preserves empty state as structured visual data', () => {
    const model = createHomeSearchResultVisualModel(
      response({ ...baseQuery, original: 'endereço inexistente' }, []),
    );

    expect(model).toMatchObject({
      empty: true,
      state: { kind: 'empty', title: 'Nenhum resultado' },
    });
  });

  it('keeps route session IDs separate from rendered label/value rows', () => {
    const model = createHomeSearchResultVisualModel(
      response(
        {
          ...baseQuery,
          original: 'rotas de hoje',
          period: { kind: 'date', date: '2026-08-13' },
          routeMetric: 'routes',
        },
        [routeResult()],
      ),
    );

    expect(model.routePager).toBe(true);
    expect(model.items).toHaveLength(2);
    expect(model.items.map((item) => item.route?.sessionIds)).toEqual([
      ['session-b'],
      ['session-a'],
    ]);
    expect(model.items.every((item) => item.metric === undefined)).toBe(true);
    expect(model.items[0].header?.subtitle).toBeUndefined();
    expect(model.items[0].sections[0].rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Início' }),
        expect.objectContaining({ label: 'Fim' }),
        expect.objectContaining({ label: 'Duração' }),
      ]),
    );
    expect(model.items[0].sections[0].rows).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ label: 'Pontos GPS' })]),
    );
    expect(model.items[0].sections[0].rows).toEqual(
      expect.arrayContaining([expect.objectContaining({ value: '09:02' })]),
    );
    expect(model.sections[0].rows.every((row) => !row.value.startsWith('Início:'))).toBe(true);
  });

  it('identifies single-day route results and keeps details compact', () => {
    const base = routeResult();
    const singleRoute: HomeSearchRouteSummaryResult = {
      ...base,
      data: {
        ...base.data,
        period: { kind: 'dayMonth', day: 14, month: 8 },
        routeCount: 1,
        sessions: [base.data.sessions[0]],
      },
    };
    const model = createHomeSearchResultVisualModel(
      response(
        {
          ...baseQuery,
          period: { kind: 'dayMonth', day: 14, month: 8 },
          routeMetric: 'routes',
        },
        [singleRoute],
      ),
    );
    const rows = model.sections[0].rows;

    expect(model.singleDayRoute).toBe(true);
    expect(model.routePager).toBeUndefined();
    expect(rows.map(({ id }) => id)).toEqual(['distance', 'start', 'end', 'duration']);
    expect(rows.find(({ id }) => id === 'start')?.value).toBe('08:00');
  });

  it('does not mark monthly route queries as single-day route', () => {
    const base = routeResult();
    const monthlyRoute: HomeSearchRouteSummaryResult = {
      ...base,
      data: {
        ...base.data,
        period: { kind: 'month', month: 8, year: 2026 },
      },
    };
    const model = createHomeSearchResultVisualModel(
      response(
        {
          ...baseQuery,
          period: { kind: 'month', month: 8, year: 2026 },
          routeMetric: 'routes',
        },
        [monthlyRoute],
      ),
    );

    expect(model.singleDayRoute).toBeUndefined();
    expect(model.routePager).toBe(true);
  });

  it('renders every concrete delivery for a multi-delivery payment query', () => {
    const model = createHomeSearchResultVisualModel(
      response({ ...baseQuery, original: 'Em aberto', paymentStatus: 'open' }, [
        deliveryResult('delivery-helder', 'Helder'),
        deliveryResult('delivery-ana', 'Ana'),
        deliveryResult('delivery-joao', 'JoÃ£o'),
      ]),
    );

    expect(model.items).toHaveLength(3);
    expect(model.items.map((item) => item.header?.title)).toEqual(['Helder', 'Ana', 'JoÃ£o']);
    expect(model.items.every((item) => item.metric === undefined)).toBe(true);
    expect(model.items.every((item) => item.sections[0].rows.length === 4)).toBe(true);
  });

  it('marks client results with isClient, hides query context and renders all 7 summary rows', () => {
    const clientResult: HomeSearchClientResult = {
      type: 'client',
      id: 'client:andre',
      clientId: 'client:andre',
      title: 'André',
      score: 100,
      data: {
        usesInvoice: false,
        usesBoleto: false,
        aggregation: {
          deliveryIds: [],
          deliveryCount: 5,
          quantity: 20,
          revenue: 1000,
          paid: 1000,
          pending: 0,
          currentPrice: 50,
          netProfit: 300,
          revenueShare: 10.5,
          netProfitShare: 12.3,
        },
      },
      relations: { deliveryIds: [] },
    };

    const model = createHomeSearchResultVisualModel(
      response({ ...baseQuery, original: 'Andre', text: 'Andre' }, [clientResult]),
    );

    expect(model.isClient).toBe(true);
    expect(model.hideQueryContext).toBe(true);
    expect(model.header?.title).toBe('André');
    expect(model.sections[0].rows).toHaveLength(7);
    expect(model.sections[0].rows.map((row) => row.label)).toEqual([
      'Entregas',
      'Baldes',
      'Valor do balde',
      'Faturamento total',
      'Lucro líquido total',
      'Participação no faturamento',
      'Participação no lucro',
    ]);
    expect(model.sections[0].rows.find((row) => row.id === 'bucket-price')?.value).toContain(
      '50,00',
    );
    expect(model.sections[0].rows.find((row) => row.id === 'total-revenue')?.value).toContain(
      '1.000,00',
    );
    expect(model.sections[0].rows.find((row) => row.id === 'total-net-profit')?.value).toContain(
      '300,00',
    );
    expect(model.sections[0].rows.find((row) => row.id === 'revenue-share')?.value).toBe('10,5%');
    expect(model.sections[0].rows.find((row) => row.id === 'profit-share')?.value).toBe('12,3%');
  });

  it('standardizes financialMetric results with isFinancialLayout, hides query context and removes header icon', () => {
    const financialResult: Extract<HomeSearchResult, { type: 'financialMetric' }> = {
      type: 'financialMetric',
      id: 'financialMetric:revenue:global:faturamento-agosto',
      title: 'Faturamento',
      score: 2000,
      data: {
        available: true,
        metric: 'revenue',
        period: { kind: 'month', month: 8, year: 2026 },
        unit: 'currency',
        value: 7271.7,
        supportingData: {
          bucketsSold: 150,
          deliveryCount: 30,
          revenue: 7271.7,
          totalCosts: 2500,
        },
      },
      relations: {},
    };

    const model = createHomeSearchResultVisualModel(
      response(
        {
          ...baseQuery,
          original: 'Faturamento agosto',
          period: { kind: 'month', month: 8, year: 2026 },
          financialMetric: 'revenue',
        },
        [financialResult],
      ),
    );

    expect(model.isFinancialLayout).toBe(true);
    expect(model.hideQueryContext).toBe(true);
    expect(model.header?.systemImage).toBeUndefined();
    expect(model.header?.title).toBe('Agosto de 2026');
    expect(model.metric?.value).toBe('R$\u00a07.271,70');
    expect(model.sections[0].title).toBe('Base do cálculo');
  });

  it('preserves header icon for financialMetric with explicit client scope', () => {
    const clientFinancialResult: Extract<HomeSearchResult, { type: 'financialMetric' }> = {
      type: 'financialMetric',
      id: 'financialMetric:revenue:client:luciano:faturamento-luciano-agosto',
      title: 'Luciano',
      score: 2500,
      data: {
        available: true,
        clientId: 'client:luciano',
        clientName: 'Luciano',
        metric: 'revenue',
        period: { kind: 'month', month: 8, year: 2026 },
        unit: 'currency',
        value: 1200,
      },
      relations: { clientId: 'client:luciano' },
    };

    const model = createHomeSearchResultVisualModel(
      response(
        {
          ...baseQuery,
          original: 'Faturamento Luciano agosto',
          text: 'Luciano',
          period: { kind: 'month', month: 8, year: 2026 },
          financialMetric: 'revenue',
        },
        [clientFinancialResult],
      ),
    );

    expect(model.isFinancialLayout).toBeFalsy();
    expect(model.header?.systemImage).toBe('chart.bar.fill');
    expect(model.header?.title).toBe('Luciano');
  });

  it('renders "Quilometragem total" and "Rotas" in the Operação section of periodSummary', () => {
    const periodSummaryResult: Extract<HomeSearchResult, { type: 'periodSummary' }> = {
      type: 'periodSummary',
      id: 'periodSummary:agosto',
      title: 'Resumo do período',
      score: 2000,
      data: {
        period: { kind: 'month', month: 8, year: 2026 },
        financial: {
          faturamento: 1000,
          valoresPagos: 800,
          valoresPendentes: 200,
          quantidadeBaldes: 20,
          custoTotalBaldes: 400,
          custoCombustivel: 200,
          custoEstar: 50,
          custoOutros: 20,
          custoLuz: 30,
          custoTotal: 700,
          lucroBruto: 600,
          lucroLiquido: 300,
          margemBruta: 60,
          margemLiquida: 30,
          custoMedioBalde: 20,
          precoMedioBalde: 50,
          lucroLiquidoPorBalde: 15,
          quantidadeEntregas: 5,
          custoMedioCombustivelPorEntrega: 40,
        },
        factory: {
          openValue: 0,
          receiptCount: 1,
          totalBuckets: 10,
          totalPaid: 350,
          totalValue: 350,
          paymentCount: 1,
          progress: 100,
        },
        routes: {
          routeCount: 3,
          distanceKm: 126.85,
        },
      },
      relations: {
        deliveryIds: [],
        paymentIds: [],
        receiptIds: [],
        sessionIds: [],
      },
    };

    const model = createHomeSearchResultVisualModel(
      response(
        {
          ...baseQuery,
          original: 'resumo agosto',
          period: { kind: 'month', month: 8, year: 2026 },
          periodSummary: true,
        },
        [periodSummaryResult],
      ),
    );

    const opSection = model.sections.find((s) => s.id === 'period-operations');
    expect(opSection).toBeDefined();
    expect(opSection?.rows.find((r) => r.id === 'routes')?.label).toBe('Rotas');
    expect(opSection?.rows.find((r) => r.id === 'routes')?.value).toBe('3');
    expect(opSection?.rows.find((r) => r.id === 'distance')?.label).toBe('Quilometragem total');
    expect(opSection?.rows.find((r) => r.id === 'distance')?.value).toBe('126,85 km');

    const todayModel = createHomeSearchResultVisualModel(
      response(
        {
          ...baseQuery,
          normalized: 'resumo hoje',
          original: 'resumo hoje',
          period: { kind: 'date', date: '2026-08-31' },
          periodSummary: true,
        },
        [periodSummaryResult],
      ),
    );
    expect(todayModel.sections.map((section) => section.id)).toEqual([
      'period-financial',
      'period-operations',
    ]);
    expect(todayModel.sections[0].rows.at(-1)?.id).toBe('net-profit');
    expect(todayModel.sections[1].rows.at(-1)).toMatchObject({
      id: 'distance',
      label: 'Quilometragem total',
      value: '126,85 km',
    });
  });
});
