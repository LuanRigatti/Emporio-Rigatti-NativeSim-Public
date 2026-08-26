import {
  homeSearchPresentationReducer,
  initialHomeSearchPresentationState,
  isHomeSearchSheetVisible,
  type HomeSearchPresentationEvent,
  type HomeSearchPresentationState,
} from '@/features/home/hooks/HomeSearchPresentationFlow';
import type { HomeSearchResponse } from '@/features/home/search/HomeSearchTypes';

function response(
  query: string,
  resultId: `client:${string}` = `client:${query}`,
): HomeSearchResponse {
  return {
    query: {
      original: query,
      normalized: query.toLowerCase(),
      text: query.toLowerCase(),
      detectedTypes: ['text'],
    },
    results: [
      {
        type: 'client',
        id: resultId,
        clientId: resultId,
        title: query,
        score: 100,
        data: {
          aggregation: {
            deliveryCount: 0,
            deliveryIds: [],
            paid: 0,
            pending: 0,
            quantity: 0,
            revenue: 0,
            netProfit: 0,
            revenueShare: 0,
            netProfitShare: 0,
          },
          usesBoleto: false,
          usesInvoice: false,
        },
        relations: { deliveryIds: [] },
      },
    ],
    counts: {
      client: 1,
      delivery: 0,
      factoryPurchase: 0,
      financialMetric: 0,
      factorySummary: 0,
      routeSummary: 0,
      carSetting: 0,
      periodSummary: 0,
    },
    coverage: [],
    errors: [],
    durationMs: 1,
    stale: false,
  };
}

function reduce(
  events: HomeSearchPresentationEvent[],
  initialState: HomeSearchPresentationState = initialHomeSearchPresentationState,
): HomeSearchPresentationState {
  return events.reduce(homeSearchPresentationReducer, initialState);
}

const firstResult = response('Luciano');

