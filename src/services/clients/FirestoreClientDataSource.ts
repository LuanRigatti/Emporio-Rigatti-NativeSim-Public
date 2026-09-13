import type { UserDataSnapshot } from '@/services/data';
import type { ClientModel, ClientId, CustomClient } from '@/types/data';
import { formatClientName, normalizeClientKey, normalizeMoney } from '@/utils/data';

import type { ClientCatalogQuery } from './ClientCatalogService';
import type { ClientDataSource } from './ClientDataSource';
import { mockClientDataSource } from './MockClientDataSource';
import { clientCatalogCache } from './ClientCatalogCache';

type FirestoreClientDocument = {
  name: string;
  normalizedName: string;
  address?: string;
  currentUnitPrice?: number;
  usesInvoice?: boolean;
  usesBoleto?: boolean;
  archivedAt?: unknown;
  legacyFields?: Record<string, unknown>;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type ClientRecord = FirestoreClientDocument & { id: string };
type SessionRequest = {
  userId: string;
  generation: number;
  sessionVersion?: number;
};

type FirestoreOps = Pick<
  typeof import('firebase/firestore'),
  'collection' | 'doc' | 'getDocs' | 'serverTimestamp' | 'setDoc' | 'updateDoc'
>;

let firestoreOpsOverride: FirestoreOps | undefined;
let firestoreDbOverride: unknown | undefined;

export function setFirestoreClientDataSourceOpsForTesting(
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
  const { collection } = await getFirestoreOps();
  if (firestoreDbOverride) {
    return collection(firestoreDbOverride as never, 'users', uid, 'clients');
  }
  const { getFirebaseFirestore } = await import('@/services/firebase/firestore');
  return collection(getFirebaseFirestore(), 'users', uid, 'clients');
}

function clientIdForDocument(id: string): ClientId {
  return `client:${id}`;
}

function documentToModel(record: ClientRecord): ClientModel {
  const canonicalName = formatClientName(record.name);
  const customConfig: CustomClient = {
    ...(record.legacyFields ? { legacyFields: record.legacyFields } : {}),
    ...(record.address ? { endereco: record.address } : {}),
    nome: canonicalName,
    preco: record.currentUnitPrice ?? 0,
    ...(record.usesInvoice === true ? { usesInvoice: true } : {}),
    ...(record.usesBoleto === true ? { usesBoleto: true } : {}),
  };

  return {
    clientId: clientIdForDocument(record.id),
    canonicalName,
    normalizedName: normalizeClientKey(canonicalName),
    sources: ['custom'],
    customConfig,
    address: record.address,
    hasIncompleteAddress: !record.address?.trim(),
    currentPrice: record.currentUnitPrice,
    usesInvoice: record.usesInvoice === true,
    usesBoleto: record.usesBoleto === true,
  };
}

function snapshotForClients(records: readonly ClientRecord[]): UserDataSnapshot {
  return {
    clientesCustom: Object.fromEntries(
      records
        .filter((record) => !record.archivedAt)
        .map((record) => [
          record.name,
          {
            ...(record.address ? { endereco: record.address } : {}),
            nome: record.name,
            preco: record.currentUnitPrice ?? 0,
            ...(record.usesInvoice === true ? { usesInvoice: true } : {}),
            ...(record.usesBoleto === true ? { usesBoleto: true } : {}),
          },
        ]),
    ),
    entregas: [],
    gastosDiarios: {},
    gastosMensais: {},
    recebimentoBaldes: [],
  };
}

export class FirestoreClientDataSource implements ClientDataSource {
  public readonly mode = 'firebase' as const;
  public isUsingLocalFallback = false;
  private records: ClientRecord[] = [];
  private snapshot: UserDataSnapshot | null = null;
  private readonly listeners = new Set<() => void>();
  private activeUid?: string;
  private sessionUid: string | null | undefined;
  private sessionGeneration = 0;
  private boundSessionVersion: number | undefined;
  private loadEpoch = 0;
  private stateVersion = 0;
  private lastAppliedSource: 'cache' | 'remote' | null = null;
  private readonly inFlightHydrations = new Map<string, Promise<boolean>>();
  private readonly inFlightLoads = new Map<string, Promise<void>>();

  public getSnapshot = (userId?: string, sessionVersion?: number): UserDataSnapshot | null => {
    if (
      (this.sessionUid !== undefined && this.sessionUid !== (userId ?? null)) ||
      (this.sessionUid === undefined &&
        this.activeUid !== undefined &&
        this.activeUid !== userId) ||
      (sessionVersion !== undefined && this.boundSessionVersion !== sessionVersion)
    ) {
      return null;
    }
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
    if (
      sessionVersion === undefined &&
      this.sessionUid === undefined &&
      userId &&
      this.activeUid === userId
    ) {
      this.sessionUid = nextSessionUid;
      this.boundSessionVersion = sessionVersion;
      return;
    }

    this.sessionUid = nextSessionUid;
    this.boundSessionVersion = sessionVersion;
    this.sessionGeneration += 1;
    this.loadEpoch += 1;
    this.activeUid = userId;
    this.records = [];
    this.snapshot = null;
    this.isUsingLocalFallback = false;
    this.stateVersion += 1;
    this.lastAppliedSource = null;
    this.publish();
  }

  private beginSessionRequest(userId: string, sessionVersion?: number): number | null {
    if (sessionVersion !== undefined && this.boundSessionVersion !== sessionVersion) return null;
    if (this.sessionUid !== undefined && this.sessionUid !== userId) return null;
    if (this.sessionUid === undefined && this.activeUid && this.activeUid !== userId) {
      this.activeUid = userId;
      this.sessionGeneration += 1;
      this.loadEpoch += 1;
      this.records = [];
      this.snapshot = null;
      this.stateVersion += 1;
      this.lastAppliedSource = null;
    }
    this.activeUid = userId;
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

  private captureSessionRequest(userId?: string): SessionRequest {
    if (!userId) throw new Error('Sessão não disponível.');
    const generation = this.beginSessionRequest(userId);
    if (generation === null) throw new Error('Sessão alterada durante a operação.');
    this.loadEpoch += 1;
    return { userId, generation, sessionVersion: this.boundSessionVersion };
  }

  private assertSessionRequestCurrent(request: SessionRequest): void {
    if (!this.isSessionRequestCurrent(request.userId, request.generation, request.sessionVersion)) {
      throw new Error('Sessão alterada durante a operação.');
    }
  }

  public hydrateFromCache(userId: string): Promise<boolean> {
    const sessionGeneration = this.beginSessionRequest(userId);
    if (sessionGeneration === null) return Promise.resolve(false);
    const key = this.requestKey(userId, sessionGeneration);
    const existing = this.inFlightHydrations.get(key);
    if (existing) return existing;

    const hydration = this.hydrateFromCacheInternal(userId, sessionGeneration);
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

  private async hydrateFromCacheInternal(userId: string, sessionGeneration: number) {
    const stateVersion = this.stateVersion;
    const startedWithRemoteState = this.lastAppliedSource === 'remote';
    if (startedWithRemoteState) return false;
    const cachedRecords = await clientCatalogCache.read(userId);
    if (
      !this.isSessionRequestCurrent(userId, sessionGeneration) ||
      this.stateVersion !== stateVersion ||
      this.lastAppliedSource === 'remote'
    ) {
      return false;
    }
    if (!cachedRecords?.length) return false;
    this.records = cachedRecords;
    this.snapshot = snapshotForClients(this.records);
    this.lastAppliedSource = 'cache';
    this.stateVersion += 1;
    this.publish();
    return true;
  }

  public async load(userId?: string, sessionVersion?: number): Promise<void> {
    if (!userId) throw new Error('Sessão não disponível.');
    const sessionGeneration = this.beginSessionRequest(userId, sessionVersion);
    if (sessionGeneration === null) return;
    const loadEpoch = this.loadEpoch;
    const key = `${this.requestKey(userId, sessionGeneration)}:${loadEpoch}`;
    const existing = this.inFlightLoads.get(key);
    if (existing) return existing;

    const load = this.loadFromFirestore(userId, sessionGeneration, sessionVersion, loadEpoch);
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
    sessionVersion: number | undefined,
    loadEpoch: number,
  ): Promise<void> {
    const hydration = this.inFlightHydrations.get(this.requestKey(userId, sessionGeneration));
    if (hydration) await hydration;
    if (
      !this.isSessionRequestCurrent(userId, sessionGeneration, sessionVersion) ||
      this.loadEpoch !== loadEpoch
    )
      return;
    try {
      const { getDocs } = await getFirestoreOps();
      const result = await getDocs(await collectionFor(userId));
      if (
        !this.isSessionRequestCurrent(userId, sessionGeneration, sessionVersion) ||
        this.loadEpoch !== loadEpoch
      )
        return;
      const loadedRecords = result.docs.map((item) => ({
        id: item.id,
        ...(item.data() as FirestoreClientDocument),
      }));
      const fromCache = result.metadata?.fromCache === true;
      const hadRemoteState = this.lastAppliedSource === 'remote';
      if (fromCache) {
        const recordsById = new Map(this.records.map((record) => [record.id, record]));
        loadedRecords.forEach((record) => {
          if (!recordsById.has(record.id)) recordsById.set(record.id, record);
        });
        this.records = [...recordsById.values()];
      } else {
        this.records = loadedRecords;
      }
      this.isUsingLocalFallback = false;
      this.snapshot = snapshotForClients(this.records);
      this.lastAppliedSource = hadRemoteState ? 'remote' : fromCache ? 'cache' : 'remote';
      this.stateVersion += 1;
      if (
        !fromCache &&
        this.isSessionRequestCurrent(userId, sessionGeneration, sessionVersion) &&
        this.loadEpoch === loadEpoch
      ) {
        void clientCatalogCache.write(userId, this.records).catch(() => undefined);
      }
      this.publish();
    } catch (error) {
      if (
        !this.isSessionRequestCurrent(userId, sessionGeneration, sessionVersion) ||
        this.loadEpoch !== loadEpoch
      )
        return;
      this.isUsingLocalFallback = false;
      throw error;
    }
  }

  public list(
    query: ClientCatalogQuery = {},
    userId?: string,
    sessionVersion?: number,
  ): ClientModel[] {
    if (
      (this.sessionUid !== undefined && this.sessionUid !== (userId ?? null)) ||
      (this.sessionUid === undefined &&
        this.activeUid !== undefined &&
        this.activeUid !== userId) ||
      (sessionVersion !== undefined && this.boundSessionVersion !== sessionVersion)
    ) {
      return [];
    }
    if (this.isUsingLocalFallback) return mockClientDataSource.list(query);
    const normalizedSearch = query.search ? normalizeClientKey(query.search) : '';
    return this.records
      .filter((record) => !record.archivedAt)
      .map(documentToModel)
      .filter((client) => !normalizedSearch || client.normalizedName.includes(normalizedSearch))
      .sort((left, right) => left.canonicalName.localeCompare(right.canonicalName, 'pt-BR'));
  }

  public async saveCustomClient(
    userId: string | undefined,
    name: string,
    price: number,
    address: string,
    usesInvoice?: boolean,
    usesBoleto?: boolean,
  ): Promise<void> {
    const request = this.captureSessionRequest(userId);
    if (this.isUsingLocalFallback) {
      await mockClientDataSource.saveCustomClient(
        request.userId,
        name,
        price,
        address,
        usesInvoice,
        usesBoleto,
      );
      this.assertSessionRequestCurrent(request);
      return;
    }
    const canonicalName = formatClientName(name);
    const normalizedPrice = normalizeMoney(price);
    if (!canonicalName) throw new Error('Informe o nome do cliente.');
    if (normalizedPrice === undefined || normalizedPrice <= 0) {
      throw new Error('Informe um preço maior que zero.');
    }
    if (!address.trim()) throw new Error('Informe o endereço do cliente.');
    if (
      this.list({}, request.userId).some(
        (client) => client.normalizedName === normalizeClientKey(canonicalName),
      )
    ) {
      throw new Error('Já existe um cliente com esse nome.');
    }
    const { doc, serverTimestamp, setDoc } = await getFirestoreOps();
    this.assertSessionRequestCurrent(request);
    const reference = doc(await collectionFor(request.userId));
    this.assertSessionRequestCurrent(request);
    await setDoc(reference, {
      address: address.trim(),
      currentUnitPrice: normalizedPrice,
      name: canonicalName,
      normalizedName: normalizeClientKey(canonicalName),
      usesInvoice: usesInvoice === true,
      usesBoleto: usesBoleto === true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    this.assertSessionRequestCurrent(request);
    await this.load(request.userId, request.sessionVersion);
    this.assertSessionRequestCurrent(request);
  }

  public async updatePrice(
    userId: string | undefined,
    client: ClientModel,
    price: number,
    usesInvoice?: boolean,
    usesBoleto?: boolean,
  ): Promise<void> {
    const request = this.captureSessionRequest(userId);
    if (this.isUsingLocalFallback) {
      await mockClientDataSource.updatePrice(
        request.userId,
        client,
        price,
        usesInvoice,
        usesBoleto,
      );
      this.assertSessionRequestCurrent(request);
      return;
    }
    const normalizedPrice = normalizeMoney(price);
    if (normalizedPrice === undefined || normalizedPrice <= 0) {
      throw new Error('Informe um preço maior que zero.');
    }
    const { doc, serverTimestamp, updateDoc } = await getFirestoreOps();
    this.assertSessionRequestCurrent(request);
    await updateDoc(doc(await collectionFor(request.userId), documentIdForClient(client)), {
      currentUnitPrice: normalizedPrice,
      usesInvoice: usesInvoice ?? client.usesInvoice,
      usesBoleto: usesBoleto ?? client.usesBoleto,
      updatedAt: serverTimestamp(),
    });
    this.assertSessionRequestCurrent(request);
    await this.load(request.userId, request.sessionVersion);
    this.assertSessionRequestCurrent(request);
  }

  public async rename(
    userId: string | undefined,
    client: ClientModel,
    newName: string,
  ): Promise<void> {
    const request = this.captureSessionRequest(userId);
    if (this.isUsingLocalFallback) {
      await mockClientDataSource.rename(request.userId, client, newName);
      this.assertSessionRequestCurrent(request);
      return;
    }
    const canonicalName = formatClientName(newName);
    if (!canonicalName) throw new Error('Informe o nome do cliente.');
    if (
      this.list({}, request.userId).some(
        (item) => item.normalizedName === normalizeClientKey(canonicalName),
      )
    ) {
      throw new Error('Já existe um cliente com esse nome.');
    }
    const { doc, serverTimestamp, updateDoc } = await getFirestoreOps();
    this.assertSessionRequestCurrent(request);
    await updateDoc(doc(await collectionFor(request.userId), documentIdForClient(client)), {
      name: canonicalName,
      normalizedName: normalizeClientKey(canonicalName),
      updatedAt: serverTimestamp(),
    });
    this.assertSessionRequestCurrent(request);
    await this.load(request.userId, request.sessionVersion);
    this.assertSessionRequestCurrent(request);
  }

  public async removeCustomConfiguration(
    userId: string | undefined,
    client: ClientModel,
  ): Promise<void> {
    const request = this.captureSessionRequest(userId);
    if (this.isUsingLocalFallback) {
      await mockClientDataSource.removeCustomConfiguration(request.userId, client);
      this.assertSessionRequestCurrent(request);
      return;
    }
    // Arquivar mantém entregas históricas independentes do cadastro atual.
    const { doc, serverTimestamp, updateDoc } = await getFirestoreOps();
    this.assertSessionRequestCurrent(request);
    await updateDoc(doc(await collectionFor(request.userId), documentIdForClient(client)), {
      archivedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    this.assertSessionRequestCurrent(request);
    await this.load(request.userId, request.sessionVersion);
    this.assertSessionRequestCurrent(request);
  }

  private publish(): void {
    this.listeners.forEach((listener) => listener());
  }

  private requestKey(userId: string, generation: number): string {
    return `${userId}:${generation}`;
  }
}

function documentIdForClient(client: ClientModel): string {
  if (!client.clientId.startsWith('client:')) {
    throw new Error('Este cliente não possui ID Firestore.');
  }
  return client.clientId.slice('client:'.length);
}

export const firestoreClientDataSource = new FirestoreClientDataSource();
