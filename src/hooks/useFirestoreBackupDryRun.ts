import { useCallback, useMemo, useState } from 'react';

import { useAuth } from '@/providers';
import {
  createFirestoreBackupDryRunService,
  type FirestoreBackupDryRunReport,
} from '@/services/backup';

export function useFirestoreBackupDryRun() {
  const { user } = useAuth();
  const userId = user?.id;
  const service = useMemo(() => {
    if (!userId || userId === 'mock-user-1') return null;
    return createFirestoreBackupDryRunService(userId);
  }, [userId]);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [report, setReport] = useState<FirestoreBackupDryRunReport | null>(null);

  const validateBackup = useCallback(async (): Promise<FirestoreBackupDryRunReport | null> => {
    if (isBusy) return null;
    if (!service) {
      setError('Faça login com uma conta Firebase antes de validar o backup.');
      return null;
    }
    setError(null);
    setIsBusy(true);
    try {
      const nextReport = await service.selectAndRun();
      if (nextReport) setReport(nextReport);
      return nextReport;
    } catch (validationError) {
      setError(
        validationError instanceof Error
          ? validationError.message
          : 'Não foi possível validar o backup.',
      );
      return null;
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, service]);

  return { error, isBusy, report, validateBackup };
}
