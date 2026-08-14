import type { HomeSearchResponse } from '../search/HomeSearchTypes';

export type HomeSearchPresentationPhase =
  | 'idle'
  | 'searching'
  | 'resultReady'
  | 'readyToPresent'
  | 'presenting'
  | 'presented'
  | 'dismissing';

export type HomeSearchPresentationState = {
  activeSearchId: number;
  contentReady: boolean;
  implementationReady: boolean;
  pendingResponse: HomeSearchResponse | null;
  phase: HomeSearchPresentationPhase;
  presentationId: number;
  response: HomeSearchResponse | null;
  searchInFlight: boolean;
};

export type HomeSearchPresentationEvent =
  | { type: 'IMPLEMENTATION_READY' }
  | { type: 'SEARCH_SUBMITTED'; searchId: number }
  | { type: 'SEARCH_UNAVAILABLE'; searchId: number }
  | { type: 'RESULT_RECEIVED'; searchId: number; response: HomeSearchResponse }
  | { type: 'CONTENT_COMMITTED' }
  | { type: 'PRESENTATION_REQUESTED' }
  | { type: 'NATIVE_VISIBILITY_CHANGED'; visible: boolean }
  | { type: 'DISMISS_COMPLETED' };

export const initialHomeSearchPresentationState: HomeSearchPresentationState = {
  activeSearchId: 0,
  contentReady: false,
  implementationReady: false,
  pendingResponse: null,
  phase: 'idle',
  presentationId: 0,
  response: null,
  searchInFlight: false,
};

function advanceReadiness(state: HomeSearchPresentationState): HomeSearchPresentationState {
  if (state.phase === 'resultReady' && state.contentReady && state.implementationReady) {
    return { ...state, phase: 'readyToPresent' };
  }

  return state;
}

function completeDismiss(state: HomeSearchPresentationState): HomeSearchPresentationState {
  if (state.pendingResponse) {
    return {
      ...state,
      contentReady: false,
      pendingResponse: null,
      phase: 'resultReady',
      response: state.pendingResponse,
    };
  }

  if (state.searchInFlight) {
    return {
      ...state,
      contentReady: false,
      phase: 'searching',
      response: null,
    };
  }

  return {
    ...state,
    contentReady: false,
    phase: 'idle',
    response: null,
  };
}

export function homeSearchPresentationReducer(
  state: HomeSearchPresentationState,
  event: HomeSearchPresentationEvent,
): HomeSearchPresentationState {
  switch (event.type) {
    case 'IMPLEMENTATION_READY':
      return advanceReadiness({ ...state, implementationReady: true });

    case 'SEARCH_SUBMITTED': {
      const mustDismiss =
        state.phase === 'presenting' || state.phase === 'presented' || state.phase === 'dismissing';

      return {
        ...state,
        activeSearchId: event.searchId,
        contentReady: false,
        pendingResponse: null,
        phase: mustDismiss ? 'dismissing' : 'searching',
        response: mustDismiss ? state.response : null,
        searchInFlight: true,
      };
    }

    case 'SEARCH_UNAVAILABLE':
      if (event.searchId !== state.activeSearchId) return state;
      return state.phase === 'dismissing'
        ? { ...state, searchInFlight: false }
        : { ...state, phase: 'idle', response: null, searchInFlight: false };

    case 'RESULT_RECEIVED':
      if (event.searchId !== state.activeSearchId) return state;
      if (state.phase === 'dismissing') {
        return {
          ...state,
          pendingResponse: event.response,
          searchInFlight: false,
        };
      }
      return {
        ...state,
        contentReady: false,
        pendingResponse: null,
        phase: 'resultReady',
        response: event.response,
        searchInFlight: false,
      };

    case 'CONTENT_COMMITTED':
      if (state.phase !== 'resultReady' || !state.response) return state;
      return advanceReadiness({ ...state, contentReady: true });

    case 'PRESENTATION_REQUESTED':
      if (state.phase !== 'readyToPresent') return state;
      return {
        ...state,
        phase: 'presenting',
        presentationId: state.presentationId + 1,
      };

    case 'NATIVE_VISIBILITY_CHANGED':
      if (event.visible) {
        return state.phase === 'presenting' ? { ...state, phase: 'presented' } : state;
      }
      return state.phase === 'presenting' || state.phase === 'presented'
        ? { ...state, phase: 'dismissing' }
        : state;

    case 'DISMISS_COMPLETED':
      return state.phase === 'dismissing' ||
        state.phase === 'presenting' ||
        state.phase === 'presented'
        ? completeDismiss(state)
        : state;
  }
}

export function isHomeSearchSheetVisible(state: HomeSearchPresentationState): boolean {
  return state.phase === 'presenting' || state.phase === 'presented';
}
