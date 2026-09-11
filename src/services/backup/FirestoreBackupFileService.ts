import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export type GeneratedFirestoreBackupFile = {
  fileName: string;
  uri: string;
  sizeBytes: number;
};

export class FirestoreBackupFileService {
  public async create(json: string, fileName: string): Promise<GeneratedFirestoreBackupFile> {
    if (Platform.OS === 'web') {
      const blob = new Blob([json], { type: 'application/json' });
      return {
        fileName,
        sizeBytes: blob.size,
        uri: URL.createObjectURL(blob),
      };
    }

    const file = new File(Paths.cache, fileName);
    try {
      file.create({ overwrite: true });
      file.write(json, { encoding: 'utf8' });
      return {
        fileName,
        sizeBytes: file.info().size ?? json.length,
        uri: file.uri,
      };
    } catch (error) {
      if (file.exists) file.delete();
      throw error;
    }
  }

  public async share(file: GeneratedFirestoreBackupFile): Promise<void> {
    if (Platform.OS === 'web') {
      const anchor = document.createElement('a');
      anchor.href = file.uri;
      anchor.download = file.fileName;
      anchor.click();
      return;
    }

    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('O Share Sheet não está disponível neste dispositivo.');
    }

    await Sharing.shareAsync(file.uri, {
      UTI: 'public.json',
      dialogTitle: 'Compartilhar backup do Firestore',
      mimeType: 'application/json',
    });
  }

  public release(file: GeneratedFirestoreBackupFile): void {
    if (Platform.OS === 'web') {
      URL.revokeObjectURL(file.uri);
      return;
    }

    const nativeFile = new File(file.uri);
    if (nativeFile.exists) nativeFile.delete();
  }
}

export const firestoreBackupFileService = new FirestoreBackupFileService();
