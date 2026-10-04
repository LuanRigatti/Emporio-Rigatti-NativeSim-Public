import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  doc,
  getDocsFromServer,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';

import { getFirebaseFirestore } from '@/services/firebase/firestore';
import { assertFirestoreUid } from '@/services/database/firestorePaths';
import type { RouteFinancialSummary, RouteTrackingSession } from '@/types/routeTracking';

import {
  routeTrackingRepository,
  type RouteTrackingSessionContext,
} from './RouteTrackingRepository';
import {
  isValidRouteFinancialDate,
  isValidRouteFinancialId,
  parseRouteFinancialLedgerRecord,
  ROUTE_FINANCIAL_LEDGER_COLLECTION,
  ROUTE_FINANCIAL_LEDGER_SCHEMA_VERSION,
  toRouteFinancialSummary,
  type RouteFinancialLedgerRecord,
} from './RouteFinancialLedger';

export {
  parseRouteFinancialLedgerRecord,
  ROUTE_FINANCIAL_LEDGER_COLLECTION,
  ROUTE_FINANCIAL_LEDGER_SCHEMA_VERSION,
} from './RouteFinancialLedger';
export type { RouteFinancialLedgerRecord } from './RouteFinancialLedger';

const ROUTE_FINANCIAL_LEDGER_CACHE_PREFIX = '@pareact/route-financial-ledger-cache-v1:';
const ROUTE_FINANCIAL_LEDGER_PENDING_PREFIX = '@pareact/route-financial-ledger-pending-v1:';
const MIGRATION_TRANSACTION_LIMIT = 400;

export type RouteFinancialLedgerMigrationResult = {
  attempted: number;
  created: number;
  alreadyPresent: number;
  skippedDeleted: number;
  conflicts: number;
  failed: number;
};

type RouteLedgerWriteResult =
  'created' | 'already-present' | 'deleted' | 'conflict' | 'stale-session';

type RouteLedgerMigrationCandidate = {
  summary: RouteFinancialSummary;
  routeId: string;
};

export function getRouteFinancialLedgerCacheKey(uid: string): string {
  return `${ROUTE_FINANCIAL_LEDGER_CACHE_PREFIX}${encodeURIComponent(uid)}`;
}

export function getRouteFinancialLedgerPendingKey(uid: string): string {
  return `${ROUTE_FINANCIAL_LEDGER_PENDING_PREFIX}${encodeURIComponent(uid)}`;
}

function equivalentActiveRecord(
  existing: RouteFinancialLedgerRecord,
  candidate: RouteFinancialSummary,
): boolean {
  return (
    existing.status === 'active' &&
    existing.routeId === candidate.id &&
    existing.date === candidate.date &&
    existing.distanceMeters === candidate.distanceMeters
  );
}

function asCandidate(
  session: RouteTrackingSession,
  uid: string,
): RouteLedgerMigrationCandidate | null {
  if ((session.ownerUid && session.ownerUid !== uid) || !isValidRouteFinancialId(session.id)) {
    return null;
  }
  if (
    !isValidRouteFinancialDate(session.date) ||
    !Number.isFinite(session.distanceMeters) ||
    session.distanceMeters < 0
  ) {
    return null;
  }

  return {
    routeId: session.id,
    summary: {
      date: session.date,
      distanceMeters: session.distanceMeters,
      id: session.id,
    },
  };
}

function cacheSafeRecord(record: RouteFinancialLedgerRecord): RouteFinancialLedgerRecord {
  return {
    ...(record.date !== undefined ? { date: record.date } : {}),
    ...(record.distanceMeters !== undefined ? { distanceMeters: record.distanceMeters } : {}),
    routeId: record.routeId,
    schemaVersion: ROUTE_FINANCIAL_LEDGER_SCHEMA_VERSION,
    status: record.status,
  };
}

function financialSummariesFromLedger(
  ledgerRecords: readonly RouteFinancialLedgerRecord[],
  pending: readonly RouteFinancialSummary[] = [],
): RouteFinancialSummary[] {
  const recordsById = new Map(ledgerRecords.map((record) => [record.routeId, record]));
  const summariesById = new Map<string, RouteFinancialSummary>();

  ledgerRecords.forEach((record) => {
    const summary = toRouteFinancialSummary(record);
    if (summary) summariesById.set(record.routeId, summary);
  });

  pending.forEach((summary) => {
    if (!recordsById.has(summary.id) && !summariesById.has(summary.id)) {
      summariesById.set(summary.id, summary);
    }
  });

  return [...summariesById.values()].sort((left, right) => {
    if (left.date !== right.date) return left.date.localeCompare(right.date);
    return left.id.localeCompare(right.id);
  });
}

