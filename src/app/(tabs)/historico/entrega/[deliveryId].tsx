import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { EmptyState, ErrorState, LargeTitleHeader, PrimaryButton } from '@/components';
import { Screen } from '@/components/layout';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useAuth } from '@/providers';
import { entregasDoDiaSnapshotCoordinator } from '@/features/deliveries/widgets/EntregasDoDiaSnapshotCoordinator';
import { useAppTheme } from '@/theme';
import { todayIso } from '@/utils/data';

function isLocalISODate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export default function WidgetDeliveryConfirmationRoute() {
  const params = useLocalSearchParams<{
    deliveryId?: string | string[];
    date?: string | string[];
  }>();
  const deliveryId = Array.isArray(params.deliveryId) ? params.deliveryId[0] : params.deliveryId;
  const requestedDate = Array.isArray(params.date) ? params.date[0] : params.date;
  const validTarget = Boolean(
    deliveryId?.trim() &&
    requestedDate &&
    isLocalISODate(requestedDate) &&
    requestedDate === todayIso(),
  );
  const { sessionVersion, status, user } = useAuth();
  const { theme } = useAppTheme();
  const { allDeliveries, error, loading, reload, setDelivered } = useDeliveries({
    mode: 'all',
    deliveryId: validTarget ? deliveryId : '',
  });
  const delivery = validTarget
    ? allDeliveries.find(
        (candidate) => candidate.id === deliveryId && candidate.data === requestedDate,
      )
    : undefined;
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | undefined>();
  const [confirmedDeliveryId, setConfirmedDeliveryId] = useState<string | null>(null);
  const actionInFlight = useRef(false);
  const currentSession = useRef({ uid: user?.id ?? null, sessionVersion });
  useEffect(() => {
    currentSession.current = { uid: user?.id ?? null, sessionVersion };
  }, [sessionVersion, user?.id]);

  const runCompletion = async () => {
    if (actionInFlight.current || !user?.id || !delivery || delivery.entregue || !requestedDate) {
      return;
    }

    const requestSession = { uid: user.id, sessionVersion };
    actionInFlight.current = true;
    setSubmitting(true);
    setActionError(undefined);

    try {
      await setDelivered(delivery.id, true);
      if (
        currentSession.current.uid !== requestSession.uid ||
        currentSession.current.sessionVersion !== requestSession.sessionVersion
      ) {
        return;
      }
      setConfirmedDeliveryId(delivery.id);
      entregasDoDiaSnapshotCoordinator.refreshAvailableSnapshot(
        requestSession.uid,
        requestSession.sessionVersion,
      );
    } catch (completionError) {
      if (
        currentSession.current.uid === requestSession.uid &&
        currentSession.current.sessionVersion === requestSession.sessionVersion
      ) {
        setActionError(
          completionError instanceof Error
            ? completionError.message
            : 'Não foi possível confirmar a entrega. Tente novamente.',
        );
      }
    } finally {
      actionInFlight.current = false;
      setSubmitting(false);
    }
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/historico?mode=wholesale');
  };

  return (
    <Screen>
      <LargeTitleHeader onBack={goBack} title="Confirmar entrega" />
      {status === 'loading' ? (
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          Verificando sua sessão...
        </Text>
      ) : !user ? (
        <EmptyState
          title="Entre no app para confirmar"
          description="A entrega só pode ser alterada com uma sessão autenticada."
        />
      ) : !validTarget ? (
        <EmptyState
          title="Entrega indisponível"
          description="Abra novamente a lista de entregas para escolher um item atualizado."
        />
      ) : loading && !delivery ? (
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          Carregando entrega...
        </Text>
      ) : error && !delivery ? (
        <ErrorState
          description={error}
          onRetry={() => void reload()}
          title="Não foi possível carregar a entrega"
        />
      ) : !delivery ? (
        <EmptyState
          title="Entrega não encontrada"
          description="Ela pode ter sido removida ou não pertencer à data exibida no widget."
        />
      ) : (
        <View style={{ gap: theme.spacing.md, padding: theme.spacing.md }}>
          <View style={{ gap: theme.spacing.xs }}>
            <Text style={[theme.typography.title2, { color: theme.colors.textPrimary }]}>
              {delivery.cliente}
            </Text>
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
              {delivery.quantidade} {delivery.quantidade === 1 ? 'balde' : 'baldes'} ·{' '}
              {delivery.data}
            </Text>
            <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
              Confirmar altera somente o estado da entrega. O pagamento permanece como está.
            </Text>
          </View>
          {delivery.entregue || confirmedDeliveryId === delivery.id ? (
            <EmptyState
              title="Entrega concluída"
              description="O registro permanece no histórico do aplicativo."
            />
          ) : (
            <PrimaryButton
              accessibilityLabel={`Confirmar entrega de ${delivery.cliente}`}
              disabled={submitting}
              fullWidth
              loading={submitting}
              onPress={() => void runCompletion()}
            >
              Confirmar entrega
            </PrimaryButton>
          )}
          {actionError ? (
            <Text
              accessibilityRole="alert"
              style={[theme.typography.footnote, { color: theme.colors.danger }]}
            >
              {actionError}
            </Text>
          ) : null}
        </View>
      )}
    </Screen>
  );
}
