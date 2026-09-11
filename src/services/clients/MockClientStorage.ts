import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CustomClient } from '@/types/data';

export const MOCK_CLIENTS_STORAGE_KEY = '@pareact/mock-clients-v1';

type ClientCollection = Record<string, CustomClient>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCustomClient(value: unknown): value is CustomClient {
  if (!isRecord(value)) return false;
  return (
    typeof value.nome === 'string' &&
    typeof value.preco === 'number' &&
    Number.isFinite(value.preco) &&
    (value.endereco === undefined || typeof value.endereco === 'string')
  );
}

function cloneClients(clients: ClientCollection): ClientCollection {
  return Object.fromEntries(Object.entries(clients).map(([name, client]) => [name, { ...client }]));
}

function parseClients(serialized: string): ClientCollection | null {
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!isRecord(parsed)) return null;

    const entries = Object.entries(parsed);
    if (!entries.every(([, client]) => isCustomClient(client))) return null;

    return Object.fromEntries(
      entries.map(([name, client]) => [name, { ...(client as CustomClient) }]),
    );
  } catch {
    return null;
  }
}

export class MockClientStorage {
  private writeQueue = Promise.resolve();

  public async loadOrInitialize(seed: ClientCollection): Promise<ClientCollection> {
    try {
      const serialized = await AsyncStorage.getItem(MOCK_CLIENTS_STORAGE_KEY);
      if (serialized !== null) {
        const persisted = parseClients(serialized);
        if (persisted) return persisted;
      }
    } catch (error) {
      if (__DEV__) console.warn('[MockClientStorage] Falha ao ler clientes mock.', error);
    }

    const initialClients = cloneClients(seed);
    await this.save(initialClients);
    return initialClients;
  }

  public save(clients: ClientCollection): Promise<void> {
    const serialized = JSON.stringify(cloneClients(clients));
    this.writeQueue = this.writeQueue
      .then(() => AsyncStorage.setItem(MOCK_CLIENTS_STORAGE_KEY, serialized))
      .catch((error) => {
        if (__DEV__) console.warn('[MockClientStorage] Falha ao salvar clientes mock.', error);
      });
    return this.writeQueue;
  }
}

export const mockClientStorage = new MockClientStorage();
