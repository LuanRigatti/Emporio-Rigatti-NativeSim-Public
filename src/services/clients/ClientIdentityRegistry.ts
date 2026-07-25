import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ClientId } from '@/types/data';
import { clientIdFromName, normalizeClientKey } from '@/utils/data';

type RegistryMap = Record<string, ClientId>;

export class ClientIdentityRegistry {
  private readonly maps = new Map<string, RegistryMap>();

  public getKey(uid: string): string {
    return `client-identity-registry_${uid}`;
  }

  public async load(uid: string): Promise<void> {
    if (this.maps.has(uid)) return;
    const serialized = await AsyncStorage.getItem(this.getKey(uid));
    if (!serialized) {
      this.maps.set(uid, {});
      return;
    }

    try {
      const parsed: unknown = JSON.parse(serialized);
      const map: RegistryMap = {};
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        for (const [key, value] of Object.entries(parsed)) {
          if (typeof value === 'string' && value.length > 0) map[key] = value as ClientId;
        }
      }
      this.maps.set(uid, map);
    } catch {
      this.maps.set(uid, {});
    }
  }

  public get(uid: string, name: string): ClientId {
    return this.maps.get(uid)?.[normalizeClientKey(name)] ?? clientIdFromName(name);
  }

  public async rememberRename(
    uid: string,
    oldName: string,
    newName: string,
    clientId: ClientId,
  ): Promise<void> {
    await this.load(uid);
    const map = this.maps.get(uid) ?? {};
    delete map[normalizeClientKey(oldName)];
    map[normalizeClientKey(newName)] = clientId;
    this.maps.set(uid, map);
    await AsyncStorage.setItem(this.getKey(uid), JSON.stringify(map));
  }
}

export const clientIdentityRegistry = new ClientIdentityRegistry();
