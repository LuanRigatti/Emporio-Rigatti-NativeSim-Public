import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  FinancialCalculationFilters,
  FinancialComparison,
  FinancialSummary,
  WholesaleFinanceSelection,
} from '@/types/data';

export const FINANCIAL_PRESENTATION_CACHE_VERSION = 2;
export const FINANCIAL_PRESENTATION_RULES_VERSION = 1;

// Keep this storage key stable so v2 replaces v1 and existing logout cleanup removes it.
const CACHE_PREFIX = '@pareact/finance-presentation-v1';

export type FinancialPresentationValues = {
  faturamento: number;
  lucroLiquido: number;
  faturamentoComparison: FinancialComparison | null;
  lucroLiquidoComparison: FinancialComparison | null;
  summary: FinancialPresentationSummary;
};

export const FINANCIAL_PRESENTATION_SUMMARY_FIELDS = [
  'quantidadeBaldes',
  'lucroBruto',
  'valoresPagos',
  'valoresPendentes',
  'custoTotalBaldes',
  'custoCombustivel',
  'custoOutros',
  'custoLuz',
  'custoMedioCombustivelPorEntrega',
  'margemBruta',
  'margemLiquida',
  'precoMedioBalde',
  'lucroLiquidoPorBalde',
  'custoMedioBalde',
] as const satisfies readonly (keyof FinancialSummary)[];

export type FinancialPresentationSummary = Pick<
  FinancialSummary,
  (typeof FINANCIAL_PRESENTATION_SUMMARY_FIELDS)[number]
>;

export type FinancialPresentationCacheEntry = FinancialPresentationValues & {
  cacheVersion: number;
  rulesVersion: number;
  environment: 'development' | 'production';
  firebaseProjectId: string;
  uid: string;
  scopeKey: string;
};

type CacheEnvironment = Pick<FinancialPresentationCacheEntry, 'environment' | 'firebaseProjectId'>;
type KeyValueStorage = Pick<typeof AsyncStorage, 'getItem' | 'removeItem' | 'setItem'>;
type CanRun = () => boolean;

export type FinancialPresentationCacheMissReason =
  | 'environment_unavailable'
  | 'invalid_request'
  | 'invalidated_during_read'
  | 'no_record'
  | 'malformed_record'
  | 'cache_version_mismatch'
  | 'rules_version_mismatch'
  | 'uid_mismatch'
  | 'scope_mismatch'
  | 'environment_mismatch'
  | 'project_mismatch'
  | 'invalid_values'
  | 'storage_failure';

export type FinancialPresentationCacheReadResult =
  | { status: 'hit'; entry: FinancialPresentationCacheEntry }
  | { status: 'miss'; reason: FinancialPresentationCacheMissReason };

export type FinancialPresentationCacheWriteResult =
  | { status: 'written' | 'unchanged' }
  | {
      status: 'skipped';
      reason:
        | 'environment_unavailable'
        | 'invalid_request'
        | 'not_eligible'
        | 'stale_context'
        | 'invalid_values';
    }
  | { status: 'failed'; reason: 'storage_failure' };

function isFinitePresentationSummary(value: unknown): value is FinancialPresentationSummary {
  return (
    isRecord(value) &&
    FINANCIAL_PRESENTATION_SUMMARY_FIELDS.every(
      (field) => typeof value[field] === 'number' && Number.isFinite(value[field]),
    )
  );
}

