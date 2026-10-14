import { useRouter } from 'expo-router';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { NativeGlassBackButton } from '@/components/native';
import { GlassCard, PremiumScreen, ProgressiveCollapsibleScreen } from '@/components/premium';
import { useAuth } from '@/providers';
import { useAppTheme } from '@/theme';
import { formatCurrency } from '@/utils/data';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';
import {
  clearPendingOpenPaymentBulkOperation,
  createOpenPaymentBulkIdempotencyKey,
  getOpenPaymentBulkOperationStatus,
  getOpenPaymentBulkErrorMessage,
  isDefinitiveOpenPaymentBulkError,
  readPendingOpenPaymentBulkOperation,
  savePendingOpenPaymentBulkOperation,
  type OpenPaymentBulkCommitResult,
  type OpenPaymentBulkConfirmation,
} from '../services/OpenPaymentBulkPaymentService';
import { OpenPaymentClientCards } from './OpenPaymentClientCards';
import { useOpenPaymentClients } from '../hooks/useOpenPaymentClients';

function hasSameDeliveryIdSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const leftIds = new Set(left);
  const rightIds = new Set(right);
  return (
    leftIds.size === left.length &&
    rightIds.size === right.length &&
    leftIds.size === rightIds.size &&
    left.every((id) => rightIds.has(id))
  );
}

