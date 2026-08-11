import { useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { NativeGlassBackButton } from '@/components/native';
import { PremiumScreen } from '@/components/premium';
import { useFirestoreBackup } from '@/hooks/useFirestoreBackup';
import { useFirestoreBackupDryRun } from '@/hooks/useFirestoreBackupDryRun';
import { useFirestoreBackupRestore } from '@/hooks/useFirestoreBackupRestore';
import type { FirestoreBackupDryRunReport } from '@/services/backup';
import { useAppTheme } from '@/theme';

import { SettingItem } from './SettingItem';
import { SettingsSection } from './SettingsSection';

export function BackupScreen() {
  const { theme } = useAppTheme();
  const router = useRouter();
  const firestoreBackup = useFirestoreBackup();
  const firestoreBackupDryRun = useFirestoreBackupDryRun();
  const firestoreBackupRestore = useFirestoreBackupRestore();
  const {
    error: firestoreBackupRestoreError,
    isBusy: firestoreBackupRestoreBusy,
    restoreBackup,
  } = firestoreBackupRestore;

  useEffect(() => {
    const error =
      firestoreBackup.error ?? firestoreBackupDryRun.error ?? firestoreBackupRestoreError;
    if (error) {
      Alert.alert('Backup não concluído', error);
    }
  }, [firestoreBackup.error, firestoreBackupDryRun.error, firestoreBackupRestoreError]);

  useEffect(() => {
    if (firestoreBackup.result) {
      Alert.alert(
        'Backup exportado',
        `${firestoreBackup.result.fileName}\n${firestoreBackup.result.counts.deliveries} entregas · ${firestoreBackup.result.sizeBytes} bytes`,
      );
    }
  }, [firestoreBackup.result]);

  useEffect(() => {
    const report = firestoreBackupDryRun.report;
    if (!report) {
      return;
    }

    const entitySummary = Object.entries(report.entities)
      .map(
        ([entity, result]) =>
          `${entity}: ${result.totalInBackup} no backup · ${result.wouldCreate} criar · ${result.identical} iguais · ${result.conflicts} conflitos`,
      )
      .join('\n');
    const totalCreates = Object.values(report.entities).reduce(
      (total, entity) => total + entity.wouldCreate,
      0,
    );
    const totalConflicts = Object.values(report.entities).reduce(
      (total, entity) => total + entity.conflicts,
      0,
    );
    Alert.alert(
      report.status === 'ready' ? 'Backup validado' : 'Backup bloqueado',
      `${report.status === 'ready' ? 'Dry-run concluído sem escritas.' : 'Corrija os problemas antes de restaurar.'}\nCriar: ${totalCreates} · Conflitos: ${totalConflicts}\nEscritas Firestore: ${report.writesAttempted}\n\n${entitySummary}`,
    );
  }, [firestoreBackupDryRun.report]);

  const confirmBackupRestore = useCallback(
    (report: FirestoreBackupDryRunReport) =>
      new Promise<boolean>((resolve) => {
        let settled = false;
        const finish = (confirmed: boolean) => {
          if (settled) return;
          settled = true;
          resolve(confirmed);
        };
        const conflicts = Object.values(report.entities).reduce(
          (total, entity) => total + entity.conflicts,
          0,
        );
        const creates = Object.values(report.entities).reduce(
          (total, entity) => total + entity.wouldCreate,
          0,
        );
        Alert.alert(
          'Confirmar restauração',
          `Serão criados ${creates} documentos. Conflitos: ${conflicts}.\n\nDocumentos existentes não serão sobrescritos nem excluídos.`,
          [
            { onPress: () => finish(false), style: 'cancel', text: 'Cancelar' },
            { onPress: () => finish(true), style: 'destructive', text: 'Restaurar' },
          ],
          { cancelable: true, onDismiss: () => finish(false) },
        );
      }),
    [],
  );

  const handleRestoreBackup = useCallback(async () => {
    const flow = await restoreBackup(confirmBackupRestore);
    if (!flow) return;
    if (flow.preparation.report.status !== 'ready') {
      Alert.alert('Restauração bloqueada', 'O backup não passou na validação/dry-run.');
      return;
    }
    if (!flow.result) return;

    const postStatus = flow.result.postRestoreDryRun?.status ?? 'blocked';
    const title =
      flow.result.status === 'completed' ? 'Restauração concluída' : 'Restauração parcial';
    Alert.alert(
      title,
      `Criados: ${flow.result.created}\nIgnorados: ${flow.result.skipped}\nConflitos: ${flow.result.conflicts}\nFalhas: ${flow.result.failed}\nEscritas: ${flow.result.writesSucceeded}/${flow.result.writesAttempted}\nPós-dry-run: ${postStatus}\nExclusões: ${flow.result.deletionsAttempted}`,
    );
  }, [confirmBackupRestore, restoreBackup]);

  const header = (
    <NativeGlassHeader
      leftActions={
        <NativeGlassBackButton
          accessibilityLabel="Voltar para Configurações"
          color={theme.colors.textPrimary}
          containerSize={theme.sizes.touchTargetMinimum}
          onPress={() => router.back()}
          size={theme.sizes.iconMedium}
        />
      }
      mode="transparent"
      title="Backup"
    />
  );

  return (
    <PremiumScreen contentContainerStyle={styles.content} overlayHeader={header} progressiveBlur>
      <View style={[styles.section, { marginTop: theme.spacing.md }]}>
        <SettingsSection>
          <SettingItem
            description={firestoreBackup.isBusy ? 'Gerando backup...' : 'Somente leitura'}
            fallbackIcon="share-outline"
            onPress={() => void firestoreBackup.exportBackup()}
            systemName="square.and.arrow.up"
            title="Exportar backup"
          />
          <SettingItem
            description={
              firestoreBackupDryRun.isBusy ? 'Validando backup...' : 'Dry-run somente leitura'
            }
            fallbackIcon="checkmark-circle-outline"
            onPress={() => void firestoreBackupDryRun.validateBackup()}
            systemName="checkmark.shield"
            title="Validar backup"
          />
          <SettingItem
            description={
              firestoreBackupRestoreBusy
                ? 'Restaurando backup...'
                : 'Confirmação e dry-run obrigatórios'
            }
            fallbackIcon="download-outline"
            isLast
            onPress={() => void handleRestoreBackup()}
            systemName="arrow.down.doc"
            title="Restaurar backup"
          />
        </SettingsSection>
      </View>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  section: { gap: 8 },
});
