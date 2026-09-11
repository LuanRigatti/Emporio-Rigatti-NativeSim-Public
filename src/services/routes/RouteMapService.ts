export type WebRouteMapState = 'empty' | 'missingKey' | 'missingCenter' | 'ready';

export interface WebRouteMapStateInput {
  hasApiKey: boolean;
  hasCenter: boolean;
  hasConfirmedStops: boolean;
  selectable: boolean;
}

export function getWebRouteMapState(input: WebRouteMapStateInput): WebRouteMapState {
  if (!input.hasConfirmedStops && !input.selectable) return 'empty';
  if (!input.hasApiKey) return 'missingKey';
  if (!input.hasCenter) return 'missingCenter';
  return 'ready';
}