export function OpenPaymentClientsScreen({
  nativeHeader = false,
}: { nativeHeader?: boolean } = {}) {
  const router = useRouter();
  const { sessionVersion, user } = useAuth();
  const { theme } = useAppTheme();
  const { currency: maskCurrency } = useTestModePresentation();
  const {
    clientCards,
    bulkPaymentsEnabled,
    commitAllClientPayments,
    markDeliveryPaid,
    previewAllClientPayments,
    paymentHistoryError,
    paymentHistoryLoading,
    testModeEnabled,
    totalOpenAmount,
  } = useOpenPaymentClients();
  const bulkActionPhase = useRef<'idle' | 'previewing' | 'confirming' | 'committing' | 'notice'>(
    'idle',
  );
  const currentSession = useRef({ sessionVersion, uid: user?.id });
  useLayoutEffect(() => {
    currentSession.current = { sessionVersion, uid: user?.id };
  }, [sessionVersion, user?.id]);

  const showNotice = useCallback((title: string, message: string) => {
    bulkActionPhase.current = 'notice';
    Alert.alert(
      title,
      message,
      [{ text: 'OK', onPress: () => (bulkActionPhase.current = 'idle') }],
      {
        cancelable: true,
        onDismiss: () => (bulkActionPhase.current = 'idle'),
      },
    );
  }, []);

  const markAllClientDeliveriesPaid = useCallback(
    async (clientId: string, visibleDeliveryIds: readonly string[]) => {
      if (bulkActionPhase.current !== 'idle' || !bulkPaymentsEnabled || !user?.id) {
        return;
      }
      const uid = user.id;
      const requestedSessionVersion = sessionVersion;
      const isSameSession = () =>
        currentSession.current.uid === uid &&
        currentSession.current.sessionVersion === requestedSessionVersion;
      bulkActionPhase.current = 'previewing';

      const finishCommittedOperation = async (
        clientIdToClear: string,
        result: OpenPaymentBulkCommitResult,
        cacheSynchronized: boolean,
      ) => {
        if (!isSameSession()) {
          bulkActionPhase.current = 'idle';
          return;
        }
        try {
          await clearPendingOpenPaymentBulkOperation(uid, clientIdToClear);
        } catch {
          // O recibo persistente do servidor torna seguro recuperar o resultado depois.
        }
        triggerLightImpactHaptic();
        showNotice(
          'Quitação confirmada',
          `${result.clientName}: ${result.eligibleCount} entregas, ${formatCurrency(result.totalCents / 100)}.${cacheSynchronized ? '' : '\n\nO servidor confirmou a quitação. A atualização de alguns totais será concluída quando a sincronização estiver disponível.'}`,
        );
      };

      const showPendingConfirmation = (pending: OpenPaymentBulkConfirmation) => {
        if (!isSameSession()) {
          bulkActionPhase.current = 'idle';
          return;
        }
        bulkActionPhase.current = 'confirming';
        const commitConfirmedOperation = async () => {
          if (bulkActionPhase.current !== 'confirming') return;
          if (!isSameSession()) {
            showNotice('Sessão alterada', 'Entre novamente e atualize Pagamentos em aberto.');
            return;
          }
          bulkActionPhase.current = 'committing';
          const attemptedOperation = { ...pending, commitAttempted: true };
          try {
            await savePendingOpenPaymentBulkOperation(uid, attemptedOperation);
            const { cacheSynchronized, result } = await commitAllClientPayments({
              clientId: attemptedOperation.clientId,
              idempotencyKey: attemptedOperation.idempotencyKey,
              snapshotFingerprint: attemptedOperation.snapshotFingerprint,
              visibleDeliveryIds: attemptedOperation.visibleDeliveryIds,
            });
            await finishCommittedOperation(attemptedOperation.clientId, result, cacheSynchronized);
          } catch (error) {
            if (isDefinitiveOpenPaymentBulkError(error)) {
              try {
                await clearPendingOpenPaymentBulkOperation(uid, attemptedOperation.clientId);
              } catch {
                // Uma chave antiga é revalidada pelo recibo antes de qualquer nova gravação.
              }
            }
            showNotice('Não foi possível concluir', getOpenPaymentBulkErrorMessage(error));
          }
        };

        Alert.alert(
          'Marcar todas como pagas?',
          `${pending.clientName}\n\n${pending.eligibleCount} entregas pendentes\nTotal: ${formatCurrency(pending.totalCents / 100)}\n\nA confirmação marcará somente o status como Pago.`,
          [
            {
              text: 'Cancelar',
              style: 'cancel',
              onPress: () => {
                bulkActionPhase.current = 'idle';
                if (!pending.commitAttempted) {
                  void clearPendingOpenPaymentBulkOperation(uid, pending.clientId).catch(
                    () => undefined,
                  );
                }
              },
            },
            {
              text: 'Confirmar',
              style: 'destructive',
              onPress: () => void commitConfirmedOperation(),
            },
          ],
          {
            cancelable: true,
            onDismiss: () => {
              if (bulkActionPhase.current === 'confirming') {
                bulkActionPhase.current = 'idle';
                if (!pending.commitAttempted) {
                  void clearPendingOpenPaymentBulkOperation(uid, pending.clientId).catch(
                    () => undefined,
                  );
                }
              }
            },
          },
        );
      };

      try {
        let pending = await readPendingOpenPaymentBulkOperation(uid, clientId);
        let confirmation: OpenPaymentBulkConfirmation | null = null;
        if (!isSameSession()) {
          bulkActionPhase.current = 'idle';
          return;
        }
        if (pending?.commitAttempted) {
          const operationStatus = await getOpenPaymentBulkOperationStatus(pending.idempotencyKey);
          if (!isSameSession()) {
            bulkActionPhase.current = 'idle';
            return;
          }
          if (operationStatus.status === 'committed') {
            const { cacheSynchronized, result } = await commitAllClientPayments({
              clientId: pending.clientId,
              idempotencyKey: pending.idempotencyKey,
              snapshotFingerprint: pending.snapshotFingerprint,
              visibleDeliveryIds: pending.visibleDeliveryIds,
            });
            if (!isSameSession()) {
              bulkActionPhase.current = 'idle';
              return;
            }
            if (hasSameDeliveryIdSet(pending.visibleDeliveryIds, visibleDeliveryIds)) {
              await finishCommittedOperation(pending.clientId, result, cacheSynchronized);
              return;
            }
            try {
              await clearPendingOpenPaymentBulkOperation(uid, pending.clientId);
            } catch {
              showNotice(
                'Quitação anterior confirmada',
                'O servidor confirmou a operação anterior, mas não foi possível liberar a chave salva neste dispositivo. Nenhuma nova quitação foi iniciada. Atualize e tente novamente.',
              );
              return;
            }
            pending = null;
          }
        }
        if (pending && !pending.commitAttempted) {
          await clearPendingOpenPaymentBulkOperation(uid, clientId);
          pending = null;
        }
        if (!pending || pending.commitAttempted) {
          const preview = await previewAllClientPayments(clientId, visibleDeliveryIds);
          if (!isSameSession()) {
            bulkActionPhase.current = 'idle';
            return;
          }
          if (preview.status === 'presentation-mismatch') {
            bulkActionPhase.current = 'idle';
            const details = [
              `${preview.clientName}: o servidor encontrou ${preview.eligibleCount} entregas pendentes no valor de ${formatCurrency(preview.totalCents / 100)}.`,
              preview.notShownCount
                ? `${preview.notShownCount} entrega(s) não aparecem neste card.`
                : '',
              preview.noLongerEligibleCount
                ? `${preview.noLongerEligibleCount} entrega(s) do card não estão mais pendentes.`
                : '',
              'Nada foi quitado. Atualize a lista para reconciliar os dados antes de tentar novamente.',
            ]
              .filter(Boolean)
              .join('\n\n');
            showNotice('Pendências diferentes', details);
            return;
          }
          if (preview.status === 'limit-exceeded') {
            bulkActionPhase.current = 'idle';
            showNotice(
              'Limite seguro excedido',
              `O servidor encontrou pelo menos ${preview.minimumEligibleCount} entregas. O máximo para uma operação atômica é ${preview.maxEligibleCount}. Use as ações individuais.`,
            );
            return;
          }
          if (preview.status === 'empty') {
            bulkActionPhase.current = 'idle';
            showNotice('Nenhuma pendência', 'Não há entregas elegíveis para quitar.');
            return;
          }
          if (
            typeof preview.snapshotFingerprint !== 'string' ||
            typeof preview.eligibleCount !== 'number' ||
            typeof preview.totalCents !== 'number'
          ) {
            throw new Error('bulk_preview_response_invalid');
          }
          const confirmedPreview: OpenPaymentBulkConfirmation = {
            clientId,
            visibleDeliveryIds: [...visibleDeliveryIds],
            snapshotFingerprint: preview.snapshotFingerprint,
            idempotencyKey:
              pending?.commitAttempted === true
                ? pending.idempotencyKey
                : createOpenPaymentBulkIdempotencyKey(),
            clientName: preview.clientName,
            eligibleCount: preview.eligibleCount,
            totalCents: preview.totalCents,
            commitAttempted: false,
          };
          pending = confirmedPreview;
          await savePendingOpenPaymentBulkOperation(uid, confirmedPreview);
          confirmation = confirmedPreview;
        }
        if (!confirmation) throw new Error('bulk_confirmation_unavailable');
        showPendingConfirmation(confirmation);
      } catch (error) {
        showNotice('Não foi possível preparar a quitação', getOpenPaymentBulkErrorMessage(error));
      }
    },
    [
      bulkPaymentsEnabled,
      commitAllClientPayments,
      previewAllClientPayments,
      sessionVersion,
      showNotice,
      user,
    ],
  );

  const header = (
    <NativeGlassHeader
      leftActions={
        nativeHeader ? undefined : (
          <NativeGlassBackButton
            accessibilityLabel="Voltar para Home"
            color={theme.colors.textPrimary}
            containerSize={theme.sizes.touchTargetMinimum}
            onPress={() => router.back()}
            size={theme.sizes.iconMedium}
          />
        )
      }
      mode="transparent"
      title=""
    />
  );
  const totalCard =
    clientCards.length > 0 ? (
      <GlassCard
        style={[
          styles.totalCard,
          {
            borderRadius: theme.radius.lg,
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: theme.spacing.xs,
          },
        ]}
      >
        <Text
          style={[
            theme.typography.body,
            {
              color: theme.colors.textPrimary,
              fontSize: 17,
              fontWeight: theme.typography.headline.fontWeight,
            },
          ]}
        >
          {maskCurrency(totalOpenAmount)}
        </Text>
      </GlassCard>
    ) : undefined;
  const pageTitle = (
    <NativeGlassHeader
      includeTopSafeArea={false}
      mode="transparent"
      largeTitle
      rightActions={totalCard}
      title="Em aberto"
      titleStyle={{
        fontFamily: 'System',
        fontSize: 36,
        fontWeight: '700',
        marginLeft: -(theme.spacing.xxs * 2),
      }}
    />
  );
  const clientCardsContent =
    clientCards.length > 0 ? (
      <OpenPaymentClientCards
        clients={clientCards}
        paymentHistoryError={paymentHistoryError}
        paymentHistoryLoading={paymentHistoryLoading}
        onMarkAsPaid={markDeliveryPaid}
        onMarkAllAsPaid={bulkPaymentsEnabled ? markAllClientDeliveriesPaid : undefined}
        nativePreviewEnabled={nativeHeader}
        testModeEnabled={testModeEnabled}
      />
    ) : (
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
        Nenhum recebimento em aberto
      </Text>
    );
  const originalContentTopOffset = theme.spacing.xl + theme.spacing.xxl + theme.spacing.xxs * 2 + 2;

  const content = (
    <View style={[styles.content, { gap: theme.spacing.lg, marginTop: originalContentTopOffset }]}>
      {pageTitle}
      {clientCardsContent}
    </View>
  );

  if (nativeHeader) {
    return (
      <ProgressiveCollapsibleScreen
        compactTitle="Em aberto"
        contentTopInset={originalContentTopOffset}
        largeTitle={pageTitle}
        nativeHeader
      >
        {clientCardsContent}
      </ProgressiveCollapsibleScreen>
    );
  }

  return (
    <PremiumScreen
      contentContainerStyle={[
        styles.screenContent,
        { gap: theme.spacing.xl, paddingBottom: theme.spacing.xxxl },
      ]}
      overlayHeader={header}
      progressiveBlur
    >
      {content}
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: { flexGrow: 1 },
  content: { width: '100%' },
  totalCard: { alignSelf: 'center' },
});