export class FirestoreRouteFinancialLedgerDataSource {
  private readonly recordsBySession = new Map<string, RouteFinancialLedgerRecord[]>();
  private readonly financialSummariesBySession = new Map<string, RouteFinancialSummary[]>();
  private readonly cacheReads = new Map<string, Promise<RouteFinancialLedgerRecord[]>>();

  public constructor(
    private readonly isSessionCurrent: (session: RouteTrackingSessionContext) => boolean = (
      session,
    ) => routeTrackingRepository.isSessionCurrent(session),
  ) {}

  public getMemoryForFinance(session: RouteTrackingSessionContext): RouteFinancialSummary[] | null {
    if (!this.isSessionCurrent(session)) return null;
    const summaries = this.financialSummariesBySession.get(session.sessionKey);
    return summaries ? summaries.map((summary) => ({ ...summary })) : null;
  }

  public async hydrateForFinanceFromCache(
    session: RouteTrackingSessionContext,
  ): Promise<RouteFinancialSummary[] | null> {
    if (!this.isSessionCurrent(session)) return null;

    const cached = await this.readCache(session);
    if (!this.isSessionCurrent(session) || !this.recordsBySession.has(session.sessionKey)) {
      return null;
    }

    const pending = await this.readPendingSummaries(session);
    if (!this.isSessionCurrent(session)) return null;

    const summaries = financialSummariesFromLedger(cached, pending);
    this.financialSummariesBySession.set(session.sessionKey, summaries);
    return summaries.map((summary) => ({ ...summary }));
  }

  public async loadForFinance(
    session: RouteTrackingSessionContext,
  ): Promise<RouteFinancialSummary[]> {
    if (!this.isSessionCurrent(session)) return [];

    const cached = await this.readCache(session);
    if (!this.isSessionCurrent(session)) return [];
    const pending = await this.readPendingSummaries(session);
    if (!this.isSessionCurrent(session)) return [];

    let ledgerRecords = cached;
    let remoteLoaded = false;
    try {
      const firestore = getFirebaseFirestore();
      const snapshot = await getDocsFromServer(
        collection(firestore, 'users', session.uid, ROUTE_FINANCIAL_LEDGER_COLLECTION),
      );
      if (!this.isSessionCurrent(session)) return [];
      ledgerRecords = snapshot.docs.flatMap((document) => {
        const parsed = parseRouteFinancialLedgerRecord(document.data(), document.id);
        return parsed ? [parsed] : [];
      });
      remoteLoaded = true;
      this.recordsBySession.set(session.sessionKey, ledgerRecords);
      await this.writeCache(session, ledgerRecords);
    } catch {
      // The UID-scoped ledger cache and pending finalized summaries support offline use.
    }

    if (!this.isSessionCurrent(session)) return [];
    if (remoteLoaded) {
      for (const summary of pending) {
        if (!this.isSessionCurrent(session)) return [];
        try {
          const result = await this.upsertIfAbsent(summary, session);
          if (result === 'created' || result === 'already-present') {
            ledgerRecords = [
              ...ledgerRecords.filter((item) => item.routeId !== summary.id),
              {
                date: summary.date,
                distanceMeters: summary.distanceMeters,
                routeId: summary.id,
                schemaVersion: ROUTE_FINANCIAL_LEDGER_SCHEMA_VERSION,
                status: 'active',
              },
            ];
          }
        } catch {
          // Keep the pending summary locally for a later online finance refresh.
        }
      }
    }

    const summaries = financialSummariesFromLedger(ledgerRecords, remoteLoaded ? [] : pending);
    this.financialSummariesBySession.set(session.sessionKey, summaries);
    return summaries.map((summary) => ({ ...summary }));
  }