function normalizePresentationSummary(
  value: FinancialPresentationSummary,
): FinancialPresentationSummary {
  return Object.fromEntries(
    FINANCIAL_PRESENTATION_SUMMARY_FIELDS.map((field) => [field, value[field]]),
  ) as FinancialPresentationSummary;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isComparison(value: unknown): value is FinancialComparison {
  return (
    isRecord(value) &&
    typeof value.atual === 'number' &&
    Number.isFinite(value.atual) &&
    typeof value.anterior === 'number' &&
    Number.isFinite(value.anterior) &&
    typeof value.diferenca === 'number' &&
    Number.isFinite(value.diferenca) &&
    typeof value.percentual === 'number' &&
    Number.isFinite(value.percentual) &&
    typeof value.subiu === 'boolean'
  );
}

function isValidEntry(value: unknown): value is FinancialPresentationCacheEntry {
  return (
    isRecord(value) &&
    value.cacheVersion === FINANCIAL_PRESENTATION_CACHE_VERSION &&
    value.rulesVersion === FINANCIAL_PRESENTATION_RULES_VERSION &&
    (value.environment === 'development' || value.environment === 'production') &&
    typeof value.firebaseProjectId === 'string' &&
    value.firebaseProjectId.length > 0 &&
    typeof value.uid === 'string' &&
    value.uid.length > 0 &&
    typeof value.scopeKey === 'string' &&
    value.scopeKey.length > 0 &&
    typeof value.faturamento === 'number' &&
    Number.isFinite(value.faturamento) &&
    typeof value.lucroLiquido === 'number' &&
    Number.isFinite(value.lucroLiquido) &&
    isFinitePresentationSummary(value.summary) &&
    (value.faturamentoComparison === null || isComparison(value.faturamentoComparison)) &&
    (value.lucroLiquidoComparison === null || isComparison(value.lucroLiquidoComparison))
  );
}

function normalizeComparison(
  value: FinancialComparison | null | undefined,
): FinancialComparison | null {
  if (!value) return null;
  return {
    atual: value.atual,
    anterior: value.anterior,
    diferenca: value.diferenca,
    percentual: value.percentual,
    subiu: value.subiu,
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => [key, canonicalize(value[key])]),
  );
}

export function createFinancialPresentationScopeKey(
  selection: WholesaleFinanceSelection,
  filters: FinancialCalculationFilters,
): string {
  return JSON.stringify(canonicalize({ filters, selection }));
}

function defaultEnvironment(): CacheEnvironment | null {
  const firebaseProjectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  if (!firebaseProjectId) return null;

  return {
    environment: typeof __DEV__ !== 'undefined' && __DEV__ ? 'development' : 'production',
    firebaseProjectId,
  };
}

export class FinancialPresentationCache {
  private readonly generations = new Map<string, number>();
  private readonly pendingOperations = new Map<string, Promise<void>>();
  private readonly pendingClears = new Map<string, Promise<void>>();
  private readonly lastSerialized = new Map<string, string>();
  private readonly unusableKeys = new Set<string>();

  public constructor(
    private readonly storage: KeyValueStorage = AsyncStorage,
    private readonly getEnvironment: () => CacheEnvironment | null = defaultEnvironment,
  ) {}

  public async read(
    uid: string,
    scopeKey: string,
  ): Promise<FinancialPresentationCacheEntry | null> {
    const result = await this.readWithStatus(uid, scopeKey);
    return result.status === 'hit' ? result.entry : null;
  }

