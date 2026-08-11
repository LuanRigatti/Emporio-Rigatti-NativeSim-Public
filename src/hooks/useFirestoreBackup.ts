import { useCallback, useMemo, useState } from 'react';

import { useAuth } from '@/providers';
import { createFirestoreBackupService, type FirestoreBackupExportResult } from '@/services/backup';

export function useFirestoreBackup() {
  const { user } = useAuth();
  const userId = user?.id;
  const service = useMemo(() => {
    if (!userId || userId === 'mock-user-1') return null;
    return createFirestoreBackupService(userId);
  }, [userId]);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [result, setResult] = useState<FirestoreBackupExportResult | null>(null);

  const exportBackup = useCallback(async (): Promise<FirestoreBackupExportResult | null> => {
    if (isBusy) return null;
    if (!service) {
      setError('Faça login com uma conta Firebase antes de exportar o backup.');
      return null;
    }
    setError(null);
    setIsBusy(true);
    try {
      const nextResult = await service.exportBackup();
      setResult(nextResult);
      return nextResult;
    } catch (exportError) {
      setError(
        exportError instanceof Error ? exportError.message : 'Não foi possível exportar o backup.',
      );
      return null;
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, service]);

  const clearMessages = useCallback(() => {
    setError(null);
    setResult(null);
  }, []);

  return { clearMessages, error, exportBackup, isBusy, result };
}
