import AsyncStorage from '@react-native-async-storage/async-storage';

import type { UserDataSnapshot } from '@/services/data';

export interface ClientMutationBackup {
  createdAt: string;
  snapshot: UserDataSnapshot;
}

export class ClientBackupService {
  public getKey(uid: string): string {
    return `client-mutation-backup_${uid}`;
  }

  public async create(uid: string, snapshot: UserDataSnapshot): Promise<ClientMutationBackup> {
    const backup: ClientMutationBackup = {
      createdAt: new Date().toISOString(),
      snapshot,
    };
    await AsyncStorage.setItem(this.getKey(uid), JSON.stringify(backup));
    return backup;
  }
}

export const clientBackupService = new ClientBackupService();