  public async upsertIfAbsent(
    summary: RouteFinancialSummary,
    session: RouteTrackingSessionContext,
  ): Promise<RouteLedgerWriteResult> {
    if (!this.isSessionCurrent(session)) return 'stale-session';
    if (!isValidRouteFinancialId(summary.id) || !isValidRouteFinancialDate(summary.date)) {
      return 'conflict';
    }
    if (!Number.isFinite(summary.distanceMeters) || summary.distanceMeters < 0) return 'conflict';
    assertFirestoreUid(session.uid);

    const firestore = getFirebaseFirestore();
    const reference = doc(
      firestore,
      'users',
      session.uid,
      ROUTE_FINANCIAL_LEDGER_COLLECTION,
      summary.id,
    );

    const result = await runTransaction(firestore, async (transaction) => {
      if (!this.isSessionCurrent(session)) return 'stale-session' as const;
      const snapshot = await transaction.get(reference);
      if (!this.isSessionCurrent(session)) return 'stale-session' as const;
      if (!snapshot.exists()) {
        transaction.set(reference, {
          createdAt: serverTimestamp(),
          date: summary.date,
          distanceMeters: summary.distanceMeters,
          routeId: summary.id,
          schemaVersion: ROUTE_FINANCIAL_LEDGER_SCHEMA_VERSION,
          status: 'active',
          updatedAt: serverTimestamp(),
        });
        return 'created' as const;
      }

      const existing = parseRouteFinancialLedgerRecord(snapshot.data(), summary.id);
      if (!existing) return 'conflict' as const;
      if (existing.status === 'deleted') return 'deleted' as const;
      return equivalentActiveRecord(existing, summary) ? 'already-present' : 'conflict';
    });

    if (!this.isSessionCurrent(session)) return 'stale-session';
    if (result === 'created' || result === 'already-present' || result === 'deleted') {
      const previous = await this.readCache(session);
      if (!this.isSessionCurrent(session)) return 'stale-session';
      const record =
        result === 'deleted'
          ? {
              ...previous.find((item) => item.routeId === summary.id),
              routeId: summary.id,
              schemaVersion: ROUTE_FINANCIAL_LEDGER_SCHEMA_VERSION,
              status: 'deleted' as const,
            }
          : {
              ...summary,
              routeId: summary.id,
              schemaVersion: ROUTE_FINANCIAL_LEDGER_SCHEMA_VERSION,
              status: 'active' as const,
            };
      await this.replaceCachedRecord(session, record);
    }
    if (result !== 'stale-session') await this.removePendingSummary(session, summary.id);
    return result;
  }

  public async queuePendingSummary(
    summary: RouteFinancialSummary,
    session: RouteTrackingSessionContext,
  ): Promise<void> {
    if (
      !this.isSessionCurrent(session) ||
      !isValidRouteFinancialId(summary.id) ||
      !isValidRouteFinancialDate(summary.date) ||
      !Number.isFinite(summary.distanceMeters) ||
      summary.distanceMeters < 0
    ) {
      return;
    }
    const pending = await this.readPendingSummaries(session);
    if (!this.isSessionCurrent(session)) return;
    const next = pending.filter((item) => item.id !== summary.id);
    next.push({ ...summary });
    await this.writePendingSummaries(session, next);
  }

