import { File, Paths } from 'expo-file-system';

import type { BackupData } from '@/types/data';

export interface BackupPreventiveRecord {
  backupId: string;
  createdAt: string;
  uri: string;
}

export class BackupPreventiveService {
  public async create(data: BackupData, date = new Date()): Promise<BackupPreventiveRecord> {
    const backupId = `backup-${date.getTime()}`;
    const file = new File(Paths.document, `${backupId}.json`);
    file.create({ overwrite: true });
    file.write(JSON.stringify(data, null, 2), { encoding: 'utf8' });
    return { backupId, createdAt: date.toISOString(), uri: file.uri };
  }
}

export const backupPreventiveService = new BackupPreventiveService();
