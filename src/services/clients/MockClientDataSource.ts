import { mapLegacyClientToModel } from '@/mappers/clients';
import type { UserDataSnapshot } from '@/services/data';
import type { ClientModel, CustomClient } from '@/types/data';
import {
  clientIdFromName,
  formatClientName,
  isAliasName,
  normalizeClientKey,
  normalizeMoney,
} from '@/utils/data';

import type { ClientCatalogQuery } from './ClientCatalogService';
import { mockClientStorage } from './MockClientStorage';

export const MOCK_CLIENT_ITEMS = [
  { id: 'joao', title: 'Jo\u00e3o Silva', systemImage: 'person.crop.circle.fill' },
  { id: 'maria', title: 'Maria Oliveira', systemImage: 'person.crop.circle.fill' },
  { id: 'pedro', title: 'Pedro Santos', systemImage: 'person.crop.circle.fill' },
  { id: 'ana', title: 'Ana Costa', systemImage: 'person.crop.circle.fill' },
  { id: 'lucas', title: 'Lucas Ferreira', systemImage: 'person.crop.circle.fill' },
  { id: 'beatriz', title: 'Beatriz Martins', systemImage: 'person.crop.circle.fill' },
  { id: 'carlos', title: 'Carlos Souza', systemImage: 'person.crop.circle.fill' },
  { id: 'juliana', title: 'Juliana Alves', systemImage: 'person.crop.circle.fill' },
  { id: 'rafael', title: 'Rafael Lima', systemImage: 'person.crop.circle.fill' },
  { id: 'sofia', title: 'Sofia Rocha', systemImage: 'person.crop.circle.fill' },
] as const;

const MOCK_BUCKET_PRICE = 49.8;

type Listener = () => void;

function createInitialClients(): Record<string, CustomClient> {
  return Object.fromEntries(
    MOCK_CLIENT_ITEMS.map(({ title }) => [title, { nome: title, preco: MOCK_BUCKET_PRICE }]),
  );
}

function findClientKey(clients: Record<string, CustomClient>, normalizedName: string) {
  return Object.keys(clients).find((name) => normalizeClientKey(name) === normalizedName);
}

function createSnapshot(clientConfig: Record<string, CustomClient>): UserDataSnapshot {
  return {
    clientesCustom: clientConfig,
    entregas: [],
    gastosDiarios: {},
    gastosMensais: {},
    recebimentoBaldes: [],
  };
}

export class MockClientDataSource {
  private clients = createInitialClients();
  private snapshot = createSnapshot(this.clients);
  private readonly listeners = new Set<Listener>();
  private readonly hydrationPromise: Promise<void>;

  public constructor() {
    this.hydrationPromise = this.restorePersistedClients();
  }

  public subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public getSnapshot = (): UserDataSnapshot => this.snapshot;

  public list(query: ClientCatalogQuery = {}): ClientModel[] {
    const normalizedSearch = query.search ? normalizeClientKey(query.search) : '';
    return Object.entries(this.clients)
      .map(([name, customConfig]) =>
        mapLegacyClientToModel({
          address: customConfig.endereco,
          clientId: clientIdFromName(name),
          currentPrice: customConfig.preco,
          customConfig,
          name,
          sources: ['custom'],
        }),
      )
      .filter((client) => !normalizedSearch || client.normalizedName.includes(normalizedSearch))
      .sort((left, right) => left.canonicalName.localeCompare(right.canonicalName, 'pt-BR'));
  }

  public async saveCustomClient(name: string, price: number, address: string): Promise<void> {
    await this.hydrationPromise;
    const canonicalName = formatClientName(name);
    if (!canonicalName) throw new Error('Informe o nome do cliente.');
    if (isAliasName(name)) {
      throw new Error('Este cliente j\u00e1 existe atrav\u00e9s de um alias. Escolha outro nome.');
    }
    const normalizedPrice = normalizeMoney(price);
    if (normalizedPrice === undefined || normalizedPrice <= 0) {
      throw new Error('Informe um pre\u00e7o maior que zero.');
    }
    if (!address.trim()) throw new Error('Informe o endereÃ§o do cliente.');
    if (findClientKey(this.clients, normalizeClientKey(canonicalName))) {
      throw new Error('J\u00e1 existe um cliente personalizado com esse nome.');
    }

    this.clients = {
      ...this.clients,
      [canonicalName]: {
        endereco: address.trim(),
        nome: canonicalName,
        preco: normalizedPrice,
      },
    };
    await this.persistAndPublish();
  }

  public async updatePrice(client: ClientModel, price: number): Promise<void> {
    await this.hydrationPromise;
    const key = findClientKey(this.clients, client.normalizedName);
    if (!key) throw new Error('Cliente mock não encontrado.');

    const normalizedPrice = normalizeMoney(price);
    if (normalizedPrice === undefined || normalizedPrice <= 0) {
      throw new Error('Informe um preço maior que zero.');
    }

    this.clients = {
      ...this.clients,
      [key]: { ...this.clients[key], preco: normalizedPrice },
    };
    await this.persistAndPublish();
  }

  public async rename(client: ClientModel, newName: string): Promise<void> {
    await this.hydrationPromise;
    const oldKey = findClientKey(this.clients, client.normalizedName);
    const canonicalName = formatClientName(newName);
    if (!oldKey) throw new Error('Cliente mock n\u00e3o encontrado.');
    if (!canonicalName) throw new Error('Informe o nome do cliente.');
    if (isAliasName(newName)) {
      throw new Error('Este cliente j\u00e1 existe atrav\u00e9s de um alias. Escolha outro nome.');
    }
    const existingKey = findClientKey(this.clients, normalizeClientKey(canonicalName));
    if (existingKey && existingKey !== oldKey) {
      throw new Error('J\u00e1 existe um cliente personalizado com esse nome.');
    }

    const nextClients = { ...this.clients };
    const config = nextClients[oldKey];
    delete nextClients[oldKey];
    nextClients[canonicalName] = { ...config, nome: canonicalName };
    this.clients = nextClients;
    await this.persistAndPublish();
  }

  public async removeCustomConfiguration(client: ClientModel): Promise<void> {
    await this.hydrationPromise;
    const key = findClientKey(this.clients, client.normalizedName);
    if (!key) throw new Error('Cliente mock n\u00e3o encontrado.');
    const nextClients = { ...this.clients };
    delete nextClients[key];
    this.clients = nextClients;
    await this.persistAndPublish();
  }

  public async resetToSeed(): Promise<void> {
    await this.hydrationPromise;
    this.clients = createInitialClients();
    await this.persistAndPublish();
  }

  private async restorePersistedClients(): Promise<void> {
    this.clients = await mockClientStorage.loadOrInitialize(createInitialClients());
    this.publish();
  }

  private async persistAndPublish(): Promise<void> {
    await mockClientStorage.save(this.clients);
    this.publish();
  }

  private publish(): void {
    this.snapshot = createSnapshot(this.clients);
    this.listeners.forEach((listener) => listener());
  }
}

export const mockClientDataSource = new MockClientDataSource();
