import { BackupFileService } from '@/services/backup/BackupFileService';
import { BackupPreventiveService } from '@/services/backup/BackupPreventiveService';
import { FirestoreBackupFileService } from '@/services/backup/FirestoreBackupFileService';
import type { BackupData } from '@/types/data';

const mockWrite = jest.fn();
const mockInfo = jest.fn(() => ({ size: 123 }));
const mockDelete = jest.fn();

jest.mock('expo-file-system', () => ({
  File: class {
    uri = 'file:///backup.json';
    exists = true;
    create = jest.fn();
    write = mockWrite;
    info = mockInfo;
    delete = mockDelete;
  },
  Paths: { cache: 'file:///cache', document: 'file:///document' },
}));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-document-picker', () => ({}));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

const data: BackupData = {
  entregas: [],
  gastosDiarios: {},
  gastosMensais: {},
  recebimentoBaldes: [],
};
const cases: [string, () => Promise<{ uri: string }>][] = [
  ['Firestore export', () => new FirestoreBackupFileService().create('{"value":1}', 'backup.json')],
  ['export', () => new BackupFileService().createExportFile(data)],
  ['preventive backup', () => new BackupPreventiveService().create(data)],
];

describe.each(cases)('%s asynchronous file write', (_name, create) => {
  it('keeps the URI pending until the entire write completes', async () => {
    let finish!: () => void;
    mockWrite.mockReturnValueOnce(new Promise<void>((resolve) => (finish = resolve)));
    let returned = false;
    const pending = create().then((result) => {
      returned = true;
      return result;
    });
    await Promise.resolve();
    expect(returned).toBe(false);
    expect(mockInfo).not.toHaveBeenCalled();
    finish();
    await expect(pending).resolves.toMatchObject({ uri: 'file:///backup.json' });
  });

  it('rejects asynchronous write failures instead of returning a successful backup', async () => {
    const error = new Error('write failed');
    mockWrite.mockRejectedValueOnce(error);
    await expect(create()).rejects.toBe(error);
    expect(mockInfo).not.toHaveBeenCalled();
    if (_name === 'Firestore export') expect(mockDelete).toHaveBeenCalledTimes(1);
  });
});
