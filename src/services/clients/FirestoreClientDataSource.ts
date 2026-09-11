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

async function collectionFor(uid: string) {
  const { collection } = await import('firebase/firestore');
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

  public getSnapshot = (): UserDataSnapshot | null => this.snapshot;

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public async hydrateFromCache(userId: string): Promise<boolean> {
    const cachedRecords = await clientCatalogCache.read(userId);
    if (!cachedRecords?.length) return false;
    this.records = cachedRecords;
    this.snapshot = snapshotForClients(this.records);
    this.publish();
    return true;
  }

  public async load(userId?: string): Promise<void> {
    if (!userId) throw new Error('Sessão não disponível.');
    try {
      const { getDocs } = await import('firebase/firestore');
      const result = await getDocs(await collectionFor(userId));
      this.records = result.docs.map((item) => ({
        id: item.id,
        ...(item.data() as FirestoreClientDocument),
      }));
      this.isUsingLocalFallback = false;
      this.snapshot = snapshotForClients(this.records);
      void clientCatalogCache.write(userId, this.records).catch(() => undefined);
      this.publish();
    } catch (error) {
      this.isUsingLocalFallback = true;
      await mockClientDataSource.load(userId);
      this.snapshot = mockClientDataSource.getSnapshot();
      this.publish();
      throw error;
    }
  }

  public list(query: ClientCatalogQuery = {}): ClientModel[] {
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
    if (this.isUsingLocalFallback) {
      return mockClientDataSource.saveCustomClient(
        userId,
        name,
        price,
        address,
        usesInvoice,
        usesBoleto,
      );
    }
    if (!userId) throw new Error('Sessão não disponível.');
    const canonicalName = formatClientName(name);
    const normalizedPrice = normalizeMoney(price);
    if (!canonicalName) throw new Error('Informe o nome do cliente.');
    if (normalizedPrice === undefined || normalizedPrice <= 0) {
      throw new Error('Informe um preço maior que zero.');
    }
    if (!address.trim()) throw new Error('Informe o endereço do cliente.');
    if (this.list().some((client) => client.normalizedName === normalizeClientKey(canonicalName))) {
      throw new Error('Já existe um cliente com esse nome.');
    }
    const { doc, serverTimestamp, setDoc } = await import('firebase/firestore');
    const reference = doc(await collectionFor(userId));
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
    await this.load(userId);
  }

  public async updatePrice(
    userId: string | undefined,
    client: ClientModel,
    price: number,
    usesInvoice?: boolean,
    usesBoleto?: boolean,
  ): Promise<void> {
    if (this.isUsingLocalFallback) {
      return mockClientDataSource.updatePrice(userId, client, price, usesInvoice, usesBoleto);
    }
    if (!userId) throw new Error('Sessão não disponível.');
    const normalizedPrice = normalizeMoney(price);
    if (normalizedPrice === undefined || normalizedPrice <= 0) {
      throw new Error('Informe um preço maior que zero.');
    }
    const { doc, serverTimestamp, updateDoc } = await import('firebase/firestore');
    await updateDoc(doc(await collectionFor(userId), documentIdForClient(client)), {
      currentUnitPrice: normalizedPrice,
      usesInvoice: usesInvoice ?? client.usesInvoice,
      usesBoleto: usesBoleto ?? client.usesBoleto,
      updatedAt: serverTimestamp(),
    });
    await this.load(userId);
  }

  public async rename(
    userId: string | undefined,
    client: ClientModel,
    newName: string,
  ): Promise<void> {
    if (this.isUsingLocalFallback) return mockClientDataSource.rename(userId, client, newName);
    if (!userId) throw new Error('Sessão não disponível.');
    const canonicalName = formatClientName(newName);
    if (!canonicalName) throw new Error('Informe o nome do cliente.');
    if (this.list().some((item) => item.normalizedName === normalizeClientKey(canonicalName))) {
      throw new Error('Já existe um cliente com esse nome.');
    }
    const { doc, serverTimestamp, updateDoc } = await import('firebase/firestore');
    await updateDoc(doc(await collectionFor(userId), documentIdForClient(client)), {
      name: canonicalName,
      normalizedName: normalizeClientKey(canonicalName),
      updatedAt: serverTimestamp(),
    });
    await this.load(userId);
  }

  public async removeCustomConfiguration(
    userId: string | undefined,
    client: ClientModel,
  ): Promise<void> {
    if (this.isUsingLocalFallback) {
      return mockClientDataSource.removeCustomConfiguration(userId, client);
    }
    if (!userId) throw new Error('Sessão não disponível.');
    // Arquivar mantém entregas históricas independentes do cadastro atual.
    const { doc, serverTimestamp, updateDoc } = await import('firebase/firestore');
    await updateDoc(doc(await collectionFor(userId), documentIdForClient(client)), {
      archivedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await this.load(userId);
  }

  private publish(): void {
    this.listeners.forEach((listener) => listener());
  }
}

function documentIdForClient(client: ClientModel): string {
  if (!client.clientId.startsWith('client:')) {
    throw new Error('Este cliente não possui ID Firestore.');
  }
  return client.clientId.slice('client:'.length);
}

export const firestoreClientDataSource = new FirestoreClientDataSource();