  public async markDeleted(routeId: string, session: RouteTrackingSessionContext): Promise<void> {
    if (!this.isSessionCurrent(session)) throw new Error('A sessão da rota expirou.');
    if (!isValidRouteFinancialId(routeId)) throw new Error('ID de rota inválido para exclusão.');
    assertFirestoreUid(session.uid);

    const firestore = getFirebaseFirestore();
    const reference = doc(
      firestore,
      'users',
      session.uid,
      ROUTE_FINANCIAL_LEDGER_COLLECTION,
      routeId,
    );
    const deletedRecord = await runTransaction(firestore, async (transaction) => {
      if (!this.isSessionCurrent(session)) throw new Error('A sessão da rota expirou.');
      const snapshot = await transaction.get(reference);
      if (!this.isSessionCurrent(session)) throw new Error('A sessão da rota expirou.');
      const existing = snapshot.exists()
        ? parseRouteFinancialLedgerRecord(snapshot.data(), routeId)
        : null;
      if (snapshot.exists() && !existing) {
        throw new Error('O registro financeiro da rota é inválido e não foi alterado.');
      }

      const record: RouteFinancialLedgerRecord = {
        ...(existing?.date !== undefined ? { date: existing.date } : {}),
        ...(existing?.distanceMeters !== undefined
          ? { distanceMeters: existing.distanceMeters }
          : {}),
        routeId,
        schemaVersion: ROUTE_FINANCIAL_LEDGER_SCHEMA_VERSION,
        status: 'deleted',
      };
      transaction.set(reference, {
        ...(existing?.createdAt !== undefined ? { createdAt: existing.createdAt } : {}),
        ...record,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return record;
    });

    if (!this.isSessionCurrent(session)) throw new Error('A sessão da rota expirou.');
    const previous = await this.readCache(session);
    const previousRecord = previous.find((item) => item.routeId === routeId);
    await this.replaceCachedRecord(session, {
      ...deletedRecord,
      ...(previousRecord?.createdAt !== undefined ? { createdAt: previousRecord.createdAt } : {}),
    });
  }

  public async migrateLocalHistory(
    sessions: readonly RouteTrackingSession[],
    session: RouteTrackingSessionContext,
  ): Promise<RouteFinancialLedgerMigrationResult> {
    if (!this.isSessionCurrent(session)) throw new Error('A sessão da rota expirou.');
    assertFirestoreUid(session.uid);

    const candidateByRouteId = new Map<string, RouteLedgerMigrationCandidate>();
    let invalidCandidateCount = 0;
    sessions.forEach((route) => {
      const candidate = asCandidate(route, session.uid);
      if (!candidate) {
        invalidCandidateCount += 1;
      } else if (!candidateByRouteId.has(candidate.routeId)) {
        candidateByRouteId.set(candidate.routeId, candidate);
      }
    });
    const candidates = [...candidateByRouteId.values()];
    const result: RouteFinancialLedgerMigrationResult = {
      alreadyPresent: 0,
      attempted: sessions.length,
      conflicts: 0,
      created: 0,
      failed: invalidCandidateCount,
      skippedDeleted: 0,
    };
    if (candidates.length === 0) return result;

    const firestore = getFirebaseFirestore();

    for (let start = 0; start < candidates.length; start += MIGRATION_TRANSACTION_LIMIT) {
      if (!this.isSessionCurrent(session)) throw new Error('A sessão da rota expirou.');
      const chunk = candidates.slice(start, start + MIGRATION_TRANSACTION_LIMIT);
      try {
        const statuses = await runTransaction(firestore, async (transaction) => {
          if (!this.isSessionCurrent(session)) throw new Error('A sessão da rota expirou.');
          const references = chunk.map(({ routeId }) =>
            doc(firestore, 'users', session.uid, ROUTE_FINANCIAL_LEDGER_COLLECTION, routeId),
          );
          const snapshots = await Promise.all(
            references.map((reference) => transaction.get(reference)),
          );
          if (!this.isSessionCurrent(session)) throw new Error('A sessão da rota expirou.');

          const pendingWrites: {
            reference: (typeof references)[number];
            summary: RouteFinancialSummary;
          }[] = [];
          const chunkStatuses = chunk.map(({ routeId, summary }, index) => {
            const snapshot = snapshots[index];
            if (!snapshot.exists()) {
              pendingWrites.push({ reference: references[index], summary });
              return 'created' as const;
            }
            const existing = parseRouteFinancialLedgerRecord(snapshot.data(), routeId);
            if (!existing) return 'conflict' as const;
            if (existing.status === 'deleted') return 'deleted' as const;
            return equivalentActiveRecord(existing, summary) ? 'already-present' : 'conflict';
          });

          pendingWrites.forEach(({ reference, summary }) => {
            transaction.set(reference, {
              createdAt: serverTimestamp(),
              date: summary.date,
              distanceMeters: summary.distanceMeters,
              routeId: summary.id,
              schemaVersion: ROUTE_FINANCIAL_LEDGER_SCHEMA_VERSION,
              status: 'active',
              updatedAt: serverTimestamp(),
            });
          });
          return chunkStatuses;
        });

        if (!this.isSessionCurrent(session)) throw new Error('A sessão da rota expirou.');

        statuses.forEach((status) => {
          if (status === 'created') result.created += 1;
          else if (status === 'already-present') result.alreadyPresent += 1;
          else if (status === 'deleted') result.skippedDeleted += 1;
          else result.conflicts += 1;
        });
      } catch {
        result.failed += chunk.length;
      }
    }

    if (!this.isSessionCurrent(session)) throw new Error('A sessão da rota expirou.');
    this.recordsBySession.delete(session.sessionKey);
    this.financialSummariesBySession.delete(session.sessionKey);
    this.cacheReads.delete(session.sessionKey);
    return result;
  }

  private async readCache(
    session: RouteTrackingSessionContext,
  ): Promise<RouteFinancialLedgerRecord[]> {
    const inMemory = this.recordsBySession.get(session.sessionKey);
    if (inMemory) return inMemory;
    const inFlight = this.cacheReads.get(session.sessionKey);
    if (inFlight) return inFlight;

    const promise = AsyncStorage.getItem(getRouteFinancialLedgerCacheKey(session.uid))
      .then((value) => {
        if (!this.isSessionCurrent(session) || !value) return [];
        try {
          const parsed: unknown = JSON.parse(value);
          if (!Array.isArray(parsed)) return [];
          const records = parsed.flatMap((item) => {
            const record = parseRouteFinancialLedgerRecord(item);
            return record ? [record] : [];
          });
          this.recordsBySession.set(session.sessionKey, records);
          return records;
        } catch {
          return [];
        }
      })
      .finally(() => {
        if (this.cacheReads.get(session.sessionKey) === promise) {
          this.cacheReads.delete(session.sessionKey);
        }
      });
    this.cacheReads.set(session.sessionKey, promise);
    return promise;
  }

  private async readPendingSummaries(
    session: RouteTrackingSessionContext,
  ): Promise<RouteFinancialSummary[]> {
    try {
      const value = await AsyncStorage.getItem(getRouteFinancialLedgerPendingKey(session.uid));
      if (!this.isSessionCurrent(session) || !value) return [];
      const parsed: unknown = JSON.parse(value);
      if (!Array.isArray(parsed)) return [];
      return parsed.flatMap((item) => {
        if (typeof item !== 'object' || item === null || Array.isArray(item)) return [];
        const record = item as Record<string, unknown>;
        if (
          typeof record.id !== 'string' ||
          !isValidRouteFinancialId(record.id) ||
          !isValidRouteFinancialDate(record.date) ||
          typeof record.distanceMeters !== 'number' ||
          !Number.isFinite(record.distanceMeters) ||
          record.distanceMeters < 0 ||
          Object.keys(record).some((key) => !['id', 'date', 'distanceMeters'].includes(key))
        ) {
          return [];
        }
        return [
          { date: record.date as string, distanceMeters: record.distanceMeters, id: record.id },
        ];
      });
    } catch {
      return [];
    }
  }

  private async writePendingSummaries(
    session: RouteTrackingSessionContext,
    summaries: readonly RouteFinancialSummary[],
  ): Promise<void> {
    if (!this.isSessionCurrent(session)) return;
    try {
      await AsyncStorage.setItem(
        getRouteFinancialLedgerPendingKey(session.uid),
        JSON.stringify(
          summaries.map(({ date, distanceMeters, id }) => ({ date, distanceMeters, id })),
        ),
      );
    } catch {
      // A failed pending cache write never affects the completed local route.
    }
  }

  private async removePendingSummary(
    session: RouteTrackingSessionContext,
    routeId: string,
  ): Promise<void> {
    const pending = await this.readPendingSummaries(session);
    if (!this.isSessionCurrent(session)) return;
    await this.writePendingSummaries(
      session,
      pending.filter((item) => item.id !== routeId),
    );
  }

  private async replaceCachedRecord(
    session: RouteTrackingSessionContext,
    record: RouteFinancialLedgerRecord,
  ): Promise<void> {
    if (!this.isSessionCurrent(session)) return;
    const records = await this.readCache(session);
    if (!this.isSessionCurrent(session)) return;
    const next = records.filter((item) => item.routeId !== record.routeId);
    next.push(cacheSafeRecord(record));
    this.recordsBySession.set(session.sessionKey, next);
    this.financialSummariesBySession.delete(session.sessionKey);
    await this.writeCache(session, next);
  }

  private async writeCache(
    session: RouteTrackingSessionContext,
    records: readonly RouteFinancialLedgerRecord[],
  ): Promise<void> {
    if (!this.isSessionCurrent(session)) return;
    try {
      await AsyncStorage.setItem(
        getRouteFinancialLedgerCacheKey(session.uid),
        JSON.stringify(records.map(cacheSafeRecord)),
      );
    } catch {
      // Firestore remains canonical; the cache is only an offline/cold-start aid.
    }
  }
}

export const firestoreRouteFinancialLedgerDataSource =
  new FirestoreRouteFinancialLedgerDataSource();
