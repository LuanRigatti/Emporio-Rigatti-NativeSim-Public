import {
  createFirestoreQueryProvenance,
  firestoreQueryScopeKey,
} from '@/services/data/FirestoreQueryProvenance';

const confirmedInput = {
  kind: 'daily-monthly-costs',
  uid: 'synthetic-user',
  sessionVersion: 7,
  scope: { month: '2026-09' },
  fromCache: false,
  hasPendingWrites: false,
  scopeIsComplete: true,
};

describe('Firestore query provenance', () => {
  it('confirms only a complete query with explicit server metadata', () => {
    const result = createFirestoreQueryProvenance(confirmedInput);

    expect(result).toMatchObject({
      uid: 'synthetic-user',
      sessionVersion: 7,
      scope: { month: '2026-09' },
      origin: 'server',
      fromCache: false,
      hasPendingWrites: false,
      coverage: 'complete',
      remoteConfirmed: true,
    });
    expect(result.scopeKey).toBe(
      firestoreQueryScopeKey('daily-monthly-costs', 'synthetic-user', 7, {
        month: '2026-09',
      }),
    );
  });

  it('keeps a cache result unconfirmed even when its query scope is complete', () => {
    const result = createFirestoreQueryProvenance({ ...confirmedInput, fromCache: true });

    expect(result.origin).toBe('cache');
    expect(result.coverage).toBe('incomplete');
    expect(result.remoteConfirmed).toBe(false);
  });

  it('keeps pending Firestore writes unconfirmed', () => {
    const result = createFirestoreQueryProvenance({ ...confirmedInput, hasPendingWrites: true });

    expect(result.origin).toBe('local-pending');
    expect(result.coverage).toBe('incomplete');
    expect(result.remoteConfirmed).toBe(false);
  });

  it('does not infer confirmation when metadata is missing', () => {
    const result = createFirestoreQueryProvenance({
      ...confirmedInput,
      fromCache: null,
    });

    expect(result.origin).toBe('unknown');
    expect(result.coverage).toBe('unknown');
    expect(result.remoteConfirmed).toBe(false);
  });

  it('keeps incomplete and stale query results unconfirmed', () => {
    const incomplete = createFirestoreQueryProvenance({
      ...confirmedInput,
      scopeIsComplete: false,
    });
    const stale = createFirestoreQueryProvenance({ ...confirmedInput, stale: true });

    expect(incomplete.remoteConfirmed).toBe(false);
    expect(incomplete.coverage).toBe('incomplete');
    expect(stale.remoteConfirmed).toBe(false);
    expect(stale.origin).toBe('stale');
  });

  it('never lets a local cache override become server-confirmed', () => {
    const result = createFirestoreQueryProvenance({
      ...confirmedInput,
      originOverride: 'cache',
    });

    expect(result.origin).toBe('cache');
    expect(result.remoteConfirmed).toBe(false);
  });

  it('includes UID, session version, and exact scope in the scope key', () => {
    const base = createFirestoreQueryScopeKey();

    expect(base).not.toBe(
      firestoreQueryScopeKey('daily-monthly-costs', 'synthetic-user', 8, confirmedInput.scope),
    );
    expect(base).not.toBe(
      firestoreQueryScopeKey('daily-monthly-costs', 'another-user', 7, confirmedInput.scope),
    );
    expect(base).not.toBe(
      firestoreQueryScopeKey('daily-monthly-costs', 'synthetic-user', 7, { month: '2026-10' }),
    );
  });
});

function createFirestoreQueryScopeKey(): string {
  return firestoreQueryScopeKey('daily-monthly-costs', 'synthetic-user', 7, confirmedInput.scope);
}
