import { useCallback, useMemo, useState } from 'react';

import { createBackupService } from '@/services/backup';
import type {
  BackupExportResult,
  BackupImportCandidate,
  BackupImportReport,
  BackupPreview,
} from '@/types/data';

import { useAuth } from '@/providers';

export type BackupOperation = 'idle' | 'selecting' | 'preview' | 'importing' | 'completed';

export interface BackupState {
  candidate: BackupImportCandidate | null;
  error: string | null;
  exportResult: BackupExportResult | null;
  importReport: BackupImportReport | null;
  isBusy: boolean;
  operation: BackupOperation;
  preview: BackupPreview | null;
}

export interface UseBackupResult extends BackupState {
  clearError: () => void;
  cancelImport: () => void;
  exportBackup: () => Promise<void>;
  importBackup: () => Promise<void>;
  selectImportFile: () => Promise<void>;
}

export function useBackup(): UseBackupResult {
  const { user } = useAuth();
  const service = useMemo(() => (user ? createBackupService(user.id) : null), [user]);
  const [candidate, setCandidate] = useState<BackupImportCandidate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<BackupExportResult | null>(null);
  const [importReport, setImportReport] = useState<BackupImportReport | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [operation, setOperation] = useState<BackupOperation>('idle');

  const selectImportFile = useCallback(async () => {
    if (!service) return;
    setIsBusy(true);
    setError(null);
    setOperation('selecting');
    try {
      const nextCandidate = await service.selectImportFile();
      if (!nextCandidate) {
        setOperation('idle');
        return;
      }
      setCandidate(nextCandidate);
      setOperation('preview');
    } catch (selectionError) {
      setError(
        selectionError instanceof Error
          ? selectionError.message
          : 'Não foi possível selecionar o backup.',
      );
      setOperation('idle');
    } finally {
      setIsBusy(false);
    }
  }, [service]);

  const importBackup = useCallback(async () => {
    if (!service || !candidate) return;
    setIsBusy(true);
    setError(null);
    setOperation('importing');
    try {
      setImportReport(await service.importBackup(candidate));
      setCandidate(null);
      setOperation('completed');
    } catch (importError) {
      setError(
        importError instanceof Error ? importError.message : 'Não foi possível importar o backup.',
      );
      setOperation('preview');
    } finally {
      setIsBusy(false);
    }
  }, [candidate, service]);

  const exportBackup = useCallback(async () => {
    if (!service) return;
    setIsBusy(true);
    setError(null);
    try {
      setExportResult(await service.exportBackup());
    } catch (exportError) {
      setError(
        exportError instanceof Error ? exportError.message : 'Não foi possível exportar o backup.',
      );
    } finally {
      setIsBusy(false);
    }
  }, [service]);

  const cancelImport = useCallback(() => {
    setCandidate(null);
    setError(null);
    setOperation('idle');
  }, []);

  const clearError = useCallback(() => setError(null), []);
  const preview = candidate?.preview ?? null;

  return {
    cancelImport,
    candidate,
    clearError,
    error,
    exportBackup,
    exportResult,
    importBackup,
    importReport,
    isBusy,
    operation,
    preview,
    selectImportFile,
  };
}