  public async readWithStatus(
    uid: string,
    scopeKey: string,
  ): Promise<FinancialPresentationCacheReadResult> {
    let environment: CacheEnvironment | null;
    try {
      environment = this.getEnvironment();
    } catch {
      return { status: 'miss', reason: 'environment_unavailable' };
    }
    if (!environment) return { status: 'miss', reason: 'environment_unavailable' };
    if (!uid || !scopeKey) return { status: 'miss', reason: 'invalid_request' };

    const key = this.getKey(environment, uid);
    let pending = this.pendingOperations.get(key);
    while (pending) {
      await pending.catch(() => undefined);
      const nextPending = this.pendingOperations.get(key);
      if (!nextPending || nextPending === pending) break;
      pending = nextPending;
    }
    if (this.unusableKeys.has(key)) {
      return { status: 'miss', reason: 'invalidated_during_read' };
    }

    const generation = this.generations.get(key) ?? 0;

    try {
      const serialized = await this.storage.getItem(key);
      if ((this.generations.get(key) ?? 0) !== generation || this.unusableKeys.has(key)) {
        return { status: 'miss', reason: 'invalidated_during_read' };
      }
      if (!serialized) return { status: 'miss', reason: 'no_record' };

      let parsed: unknown;
      try {
        parsed = JSON.parse(serialized);
      } catch {
        return { status: 'miss', reason: 'malformed_record' };
      }
      if (!isRecord(parsed)) return { status: 'miss', reason: 'malformed_record' };
      if (parsed.cacheVersion !== FINANCIAL_PRESENTATION_CACHE_VERSION) {
        return { status: 'miss', reason: 'cache_version_mismatch' };
      }
      if (parsed.rulesVersion !== FINANCIAL_PRESENTATION_RULES_VERSION) {
        return { status: 'miss', reason: 'rules_version_mismatch' };
      }
      if (parsed.uid !== uid) return { status: 'miss', reason: 'uid_mismatch' };
      if (parsed.scopeKey !== scopeKey) return { status: 'miss', reason: 'scope_mismatch' };
      if (parsed.environment !== environment.environment) {
        return { status: 'miss', reason: 'environment_mismatch' };
      }
      if (parsed.firebaseProjectId !== environment.firebaseProjectId) {
        return { status: 'miss', reason: 'project_mismatch' };
      }
      if (!isValidEntry(parsed)) return { status: 'miss', reason: 'invalid_values' };

      this.lastSerialized.set(key, serialized);
      return { status: 'hit', entry: this.normalizeEntry(parsed) };
    } catch {
      return { status: 'miss', reason: 'storage_failure' };
    }
  }

  public write(
    uid: string,
    scopeKey: string,
    values: FinancialPresentationValues,
    canRun: CanRun = () => true,
  ): Promise<void> {
    return this.writeAndThrowOnFailure(uid, scopeKey, values, canRun);
  }

  private async writeAndThrowOnFailure(
    uid: string,
    scopeKey: string,
    values: FinancialPresentationValues,
    canRun: CanRun,
  ): Promise<void> {
    const result = await this.writeWithStatus(uid, scopeKey, values, canRun);
    if (result.status === 'failed') {
      throw new Error('Financial presentation cache storage failed.');
    }
  }

  public async writeWithStatus(
    uid: string,
    scopeKey: string,
    values: FinancialPresentationValues,
    canRun: CanRun = () => true,
  ): Promise<FinancialPresentationCacheWriteResult> {
    let environment: CacheEnvironment | null;
    try {
      environment = this.getEnvironment();
    } catch {
      return { status: 'skipped', reason: 'environment_unavailable' };
    }
    if (!environment) return { status: 'skipped', reason: 'environment_unavailable' };
    if (!uid || !scopeKey) return { status: 'skipped', reason: 'invalid_request' };

    const safeCanRun = () => {
      try {
        return canRun();
      } catch {
        return false;
      }
    };
    if (!safeCanRun()) return { status: 'skipped', reason: 'not_eligible' };
    if (!isFinitePresentationSummary(values.summary)) {
      return { status: 'skipped', reason: 'invalid_values' };
    }

    const entry: FinancialPresentationCacheEntry = {
      cacheVersion: FINANCIAL_PRESENTATION_CACHE_VERSION,
      rulesVersion: FINANCIAL_PRESENTATION_RULES_VERSION,
      environment: environment.environment,
      firebaseProjectId: environment.firebaseProjectId,
      uid,
      scopeKey,
      faturamento: values.faturamento,
      lucroLiquido: values.lucroLiquido,
      faturamentoComparison: normalizeComparison(values.faturamentoComparison),
      lucroLiquidoComparison: normalizeComparison(values.lucroLiquidoComparison),
      summary: normalizePresentationSummary(values.summary),
    };
    if (!isValidEntry(entry)) return { status: 'skipped', reason: 'invalid_values' };

    const key = this.getKey(environment, uid);
    const generation = this.nextGeneration(key);
    const serialized = JSON.stringify(entry);

    let result: FinancialPresentationCacheWriteResult = {
      status: 'skipped',
      reason: 'stale_context',
    };
    try {
      await this.enqueue(key, async () => {
        if (this.generations.get(key) !== generation || !safeCanRun()) {
          result = { status: 'skipped', reason: 'stale_context' };
          return;
        }

        const previous = this.lastSerialized.get(key) ?? (await this.storage.getItem(key));
        if (this.generations.get(key) !== generation || !safeCanRun()) {
          result = { status: 'skipped', reason: 'stale_context' };
          return;
        }
        if (previous === serialized) {
          this.lastSerialized.set(key, serialized);
          this.unusableKeys.delete(key);
          result = { status: 'unchanged' };
          return;
        }

        await this.storage.setItem(key, serialized);
        if (this.generations.get(key) === generation && safeCanRun()) {
          this.lastSerialized.set(key, serialized);
          this.unusableKeys.delete(key);
          result = { status: 'written' };
        } else {
          result = { status: 'skipped', reason: 'stale_context' };
        }
      });
      return result;
    } catch {
      return { status: 'failed', reason: 'storage_failure' };
    }
  }

