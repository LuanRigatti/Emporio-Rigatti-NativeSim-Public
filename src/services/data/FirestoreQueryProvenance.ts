export type FirestoreQueryOrigin = 'server' | 'cache' | 'local-pending' | 'unknown' | 'stale';

export type FirestoreQueryCoverage = 'complete' | 'incomplete' | 'unknown';

export type FirestoreQueryProvenance<TScope> = {
  uid: string;
  sessionVersion?: number;
  scope: TScope;
  scopeKey: string;
  origin: FirestoreQueryOrigin;
  fromCache: boolean | null;
  hasPendingWrites: boolean | null;
  coverage: FirestoreQueryCoverage;
  remoteConfirmed: boolean;
};

type FirestoreQueryProvenanceInput<TScope> = {
  kind: string;
  uid: string;
  sessionVersion?: number;
  scope: TScope;
  originOverride?: 'cache';
  fromCache: boolean | null;
  hasPendingWrites: boolean | null;
  scopeIsComplete: boolean;
  stale?: boolean;
};

export function firestoreQueryScopeKey<TScope>(
  kind: string,
  uid: string,
  sessionVersion: number | undefined,
  scope: TScope,
): string {
  return JSON.stringify([kind, uid, sessionVersion ?? null, scope]);
}

export function createFirestoreQueryProvenance<TScope>(
  input: FirestoreQueryProvenanceInput<TScope>,
): FirestoreQueryProvenance<TScope> {
  const { fromCache, hasPendingWrites } = input;
  const metadataKnown = fromCache !== null && hasPendingWrites !== null;
  const origin: FirestoreQueryOrigin = input.stale
    ? 'stale'
    : input.originOverride
      ? input.originOverride
      : !metadataKnown
        ? 'unknown'
        : hasPendingWrites
          ? 'local-pending'
          : fromCache
            ? 'cache'
            : 'server';
  const remoteConfirmed =
    !input.stale &&
    input.scopeIsComplete &&
    origin === 'server' &&
    fromCache === false &&
    hasPendingWrites === false;

  return {
    uid: input.uid,
    sessionVersion: input.sessionVersion,
    scope: input.scope,
    scopeKey: firestoreQueryScopeKey(input.kind, input.uid, input.sessionVersion, input.scope),
    origin,
    fromCache,
    hasPendingWrites,
    coverage: remoteConfirmed ? 'complete' : metadataKnown ? 'incomplete' : 'unknown',
    remoteConfirmed,
  };
}
