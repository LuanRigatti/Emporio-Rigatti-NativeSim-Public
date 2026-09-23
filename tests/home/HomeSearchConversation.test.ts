import { HomeSearchQueryParser } from '@/features/home/search/HomeSearchQueryParser';
import type { HomeSearchResponse } from '@/features/home/search/HomeSearchTypes';
import {
  homeSearchConversationReducer,
  type HomeSearchConversationTurn,
} from '@/features/home/components/HomeSearchConversationState';

const parser = new HomeSearchQueryParser();

function response(queryText: string): HomeSearchResponse {
  return {
    query: parser.parse(queryText, new Date(2026, 8, 18, 12)),
    results: [],
    counts: {
      client: 0,
      delivery: 0,
      factoryPurchase: 0,
      financialMetric: 0,
      factorySummary: 0,
      routeSummary: 0,
      carSetting: 0,
      periodSummary: 0,
      assistant: 0,
    },
    coverage: [],
    errors: [],
    durationMs: 1,
    stale: false,
  };
}

describe('HomeSearchConversationState', () => {
  it('keeps the submitted query while its response is loading', () => {
    const turns = homeSearchConversationReducer([], {
      type: 'submit',
      id: 'turn-1',
      query: 'faturamento de setembro',
    });

    expect(turns).toEqual([
      {
        id: 'turn-1',
        query: 'faturamento de setembro',
        status: 'loading',
        response: null,
      },
    ]);
  });

  it('captures the attached date in the submitted turn', () => {
    const turns = homeSearchConversationReducer([], {
      type: 'submit',
      id: 'turn-date',
      query: 'Faturamento nesse dia?',
      selectedDate: '2026-09-22',
    });

    expect(turns[0]).toMatchObject({
      id: 'turn-date',
      query: 'Faturamento nesse dia?',
      selectedDate: '2026-09-22',
      status: 'loading',
    });
  });

  it('preserves the attached date through success and error transitions', () => {
    const submitted = homeSearchConversationReducer([], {
      type: 'submit',
      id: 'turn-date',
      query: 'Faturamento nesse dia?',
      selectedDate: '2026-09-22',
    });
    const succeeded = homeSearchConversationReducer(submitted, {
      type: 'resolve',
      id: 'turn-date',
      response: response('Faturamento nesse dia?'),
    });
    const failed = homeSearchConversationReducer(submitted, {
      type: 'fail',
      id: 'turn-date',
      message: 'erro',
    });

    expect(succeeded[0]).toMatchObject({ selectedDate: '2026-09-22', status: 'success' });
    expect(failed[0]).toMatchObject({ selectedDate: '2026-09-22', status: 'error' });
  });

  it('preserves the date on superseded turns without leaking it to a later turn', () => {
    const withDate = homeSearchConversationReducer([], {
      type: 'submit',
      id: 'turn-date',
      query: 'pergunta com data',
      selectedDate: '2026-09-22',
    });
    const turns = homeSearchConversationReducer(withDate, {
      type: 'submit',
      id: 'turn-no-date',
      query: 'pergunta sem data',
    });

    expect(turns[0]).toMatchObject({
      id: 'turn-date',
      selectedDate: '2026-09-22',
      status: 'superseded',
    });
    expect(turns[1]).toEqual({
      id: 'turn-no-date',
      query: 'pergunta sem data',
      status: 'loading',
      response: null,
    });
  });

  it('associates each response with its originating query', () => {
    let turns: HomeSearchConversationTurn[] = [];
    turns = homeSearchConversationReducer(turns, {
      type: 'submit',
      id: 'turn-1',
      query: 'primeira pesquisa',
    });
    turns = homeSearchConversationReducer(turns, {
      type: 'resolve',
      id: 'turn-1',
      response: response('primeira pesquisa'),
    });
    turns = homeSearchConversationReducer(turns, {
      type: 'submit',
      id: 'turn-2',
      query: 'segunda pesquisa',
    });
    turns = homeSearchConversationReducer(turns, {
      type: 'resolve',
      id: 'turn-2',
      response: response('segunda pesquisa'),
    });

    expect(turns).toHaveLength(2);
    expect(turns[0]).toMatchObject({ id: 'turn-1', query: 'primeira pesquisa', status: 'success' });
    expect(turns[1]).toMatchObject({ id: 'turn-2', query: 'segunda pesquisa', status: 'success' });
    expect(turns[0].status === 'success' && turns[0].response.query.original).toBe(
      'primeira pesquisa',
    );
    expect(turns[1].status === 'success' && turns[1].response.query.original).toBe(
      'segunda pesquisa',
    );
  });

  it('keeps a failed response attached to its own query', () => {
    const submitted = homeSearchConversationReducer([], {
      type: 'submit',
      id: 'turn-1',
      query: 'consulta com erro',
    });
    const failed = homeSearchConversationReducer(submitted, {
      type: 'fail',
      id: 'turn-1',
      message: 'Não foi possível concluir esta pesquisa agora.',
    });

    expect(failed[0]).toMatchObject({
      id: 'turn-1',
      query: 'consulta com erro',
      status: 'error',
      message: 'Não foi possível concluir esta pesquisa agora.',
    });
  });

  it('does not leave a superseded request loading after a newer submit', () => {
    const turns = homeSearchConversationReducer(
      [
        {
          id: 'turn-1',
          query: 'pesquisa antiga',
          status: 'loading',
          response: null,
        },
      ],
      { type: 'submit', id: 'turn-2', query: 'pesquisa nova' },
    );

    expect(turns).toMatchObject([
      {
        id: 'turn-1',
        status: 'superseded',
        message: 'Consulta substituída por uma pesquisa mais recente.',
      },
      { id: 'turn-2', status: 'loading' },
    ]);
  });

  it('ignores a late response after the original turn is no longer loading', () => {
    const superseded = homeSearchConversationReducer(
      [
        {
          id: 'turn-1',
          query: 'pesquisa antiga',
          status: 'loading',
          response: null,
        },
      ],
      { type: 'submit', id: 'turn-2', query: 'pesquisa nova' },
    );
    const afterLateResponse = homeSearchConversationReducer(superseded, {
      type: 'resolve',
      id: 'turn-1',
      response: response('pesquisa antiga'),
    });

    expect(afterLateResponse[0]).toMatchObject({ id: 'turn-1', status: 'superseded' });
    expect(afterLateResponse[1]).toMatchObject({ id: 'turn-2', status: 'loading' });
  });
});
