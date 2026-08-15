import { createHomeSearchResultVisualModel } from '@/features/home/components/HomeSearchResultsVisualModel';
import type {
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
    expect(model.items.every((item) => item.metric?.value === '1 rota')).toBe(true);
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

  it('keeps single-route details compact', () => {
    const base = routeResult();
    const singleRoute: HomeSearchRouteSummaryResult = {
      ...base,
      data: {
        ...base.data,
        routeCount: 1,
        sessions: [base.data.sessions[0]],
      },
    };
    const model = createHomeSearchResultVisualModel(
      response({ ...baseQuery, routeMetric: 'routes' }, [singleRoute]),
    );
    const rows = model.sections[0].rows;

    expect(rows.map(({ id }) => id)).toEqual(['distance', 'start', 'end', 'duration']);
    expect(rows.find(({ id }) => id === 'start')?.value).toBe('08:00');
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
});
