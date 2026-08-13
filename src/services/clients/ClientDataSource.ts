import type { UserDataSnapshot } from '@/services/data';
import type { ClientModel } from '@/types/data';

import {
  ENABLE_FIRESTORE_CLIENTS_DELIVERIES,
  ENABLE_MOCK_CLIENT_DATA,
} from '@/config/featureFlags';

import { clientCatalogService, type ClientCatalogQuery } from './ClientCatalogService';
import { clientIdentityRegistry } from './ClientIdentityRegistry';
import { mockClientDataSource } from './MockClientDataSource';
import { firestoreClientDataSource } from './FirestoreClientDataSource';

export type ClientDataMode = 'mock' | 'firebase';

export interface ClientDataSource {
  readonly mode: ClientDataMode;
  getSnapshot(): UserDataSnapshot | null;
  subscribe(listener: () => void): () => void;
  load(userId?: string): Promise<void>;
  list(query?: ClientCatalogQuery, userId?: string): ClientModel[];
  saveCustomClient(
    userId: string | undefined,
    name: string,
    price: number,
    address: string,
    usesInvoice?: boolean,
    usesBoleto?: boolean,
  ): Promise<void>;
  updatePrice(
    userId: string | undefined,
    client: ClientModel,
    price: number,
    usesInvoice?: boolean,
    usesBoleto?: boolean,
  ): Promise<void>;
  rename(userId: string | undefined, client: ClientModel, newName: string): Promise<void>;
  removeCustomConfiguration(userId: string | undefined, client: ClientModel): Promise<void>;
}

export class FirebaseClientDataSource implements ClientDataSource {
  public readonly mode = 'firebase' as const;
  private snapshot: UserDataSnapshot | null = null;
  private readonly listeners = new Set<() => void>();

  public getSnapshot = (): UserDataSnapshot | null => this.snapshot;

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public async load(userId?: string): Promise<void> {
    const uid = this.requireUserId(userId);
    await clientIdentityRegistry.load(uid);
    const { userDataService } = await import('@/services/data/UserDataService');
    this.snapshot = (await userDataService.loadWithCacheFallback(uid)).snapshot;
    this.publish();
  }

  public list(query: ClientCatalogQuery = {}, userId?: string): ClientModel[] {
    if (!this.snapshot || !userId) return [];

    return clientCatalogService.list(this.snapshot, {
      ...query,
      clientIdForName: (name) => clientIdentityRegistry.get(userId, name),
    });
  }

  public async saveCustomClient(
    userId: string | undefined,
    name: string,
    price: number,
    address: string,
    usesInvoice?: boolean,
    usesBoleto?: boolean,
  ): Promise<void> {
    const uid = this.requireUserId(userId);
    const { ClientMutationService } = await import('./ClientMutationService');
    await new ClientMutationService(uid).saveCustomClient(
      name,
      price,
      address,
      usesInvoice,
      usesBoleto,
    );
    await this.load(uid);
  }

  public async updatePrice(
    userId: string | undefined,
    client: ClientModel,
    price: number,
    usesInvoice?: boolean,
    usesBoleto?: boolean,
  ): Promise<void> {
    const uid = this.requireUserId(userId);
    const { ClientMutationService } = await import('./ClientMutationService');
    await new ClientMutationService(uid).updatePrice(client, price, usesInvoice, usesBoleto);
    await this.load(uid);
  }

  public async rename(
    userId: string | undefined,
    client: ClientModel,
    newName: string,
  ): Promise<void> {
    const uid = this.requireUserId(userId);
    const { ClientMutationService } = await import('./ClientMutationService');
    await new ClientMutationService(uid).rename(client, newName);
    await this.load(uid);
  }

  public async removeCustomConfiguration(
    userId: string | undefined,
    client: ClientModel,
  ): Promise<void> {
    const uid = this.requireUserId(userId);
    const { ClientMutationService } = await import('./ClientMutationService');
    await new ClientMutationService(uid).removeCustomConfiguration(client);
    await this.load(uid);
  }

  private requireUserId(userId: string | undefined): string {
    if (!userId) throw new Error('Sessão não disponível.');
    return userId;
  }

  private publish(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const firebaseClientDataSource = new FirebaseClientDataSource();

export const clientDataSource: ClientDataSource = ENABLE_FIRESTORE_CLIENTS_DELIVERIES
  ? firestoreClientDataSource
  : ENABLE_MOCK_CLIENT_DATA
    ? mockClientDataSource
    : firebaseClientDataSource;