describe('HomeSearchPresentationFlow', () => {
  it('presents the sheet immediately while the search is still in flight', () => {
    const searching = reduce([{ type: 'SEARCH_SUBMITTED', searchId: 1 }]);

    expect(searching.phase).toBe('presenting');
    expect(searching.response).toBeNull();
    expect(searching.searchInFlight).toBe(true);
    expect(isHomeSearchSheetVisible(searching)).toBe(true);

    const withResult = homeSearchPresentationReducer(searching, {
      type: 'RESULT_RECEIVED',
      searchId: 1,
      response: firstResult,
    });
    expect(withResult.phase).toBe('presenting');
    expect(withResult.response).toBe(firstResult);
    expect(isHomeSearchSheetVisible(withResult)).toBe(true);
  });

  it('keeps the loading state visible while SwiftUI content is loading', () => {
    const state = reduce([{ type: 'SEARCH_SUBMITTED', searchId: 1 }]);

    expect(state.implementationReady).toBe(false);
    expect(isHomeSearchSheetVisible(state)).toBe(true);
  });

  it('does not request a second presentation for a result arriving after the sheet opens', () => {
    const ready = reduce([
      { type: 'IMPLEMENTATION_READY' },
      { type: 'SEARCH_SUBMITTED', searchId: 1 },
      { type: 'RESULT_RECEIVED', searchId: 1, response: firstResult },
      { type: 'CONTENT_COMMITTED' },
    ]);
    const presenting = homeSearchPresentationReducer(ready, {
      type: 'PRESENTATION_REQUESTED',
    });
    const duplicateRequest = homeSearchPresentationReducer(presenting, {
      type: 'PRESENTATION_REQUESTED',
    });

    expect(ready.phase).toBe('presenting');
    expect(isHomeSearchSheetVisible(ready)).toBe(true);
    expect(isHomeSearchSheetVisible(presenting)).toBe(true);
    expect(duplicateRequest).toBe(presenting);
    expect(duplicateRequest.presentationId).toBe(0);
  });

  it('returns to idle only after the native onDismiss confirmation', () => {
    const presented = reduce([
      { type: 'IMPLEMENTATION_READY' },
      { type: 'SEARCH_SUBMITTED', searchId: 1 },
      { type: 'RESULT_RECEIVED', searchId: 1, response: firstResult },
      { type: 'CONTENT_COMMITTED' },
      { type: 'PRESENTATION_REQUESTED' },
      { type: 'NATIVE_VISIBILITY_CHANGED', visible: true },
    ]);
    const dismissing = homeSearchPresentationReducer(presented, {
      type: 'NATIVE_VISIBILITY_CHANGED',
      visible: false,
    });

    expect(dismissing.phase).toBe('dismissing');
    expect(dismissing.response).toBe(firstResult);

    const idle = homeSearchPresentationReducer(dismissing, { type: 'DISMISS_COMPLETED' });
    expect(idle.phase).toBe('idle');
    expect(idle.response).toBeNull();
  });

  it('allows a new search to present immediately after dismiss completes', () => {
    const dismissing = reduce([
      { type: 'IMPLEMENTATION_READY' },
      { type: 'SEARCH_SUBMITTED', searchId: 1 },
      { type: 'RESULT_RECEIVED', searchId: 1, response: firstResult },
      { type: 'CONTENT_COMMITTED' },
      { type: 'PRESENTATION_REQUESTED' },
      { type: 'NATIVE_VISIBILITY_CHANGED', visible: true },
      { type: 'NATIVE_VISIBILITY_CHANGED', visible: false },
    ]);
    const secondResult = response('Marcia');
    const readyAgain = reduce(
      [
        { type: 'DISMISS_COMPLETED' },
        { type: 'SEARCH_SUBMITTED', searchId: 2 },
        { type: 'RESULT_RECEIVED', searchId: 2, response: secondResult },
        { type: 'CONTENT_COMMITTED' },
      ],
      dismissing,
    );

    expect(readyAgain.phase).toBe('presenting');
    expect(readyAgain.response).toBe(secondResult);
    expect(isHomeSearchSheetVisible(readyAgain)).toBe(true);
  });

  it('keeps the current sheet data mounted while a new search waits for dismissal', () => {
    const presented = reduce([
      { type: 'IMPLEMENTATION_READY' },
      { type: 'SEARCH_SUBMITTED', searchId: 1 },
      { type: 'RESULT_RECEIVED', searchId: 1, response: firstResult },
      { type: 'CONTENT_COMMITTED' },
      { type: 'PRESENTATION_REQUESTED' },
      { type: 'NATIVE_VISIBILITY_CHANGED', visible: true },
    ]);
    const nextSearch = homeSearchPresentationReducer(presented, {
      type: 'SEARCH_SUBMITTED',
      searchId: 2,
    });

    expect(nextSearch.phase).toBe('dismissing');
    expect(nextSearch.response).toBe(firstResult);
    expect(isHomeSearchSheetVisible(nextSearch)).toBe(false);
  });

  it('never restores the previous response after dismissal', () => {
    const nextResult = response('Marcia');
    const resultArrivedDuringDismiss = reduce([
      { type: 'IMPLEMENTATION_READY' },
      { type: 'SEARCH_SUBMITTED', searchId: 1 },
      { type: 'RESULT_RECEIVED', searchId: 1, response: firstResult },
      { type: 'CONTENT_COMMITTED' },
      { type: 'PRESENTATION_REQUESTED' },
      { type: 'NATIVE_VISIBILITY_CHANGED', visible: true },
      { type: 'SEARCH_SUBMITTED', searchId: 2 },
      { type: 'RESULT_RECEIVED', searchId: 2, response: nextResult },
    ]);
    const afterDismiss = homeSearchPresentationReducer(resultArrivedDuringDismiss, {
      type: 'DISMISS_COMPLETED',
    });

    expect(afterDismiss.phase).toBe('resultReady');
    expect(afterDismiss.response).toBe(nextResult);
    expect(afterDismiss.pendingResponse).toBeNull();
  });

  it('ignores a superseded result and produces one presentation for consecutive submits', () => {
    const nextResult = response('Marcia');
    const ready = reduce([
      { type: 'IMPLEMENTATION_READY' },
      { type: 'SEARCH_SUBMITTED', searchId: 1 },
      { type: 'SEARCH_SUBMITTED', searchId: 2 },
      { type: 'RESULT_RECEIVED', searchId: 1, response: firstResult },
      { type: 'RESULT_RECEIVED', searchId: 2, response: nextResult },
      { type: 'CONTENT_COMMITTED' },
    ]);
    const presenting = homeSearchPresentationReducer(ready, {
      type: 'PRESENTATION_REQUESTED',
    });

    expect(ready.response).toBe(nextResult);
    expect(presenting).toBe(ready);
    expect(presenting.presentationId).toBe(0);
    expect(isHomeSearchSheetVisible(presenting)).toBe(true);
  });
});
