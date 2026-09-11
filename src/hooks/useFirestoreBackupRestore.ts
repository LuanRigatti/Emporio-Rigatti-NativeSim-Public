import { useCallback, useMemo, useState } from 'react';

import { useAuth } from '@/providers';
import {
  createFirestoreBackupRestoreService,
  type FirestoreBackupDryRunReport,
  type FirestoreBackupRestorePreparation,
  type FirestoreBackupRestoreReport,
} from '@/services/backup';

export type ConfirmFirestoreBackupRestore = (
  report: FirestoreBackupDryRunReport,
) => Promise<boolean>;

export type FirestoreBackupRestoreFlowResult = {
  preparation: FirestoreBackupRestorePreparation;
  result: FirestoreBackupRestoreReport | null;
};

export function useFirestoreBackupRestore() {
  const { user } = useAuth();
  const userId = user?.id;
  const service = useMemo(() => {
    if (!userId || userId === 'mock-user-1') return null;
    return createFirestoreBackupRestoreService(userId);
  }, [userId]);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const restoreBackup = useCallback(
    async (
      confirm: ConfirmFirestoreBackupRestore,
    ): Promise<FirestoreBackupRestoreFlowResult | null> => {
      if (isBusy) return null;
      if (!service) {
        setError('Faça login com uma conta Firebase antes de restaurar o backup.');
        return null;
      }

      setError(null);
      setIsBusy(true);
      try {
        const preparation = await service.selectAndPrepare();
        if (!preparation) return null;

        if (preparation.report.status !== 'ready') {
          return { preparation, result: null };
        }

        const confirmed = await confirm(preparation.report);
        if (!confirmed) return { preparation, result: null };

        const result = await service.restore(preparation, true);
        return { preparation, result };
      } catch (restoreError) {
        setError(
          restoreError instanceof Error
            ? restoreError.message
            : 'Não foi possível restaurar o backup.',
        );
        return null;
      } finally {
        setIsBusy(false);
      }
    },
    [isBusy, service],
  );

  return { error, isBusy, restoreBackup };
}
