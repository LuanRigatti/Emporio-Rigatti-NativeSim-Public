let eventSequence = 0;

export function logHomeSearchFlow(event: string, details: Record<string, unknown> = {}): void {
  if (!__DEV__) return;

  console.log('[home-search-flow]', {
    eventId: ++eventSequence,
    timestampMs: Date.now(),
    event,
    ...details,
  });
}
