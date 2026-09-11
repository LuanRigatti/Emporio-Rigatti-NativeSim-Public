import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { BackupData } from '@/types/data';

export interface PickedBackupFile {
  contents: string;
  fileName: string;
}

export interface GeneratedBackupFile {
  fileName: string;
  exportedAt: string;
  json: string;
  uri: string;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function fileDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

async function readWebAsset(asset: DocumentPicker.DocumentPickerAsset): Promise<string> {
  if (asset.file) return asset.file.text();
  const response = await fetch(asset.uri);
  if (!response.ok) throw new Error('Não foi possível ler o arquivo selecionado.');
  return response.text();
}

export class BackupFileService {
  public async pickJsonFile(): Promise<PickedBackupFile | null> {
    const result = await DocumentPicker.getDocumentAsync({
      base64: false,
      copyToCacheDirectory: true,
      multiple: false,
      type: 'application/json',
    });
    if (result.canceled || result.assets.length === 0) return null;

    const asset = result.assets[0];
    const contents =
      Platform.OS === 'web' ? await readWebAsset(asset) : await new File(asset.uri).text();
    return { contents, fileName: asset.name };
  }

  public async createExportFile(data: BackupData, date = new Date()): Promise<GeneratedBackupFile> {
    const exportedAt = date.toISOString();
    const fileName = `backup-nuvem-vendas-${fileDate(date)}.json`;
    const json = JSON.stringify(data, null, 2);

    if (Platform.OS === 'web') {
      const blob = new Blob([json], { type: 'application/json' });
      return { exportedAt, fileName, json, uri: URL.createObjectURL(blob) };
    }

    const file = new File(Paths.cache, fileName);
    file.create({ overwrite: true });
    file.write(json, { encoding: 'utf8' });
    return { exportedAt, fileName, json, uri: file.uri };
  }

  public async shareOrDownload(file: GeneratedBackupFile): Promise<void> {
    if (Platform.OS === 'web') {
      const anchor = document.createElement('a');
      anchor.href = file.uri;
      anchor.download = file.fileName;
      anchor.click();
      return;
    }

    const available = await Sharing.isAvailableAsync();
    if (!available) throw new Error('O Share Sheet não está disponível neste dispositivo.');
    await Sharing.shareAsync(file.uri, {
      UTI: 'public.json',
      dialogTitle: 'Compartilhar backup',
      mimeType: 'application/json',
    });
  }

  public release(file: GeneratedBackupFile): void {
    if (Platform.OS === 'web') {
      URL.revokeObjectURL(file.uri);
      return;
    }
    const nativeFile = new File(file.uri);
    if (nativeFile.exists) nativeFile.delete();
  }
}

export const backupFileService = new BackupFileService();
