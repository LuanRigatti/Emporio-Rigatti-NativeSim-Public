import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { View } from 'react-native';

import {
  AppText,
  Badge,
  ConfirmationDialog,
  ErrorState,
  LargeTitleHeader,
  Loading,
  PrimaryButton,
  ScrollScreen,
  SecondaryButton,
  Section,
} from '@/components';
import { useBackup } from '@/hooks/useBackup';
import type { MoreStackParamList } from '@/navigation/types';
import type { BackupRecordCounts } from '@/types/data';
import { useAppTheme } from '@/theme';

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreBackup'>;

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function totalRecords(counts: BackupRecordCounts): number {
  return (
    counts.deliveries +
    counts.dailyExpenses +
    counts.monthlyExpenses +
    counts.factoryReceipts +
    counts.factoryPayments +
    counts.customClients
  );
}

function countLines(counts: BackupRecordCounts): string[] {
  return [
    `Entregas: ${counts.deliveries}`,
    `Gastos diários: ${counts.dailyExpenses}`,
    `Gastos mensais: ${counts.monthlyExpenses}`,
    `Recebimentos: ${counts.factoryReceipts}`,
    `Pagamentos de fábrica: ${counts.factoryPayments}`,
    `Clientes personalizados: ${counts.customClients}`,
  ];
}

export function BackupScreen({ navigation }: Props) {
  const { theme } = useAppTheme();
  const backup = useBackup();
  const [showConfirmation, setShowConfirmation] = useState(false);
  const preview = backup.preview;
  const isLoading = backup.isBusy;

  return (
    <ScrollScreen refreshing={isLoading}>
      <LargeTitleHeader onBack={() => navigation.goBack()} title="Backup" />
      <View style={{ gap: theme.spacing.lg, padding: theme.spacing.md }}>
        {backup.error ? (
          <ErrorState
            description={backup.error}
            onRetry={backup.clearError}
            title="Não foi possível concluir a operação"
          />
        ) : null}

        <Section title="Dados atuais">
          <AppText>
            Exporte uma cópia JSON dos dados compatíveis com o Firebase. O token de notificações não
            é incluído no arquivo.
          </AppText>
          <PrimaryButton fullWidth loading={isLoading} onPress={() => void backup.exportBackup()}>
            Exportar backup
          </PrimaryButton>
          {backup.exportResult ? (
            <View style={{ gap: theme.spacing.xs }}>
              <Badge label="Exportação concluída" tone="success" />
              <AppText variant="footnote">
                {backup.exportResult.fileName} · {formatDate(backup.exportResult.exportedAt)}
              </AppText>
              {countLines(backup.exportResult.counts).map((line) => (
                <AppText key={line} variant="footnote">
                  {line}
                </AppText>
              ))}
              <AppText variant="footnote">
                Total: {totalRecords(backup.exportResult.counts)} registros.
              </AppText>
            </View>
          ) : null}
        </Section>

        <Section title="Importar dados">
          <AppText>
            O arquivo será validado antes da importação. Dados atuais serão preservados e conflitos
            não serão substituídos silenciosamente.
          </AppText>
          {!preview ? (
            <SecondaryButton
              fullWidth
              loading={isLoading}
              onPress={() => void backup.selectImportFile()}
            >
              Selecionar arquivo JSON
            </SecondaryButton>
          ) : (
            <View style={{ gap: theme.spacing.sm }}>
              <Badge label={`Arquivo: ${backup.candidate?.fileName ?? 'backup'}`} tone="info" />
              <AppText variant="headline">Prévia da importação</AppText>
              {countLines({
                customClients: preview.customClients,
                dailyExpenses: preview.dailyExpenses,
                deliveries: preview.deliveries,
                factoryPayments: preview.factoryPayments,
                factoryReceipts: preview.factoryReceipts,
                monthlyExpenses: preview.monthlyExpenses,
              }).map((line) => (
                <AppText key={line} variant="footnote">
                  {line}
                </AppText>
              ))}
              <AppText variant="footnote">
                Formato detectado: {preview.sourceFormat}. Total:{' '}
                {totalRecords({
                  customClients: preview.customClients,
                  dailyExpenses: preview.dailyExpenses,
                  deliveries: preview.deliveries,
                  factoryPayments: preview.factoryPayments,
                  factoryReceipts: preview.factoryReceipts,
                  monthlyExpenses: preview.monthlyExpenses,
                })}{' '}
                registros.
              </AppText>
              {preview.warnings.map((warning) => (
                <AppText key={warning} variant="footnote">
                  Aviso: {warning}
                </AppText>
              ))}
              {preview.conflicts.length > 0 ? (
                <AppText variant="footnote">
                  Conflitos detectados: {preview.conflicts.length}. Os registros atuais serão
                  preservados.
                </AppText>
              ) : null}
              <PrimaryButton
                fullWidth
                loading={isLoading}
                onPress={() => setShowConfirmation(true)}
              >
                Confirmar importação
              </PrimaryButton>
              <SecondaryButton disabled={isLoading} fullWidth onPress={backup.cancelImport}>
                Cancelar
              </SecondaryButton>
            </View>
          )}
          {isLoading ? <Loading label="Processando backup" /> : null}
        </Section>

        {backup.importReport ? (
          <Section title="Resultado">
            <Badge label="Importação concluída" tone="success" />
            <AppText variant="footnote">
              {backup.importReport.imported.deliveries} entregas e{' '}
              {backup.importReport.imported.factoryReceipts} recebimentos adicionados.
            </AppText>
            <AppText variant="footnote">
              Integridade verificada: {backup.importReport.integrityVerified ? 'sim' : 'não'}.
            </AppText>
            <AppText variant="footnote">Backup preventivo: {backup.importReport.backupId}</AppText>
            {backup.importReport.conflicts.length > 0 ? (
              <AppText variant="footnote">
                {backup.importReport.conflicts.length} conflitos foram preservados sem substituição.
              </AppText>
            ) : null}
          </Section>
        ) : null}
      </View>
      <ConfirmationDialog
        confirmLabel="Importar"
        loading={isLoading}
        message="Será criado um backup preventivo antes da importação. Registros atuais com conflito serão preservados. Deseja continuar?"
        onCancel={() => setShowConfirmation(false)}
        onConfirm={() => {
          setShowConfirmation(false);
          void backup.importBackup();
        }}
        title="Confirmar importação"
        visible={showConfirmation}
      />
    </ScrollScreen>
  );
}