  public clearForUser(uid: string): Promise<void> {
    const environment = this.getEnvironment();
    if (!environment || !uid) return Promise.resolve();

    const key = this.getKey(environment, uid);
    const existingClear = this.pendingClears.get(key);
    if (existingClear) return existingClear;
    this.nextGeneration(key);
    this.lastSerialized.delete(key);
    this.unusableKeys.add(key);

    const clear = this.enqueue(key, async () => {
      try {
        await this.storage.removeItem(key);
      } catch (error) {
        // An empty value is an invalid cache envelope, so a successful fallback write
        // still prevents a later process from restoring the logged-out user's numbers.
        await this.storage.setItem(key, '').catch(() => undefined);
        throw error;
      }
      this.lastSerialized.delete(key);
      this.unusableKeys.delete(key);
    });
    this.pendingClears.set(key, clear);
    void clear.then(
      () => {
        if (this.pendingClears.get(key) === clear) this.pendingClears.delete(key);
      },
      () => {
        if (this.pendingClears.get(key) === clear) this.pendingClears.delete(key);
      },
    );
    return clear;
  }

  private getKey(environment: CacheEnvironment, uid: string): string {
    return [
      CACHE_PREFIX,
      encodeURIComponent(environment.environment),
      encodeURIComponent(environment.firebaseProjectId),
      encodeURIComponent(uid),
    ].join(':');
  }

  private nextGeneration(key: string): number {
    const generation = (this.generations.get(key) ?? 0) + 1;
    this.generations.set(key, generation);
    return generation;
  }

  private enqueue(key: string, operation: () => Promise<void>): Promise<void> {
    const previous = this.pendingOperations.get(key);
    const next = (previous ? previous.catch(() => undefined) : Promise.resolve()).then(operation);
    this.pendingOperations.set(key, next);
    void next.then(
      () => {
        if (this.pendingOperations.get(key) === next) this.pendingOperations.delete(key);
      },
      () => {
        if (this.pendingOperations.get(key) === next) this.pendingOperations.delete(key);
      },
    );
    return next;
  }

  private normalizeEntry(entry: FinancialPresentationCacheEntry): FinancialPresentationCacheEntry {
    return {
      cacheVersion: entry.cacheVersion,
      rulesVersion: entry.rulesVersion,
      environment: entry.environment,
      firebaseProjectId: entry.firebaseProjectId,
      uid: entry.uid,
      scopeKey: entry.scopeKey,
      faturamento: entry.faturamento,
      lucroLiquido: entry.lucroLiquido,
      faturamentoComparison: normalizeComparison(entry.faturamentoComparison),
      lucroLiquidoComparison: normalizeComparison(entry.lucroLiquidoComparison),
      summary: normalizePresentationSummary(entry.summary),
    };
  }
}

export const financialPresentationCache = new FinancialPresentationCache();
