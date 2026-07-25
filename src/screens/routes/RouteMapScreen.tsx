import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import {
  Card,
  ErrorState,
  LargeTitleHeader,
  Loading,
  NativeRouteMap,
  PrimaryButton,
  RouteStopCard,
  ScrollScreen,
  SecondaryButton,
} from '@/components';
import { useRoute } from '@/hooks/useRoute';
import type { DeliveriesStackParamList } from '@/navigation/types';
import { routeExternalMapsService } from '@/services/routes';
import { useAppTheme } from '@/theme';

type Props = NativeStackScreenProps<DeliveriesStackParamList, 'RouteMap'>;

export function RouteMapScreen({ navigation, route }: Props) {
  const { theme } = useAppTheme();
  const routeState = useRoute(route.params.sessionId);
  const session = routeState.session ?? routeState.getSession(route.params.sessionId);

  const polylines = useMemo(
    () =>
      session?.summary.segments
        .map((segment) => segment.decodedPolyline)
        .filter((line) => line.length > 0) ?? [],
    [session?.summary.segments],
  );

  if (!session)
    return (
      <ErrorState
        title="Rota não encontrada"
        description="Prepare a rota novamente."
        onRetry={() => navigation.goBack()}
      />
    );
  if (session.unresolvedAddresses.length > 0) {
    const unresolved = session.unresolvedAddresses[0];
    return (
      <ErrorState
        title="A rota precisa de correções"
        description="Todos os endereços precisam estar confirmados antes da otimização."
        onRetry={() =>
          navigation.replace('RouteAddressCorrection', {
            sessionId: session.id,
            address: unresolved.address,
            deliveryId: unresolved.deliveryId,
            returnTo: 'route',
          })
        }
      />
    );
  }

  const currentStop = session.stops[session.currentStopIndex];
  const markCurrentDelivered = async () => {
    if (!currentStop?.deliveryId) return;
    try {
      const nextSession = await routeState.markDelivered(currentStop.deliveryId);
      routeState.loadSession(nextSession.id);
    } catch (error) {
      // The hook exposes the user-facing error state; the screen remains usable.
      console.warn(error);
    }
  };

  const saveDistance = async () => {
    await routeState.saveDistance(session);
  };

  return (
    <ScrollScreen>
      <LargeTitleHeader
        onBack={() => navigation.goBack()}
        subtitle={session.plan.date}
        title="Mapa da rota"
      />
      <View style={{ gap: theme.spacing.md, padding: theme.spacing.md }}>
        <Card style={{ height: 320, overflow: 'hidden', padding: 0 }}>
          <NativeRouteMap polylines={polylines} stops={session.stops} />
        </Card>
        <Card>
          <Text style={[theme.typography.title2, { color: theme.colors.textPrimary }]}>Resumo</Text>
          <View
            style={{ flexDirection: 'row', gap: theme.spacing.lg, marginTop: theme.spacing.sm }}
          >
            <View>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                Distância
              </Text>
              <Text style={[theme.typography.metricMedium, { color: theme.colors.textPrimary }]}>
                {session.summary.distanceKm.toFixed(1)} km
              </Text>
            </View>
            <View>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                Duração
              </Text>
              <Text style={[theme.typography.metricMedium, { color: theme.colors.textPrimary }]}>
                {session.summary.durationMinutes} min
              </Text>
            </View>
          </View>
        </Card>
        {routeState.error ? (
          <ErrorState title="Erro na rota" description={routeState.error} />
        ) : null}
        {routeState.loading ? <Loading label="Atualizando rota" /> : null}
        {currentStop ? (
          <Card>
            <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
              Próxima parada
            </Text>
            <Text
              style={[
                theme.typography.body,
                { color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
              ]}
            >
              {currentStop.sequence}. {currentStop.label}
            </Text>
            {currentStop.deliveryId ? (
              <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
                <PrimaryButton
                  fullWidth
                  disabled={currentStop.delivered}
                  onPress={() => void markCurrentDelivered()}
                >
                  {currentStop.delivered ? 'Entrega realizada' : 'Marcar entrega realizada'}
                </PrimaryButton>
                <SecondaryButton fullWidth onPress={() => routeState.advance()}>
                  Avançar à próxima parada
                </SecondaryButton>
              </View>
            ) : null}
            <View
              style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}
            >
              <SecondaryButton
                fullWidth
                icon={
                  <Ionicons
                    color={theme.colors.primary}
                    name="map-outline"
                    size={theme.sizes.iconSmall}
                  />
                }
                onPress={() => void routeExternalMapsService.openAppleMaps(currentStop.coordinates)}
              >
                Apple Maps
              </SecondaryButton>
              <SecondaryButton
                fullWidth
                icon={
                  <Ionicons
                    color={theme.colors.primary}
                    name="navigate-outline"
                    size={theme.sizes.iconSmall}
                  />
                }
                onPress={() =>
                  void routeExternalMapsService.openGoogleMaps(currentStop.coordinates)
                }
              >
                Google Maps
              </SecondaryButton>
            </View>
          </Card>
        ) : null}
        <View style={{ gap: theme.spacing.sm }}>
          {session.stops.map((stop) => (
            <RouteStopCard
              address={stop.address}
              clientName={stop.label}
              key={stop.id}
              order={stop.sequence}
              status={
                stop.delivered ? 'Entregue' : stop.kind === 'delivery' ? 'Pendente' : 'Emitido'
              }
              onPress={() => void routeExternalMapsService.openAppleMaps(stop.coordinates)}
            />
          ))}
        </View>
        <SecondaryButton fullWidth onPress={() => void saveDistance()}>
          Salvar quilometragem do dia
        </SecondaryButton>
      </View>
    </ScrollScreen>
  );
}
