import type {
  RetailClient,
  RetailClientDraft,
  RetailClientPatch,
  RetailClientReferral,
} from '@/types/data';
import { assertFirestoreUid } from '@/services/database/firestorePaths';
import { normalizeClientKey } from '@/utils/data';

import { retailClientCatalogCache } from './RetailClientCatalogCache';

type RetailClientDocument = {
  clientId?: string;
  name: string;
  normalizedName: string;
  phone?: string;
  address?: string;
  referral?: RetailClientReferral;
  defaultDeliveryFee?: number;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type RetailClientRecord = RetailClientDocument & { id: string };

export interface RetailClientQuery {
  search?: string;
  includeInactive?: boolean;
}

type SessionRequest = {
  userId: string;
  generation: number;
  sessionVersion?: number;
};

type FirestoreOps = Pick<
  typeof import('firebase/firestore'),
  'collection' | 'deleteField' | 'doc' | 'getDocs' | 'serverTimestamp' | 'setDoc' | 'updateDoc'
>;

let firestoreOpsOverride: FirestoreOps | undefined;
let firestoreDbOverride: unknown | undefined;

export function setFirestoreRetailClientDataSourceOpsForTesting(
  ops: FirestoreOps | undefined,
  db?: unknown,
): void {
  firestoreOpsOverride = ops;
  firestoreDbOverride = db;
}

async function getFirestoreOps(): Promise<FirestoreOps> {
  if (firestoreOpsOverride) return firestoreOpsOverride;
  return import('firebase/firestore');
}

async function collectionFor(uid: string) {
  assertFirestoreUid(uid);
  const { collection } = await getFirestoreOps();
  if (firestoreDbOverride) {
    return collection(firestoreDbOverride as never, 'users', uid, 'retailClients');
  }
  const { getFirebaseFirestore } = await import('@/services/firebase/firestore');
  return collection(getFirebaseFirestore(), 'users', uid, 'retailClients');
}

function trimOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function normalizeReferral(
  value: RetailClientReferral | undefined,
): RetailClientReferral | undefined {
  if (!value) return undefined;
  return {
    hasReferral: value.hasReferral,
    ...(trimOptionalText(value.sourceType)
      ? { sourceType: trimOptionalText(value.sourceType) }
      : {}),
    ...(trimOptionalText(value.referredByName)
      ? { referredByName: trimOptionalText(value.referredByName) }
      : {}),
  };
}

function normalizeDraft(input: RetailClientDraft): {
  name: string;
  normalizedName: string;
  phone?: string;
  address?: string;
  referral?: RetailClientReferral;
  defaultDeliveryFee?: number;
  active: boolean;
} {
  const name = input.name.trim();
  const normalizedName = normalizeClientKey(name);
  if (!name || !normalizedName) throw new Error('Informe o nome do cliente Varejo.');

  const defaultDeliveryFee = input.defaultDeliveryFee;
  if (
    defaultDeliveryFee !== undefined &&
    (!Number.isFinite(defaultDeliveryFee) || defaultDeliveryFee < 0)
  ) {
    throw new Error('A taxa padrão de entrega deve ser zero ou maior.');
  }

  return {
    active: input.active ?? true,
    ...(defaultDeliveryFee === undefined ? {} : { defaultDeliveryFee }),
    ...(normalizeReferral(input.referral) ? { referral: normalizeReferral(input.referral) } : {}),
    ...(trimOptionalText(input.phone) ? { phone: trimOptionalText(input.phone) } : {}),
    ...(trimOptionalText(input.address) ? { address: trimOptionalText(input.address) } : {}),
    name,
    normalizedName,
  };
}

function documentToClient(record: RetailClientRecord): RetailClient | undefined {
  const name = record.name.trim();
  const normalizedName = normalizeClientKey(name);
  if (!record.id || !name || !normalizedName || typeof record.active !== 'boolean')
    return undefined;

  return {
    active: record.active,
    clientId: record.id,
    createdAt: record.createdAt as RetailClient['createdAt'],
    ...(record.defaultDeliveryFee === undefined
      ? {}
      : { defaultDeliveryFee: record.defaultDeliveryFee }),
    ...(record.address ? { address: record.address } : {}),
    ...(record.phone ? { phone: record.phone } : {}),
    ...(record.referral ? { referral: record.referral } : {}),
    name,
    normalizedName,
    updatedAt: record.updatedAt as RetailClient['updatedAt'],
  };
}

function snapshotForRecords(records: readonly RetailClientRecord[]): readonly RetailClient[] {
  return records.flatMap((record) => {
    const client = documentToClient(record);
    return client ? [client] : [];
  });
}

function recordFromDocument(id: string, data: Record<string, unknown>): RetailClientRecord {
  return { id, ...(data as RetailClientDocument) };
}

export class RetailClientDataSource {
  private records: RetailClientRecord[] = [];
  private snapshot: readonly RetailClient[] | null = null;
  private readonly listeners = new Set<() => void>();
  private activeUid?: string;
  private sessionUid: string | null | undefined;
  private sessionGeneration = 0;
  private boundSessionVersion: number | undefined;
  private loadEpoch = 0;
  private lastAppliedSource: 'cache' | 'remote' | null = null;
  private readonly inFlightHydrations = new Map<string, Promise<boolean>>();
  private readonly inFlightLoads = new Map<string, Promise<void>>();

  public getSnapshot = (
    userId?: string,
    sessionVersion?: number,
  ): readonly RetailClient[] | null => {
    if (!this.isSessionVisible(userId, sessionVersion)) return null;
    return this.snapshot;
  };

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public setSessionUser(userId?: string, sessionVersion?: number): void {
    const nextSessionUid = userId ?? null;
    if (
      this.sessionUid === nextSessionUid &&
      (sessionVersion === undefined || this.boundSessionVersion === sessionVersion)
    ) {
      return;
    }

    this.sessionUid = nextSessionUid;
    this.boundSessionVersion = sessionVersion;
    this.sessionGeneration += 1;
    this.loadEpoch += 1;
    this.activeUid = userId;
    this.records = [];
    this.snapshot = null;
    this.lastAppliedSource = null;
    this.publish();
  }

  public async hydrateFromCache(userId: string, sessionVersion?: number): Promise<boolean> {
    const sessionGeneration = this.beginSessionRequest(userId, sessionVersion);
    if (sessionGeneration === null) return false;
    if (this.lastAppliedSource === 'remote') return false;

    const key = this.requestKey(userId, sessionGeneration);
    const existing = this.inFlightHydrations.get(key);
    if (existing) return existing;

    const hydration = this.hydrateFromCacheInternal(userId, sessionGeneration, sessionVersion);
    this.inFlightHydrations.set(key, hydration);
    void hydration.then(
      () => {
        if (this.inFlightHydrations.get(key) === hydration) this.inFlightHydrations.delete(key);
      },
      () => {
        if (this.inFlightHydrations.get(key) === hydration) this.inFlightHydrations.delete(key);
      },
    );
    return hydration;
  }

  private async hydrateFromCacheInternal(
    userId: string,
    sessionGeneration: number,
    sessionVersion?: number,
  ): Promise<boolean> {
    const cachedRecords = await retailClientCatalogCache.read(userId);
    if (
      !this.isSessionRequestCurrent(userId, sessionGeneration, sessionVersion) ||
      this.lastAppliedSource === 'remote'
    ) {
      return false;
    }
    if (!cachedRecords?.length) return false;

    this.records = cachedRecords;
    this.snapshot = snapshotForRecords(this.records);
    this.lastAppliedSource = 'cache';
    this.publish();
    return true;
  }

  public async load(userId?: string, sessionVersion?: number): Promise<void> {
    if (!userId) throw new Error('Sessão não disponível.');
    const sessionGeneration = this.beginSessionRequest(userId, sessionVersion);
    if (sessionGeneration === null) return;
    const key = this.requestKey(userId, sessionGeneration);
    const existing = this.inFlightLoads.get(key);
    if (existing) return existing;

    const load = this.loadFromFirestore(userId, sessionGeneration, sessionVersion);
    this.inFlightLoads.set(key, load);
    void load.then(
      () => {
        if (this.inFlightLoads.get(key) === load) this.inFlightLoads.delete(key);
      },
      () => {
        if (this.inFlightLoads.get(key) === load) this.inFlightLoads.delete(key);
      },
    );
    return load;
  }

  private async loadFromFirestore(
    userId: string,
    sessionGeneration: number,
    sessionVersion?: number,
  ): Promise<void> {
    await this.hydrateFromCache(userId, sessionVersion);
    if (!this.isSessionRequestCurrent(userId, sessionGeneration, sessionVersion)) return;

    const loadEpoch = this.loadEpoch;
    try {
      const { getDocs } = await getFirestoreOps();
      const result = await getDocs(await collectionFor(userId));
      if (
        !this.isSessionRequestCurrent(userId, sessionGeneration, sessionVersion) ||
        this.loadEpoch !== loadEpoch
      ) {
        return;
      }

      const loadedRecords = result.docs.map((item) =>
        recordFromDocument(item.id, item.data() as Record<string, unknown>),
      );
      if (result.metadata?.fromCache === true) {
        const recordsById = new Map(this.records.map((record) => [record.id, record]));
        loadedRecords.forEach((record) => recordsById.set(record.id, record));
        this.records = [...recordsById.values()];
      } else {
        this.records = loadedRecords;
      }
      this.snapshot = snapshotForRecords(this.records);
      this.lastAppliedSource = result.metadata?.fromCache === true ? 'cache' : 'remote';
      if (
        result.metadata?.fromCache !== true &&
        this.isSessionRequestCurrent(userId, sessionGeneration, sessionVersion) &&
        this.loadEpoch === loadEpoch
      ) {
        void retailClientCatalogCache.write(userId, this.records).catch(() => undefined);
      }
      this.publish();
    } catch (error) {
      if (
        !this.isSessionRequestCurrent(userId, sessionGeneration, sessionVersion) ||
        this.loadEpoch !== loadEpoch
      ) {
        return;
      }
      throw error;
    }
  }

  public list(
    query: RetailClientQuery = {},
    userId?: string,
    sessionVersion?: number,
  ): RetailClient[] {
    if (!this.isSessionVisible(userId, sessionVersion) || !this.snapshot) return [];
    const normalizedSearch = query.search ? normalizeClientKey(query.search) : '';
    return this.snapshot
      .filter((client) => query.includeInactive === true || client.active)
      .filter((client) => !normalizedSearch || client.normalizedName.includes(normalizedSearch))
      .slice()
      .sort(
        (left, right) =>
          left.normalizedName.localeCompare(right.normalizedName, 'pt-BR') ||
          left.name.localeCompare(right.name, 'pt-BR') ||
          left.clientId.localeCompare(right.clientId),
      );
  }

  public getById(
    clientId: string,
    userId?: string,
    sessionVersion?: number,
  ): RetailClient | undefined {
    if (!this.isSessionVisible(userId, sessionVersion)) return undefined;
    return this.snapshot?.find((client) => client.clientId === clientId);
  }

  public async create(
    userId: string | undefined,
    input: RetailClientDraft,
    sessionVersion?: number,
  ): Promise<void> {
    const request = this.captureSessionRequest(userId, sessionVersion);
    const normalized = normalizeDraft(input);
    if (
      this.list({}, request.userId, request.sessionVersion).some(
        (client) => client.normalizedName === normalized.normalizedName,
      )
    ) {
      throw new Error('Já existe um cliente Varejo com esse nome.');
    }

    const { doc, serverTimestamp, setDoc } = await getFirestoreOps();
    this.assertSessionRequestCurrent(request);
    const reference = doc(await collectionFor(request.userId));
    this.assertSessionRequestCurrent(request);
    await setDoc(reference, {
      ...normalized,
      clientId: reference.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    this.assertSessionRequestCurrent(request);
    await this.load(request.userId, request.sessionVersion);
    this.assertSessionRequestCurrent(request);
  }

  public async update(
    userId: string | undefined,
    clientId: string,
    patch: RetailClientPatch,
    sessionVersion?: number,
  ): Promise<void> {
    const request = this.captureSessionRequest(userId, sessionVersion);
    if (!clientId.trim() || clientId.includes('/'))
      throw new Error('ID de cliente Varejo inválido.');

    const current = this.getById(clientId, request.userId, request.sessionVersion);
    if (!current) throw new Error('Cliente Varejo não encontrado.');

    const firestorePatch: Record<string, unknown> = {};
    if (patch.name !== undefined) {
      const normalized = normalizeDraft({ name: patch.name, active: current.active });
      if (
        this.list({}, request.userId, request.sessionVersion).some(
          (client) =>
            client.clientId !== clientId && client.normalizedName === normalized.normalizedName,
        )
      ) {
        throw new Error('Já existe um cliente Varejo com esse nome.');
      }
      firestorePatch.name = normalized.name;
      firestorePatch.normalizedName = normalized.normalizedName;
    }
    if (patch.phone !== undefined) firestorePatch.phone = await this.optionalField(patch.phone);
    if (patch.address !== undefined)
      firestorePatch.address = await this.optionalField(patch.address);
    if (patch.referral !== undefined) {
      firestorePatch.referral =
        patch.referral === null
          ? (await getFirestoreOps()).deleteField()
          : normalizeReferral(patch.referral);
    }
    if (patch.defaultDeliveryFee !== undefined) {
      if (
        patch.defaultDeliveryFee !== null &&
        (!Number.isFinite(patch.defaultDeliveryFee) || patch.defaultDeliveryFee < 0)
      ) {
        throw new Error('A taxa padrão de entrega deve ser zero ou maior.');
      }
      firestorePatch.defaultDeliveryFee =
        patch.defaultDeliveryFee === null
          ? (await getFirestoreOps()).deleteField()
          : patch.defaultDeliveryFee;
    }
    if (patch.active !== undefined) firestorePatch.active = patch.active;
    firestorePatch.updatedAt = (await getFirestoreOps()).serverTimestamp();

    this.assertSessionRequestCurrent(request);
    const { doc, updateDoc } = await getFirestoreOps();
    await updateDoc(doc(await collectionFor(request.userId), clientId), firestorePatch);
    this.assertSessionRequestCurrent(request);
    await this.load(request.userId, request.sessionVersion);
    this.assertSessionRequestCurrent(request);
  }

  public async remove(
    userId: string | undefined,
    clientId: string,
    sessionVersion?: number,
  ): Promise<void> {
    await this.update(userId, clientId, { active: false }, sessionVersion);
  }

  private async optionalField(value: string | null): Promise<unknown> {
    const trimmed = value?.trim();
    return trimmed ? trimmed : (await getFirestoreOps()).deleteField();
  }

  private captureSessionRequest(
    userId: string | undefined,
    sessionVersion?: number,
  ): SessionRequest {
    if (!userId) throw new Error('Sessão não disponível.');
    const generation = this.beginSessionRequest(userId, sessionVersion);
    if (generation === null) throw new Error('Sessão alterada durante a operação.');
    return { generation, sessionVersion: this.boundSessionVersion, userId };
  }

  private beginSessionRequest(userId: string, sessionVersion?: number): number | null {
    if (this.sessionUid !== undefined && this.sessionUid !== userId) return null;
    if (this.boundSessionVersion !== undefined && sessionVersion !== undefined) {
      if (this.boundSessionVersion !== sessionVersion) return null;
    } else if (sessionVersion !== undefined) {
      this.boundSessionVersion = sessionVersion;
    }
    this.activeUid = userId;
    if (this.sessionUid === undefined) this.sessionUid = userId;
    return this.sessionGeneration;
  }

  private isSessionRequestCurrent(
    userId: string,
    generation: number,
    sessionVersion?: number,
  ): boolean {
    return (
      (this.sessionUid === undefined || this.sessionUid === userId) &&
      this.sessionGeneration === generation &&
      (sessionVersion === undefined || this.boundSessionVersion === sessionVersion)
    );
  }

  private isSessionVisible(userId?: string, sessionVersion?: number): boolean {
    return (
      (this.sessionUid === undefined || this.sessionUid === (userId ?? null)) &&
      (this.sessionUid !== undefined ||
        this.activeUid === undefined ||
        this.activeUid === userId) &&
      (sessionVersion === undefined || this.boundSessionVersion === sessionVersion)
    );
  }

  private assertSessionRequestCurrent(request: SessionRequest): void {
    if (!this.isSessionRequestCurrent(request.userId, request.generation, request.sessionVersion)) {
      throw new Error('Sessão alterada durante a operação.');
    }
  }

  private requestKey(userId: string, generation: number): string {
    return `${userId}:${generation}`;
  }

  private publish(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const retailClientDataSource = new RetailClientDataSource();
