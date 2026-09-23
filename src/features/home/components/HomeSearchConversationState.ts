import type { HomeSearchResponse } from '../search/HomeSearchTypes';

type HomeSearchConversationTurnBase = {
  id: string;
  query: string;
  selectedDate?: string;
};

export type HomeSearchConversationTurn = HomeSearchConversationTurnBase &
  (
    | {
        status: 'loading';
        response: null;
      }
    | {
        status: 'success';
        response: HomeSearchResponse;
      }
    | {
        status: 'error' | 'superseded';
        response: null;
        message: string;
      }
  );

export type HomeSearchConversationAction =
  | { type: 'submit'; id: string; query: string; selectedDate?: string }
  | { type: 'resolve'; id: string; response: HomeSearchResponse }
  | { type: 'fail'; id: string; message: string };

export function homeSearchConversationReducer(
  turns: readonly HomeSearchConversationTurn[],
  action: HomeSearchConversationAction,
): HomeSearchConversationTurn[] {
  switch (action.type) {
    case 'submit':
      return [
        ...turns.map((turn) =>
          turn.status === 'loading'
            ? {
                id: turn.id,
                query: turn.query,
                ...(turn.selectedDate !== undefined ? { selectedDate: turn.selectedDate } : {}),
                status: 'superseded' as const,
                response: null,
                message: 'Consulta substituída por uma pesquisa mais recente.',
              }
            : turn,
        ),
        {
          id: action.id,
          query: action.query,
          ...(action.selectedDate !== undefined ? { selectedDate: action.selectedDate } : {}),
          status: 'loading',
          response: null,
        },
      ];

    case 'resolve':
      return turns.map((turn) =>
        turn.id === action.id && turn.status === 'loading'
          ? {
              id: turn.id,
              query: turn.query,
              ...(turn.selectedDate !== undefined ? { selectedDate: turn.selectedDate } : {}),
              status: 'success' as const,
              response: action.response,
            }
          : turn,
      );

    case 'fail':
      return turns.map((turn) =>
        turn.id === action.id && turn.status === 'loading'
          ? {
              id: turn.id,
              query: turn.query,
              ...(turn.selectedDate !== undefined ? { selectedDate: turn.selectedDate } : {}),
              status: 'error' as const,
              response: null,
              message: action.message,
            }
          : turn,
      );
  }
}
