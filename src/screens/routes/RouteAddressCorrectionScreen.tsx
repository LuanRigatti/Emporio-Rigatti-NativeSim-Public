import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import {
  Card,
  ErrorState,
  Input,
  LargeTitleHeader,
  NativeRouteMap,
  PrimaryButton,
  ScrollScreen,
  SecondaryButton,
} from '@/components';
import { useRoute } from '@/hooks/useRoute';
import type { DeliveriesStackParamList } from '@/navigation/types';
import { locationTrackingService } from '@/services/routes';
import {
  ROUTE_MAP_DEFAULT_CENTER,
  type RouteAddressResolution,
  type RouteCoordinate,
  type RouteSession,
} from '@/types/route';
import { useAppTheme } from '@/theme';

type Props = NativeStackScreenProps<DeliveriesStackParamList, 'RouteAddressCorrection'>;

export function RouteAddressCorrectionScreen({ navigation, route }: Props) {
  const { theme } = useAppTheme();
  const { getSession, recreate, loading, error } = useRoute();
  const session = getSession(route.params.sessionId);
  const [address, setAddress] = useState(route.params.address);
  const [manualCoordinate, setManualCoordinate] = useState<RouteCoordinate>();
  const [actionError, setActionError] = useState<string>();

  const resolution = useMemo<RouteAddressResolution | undefined>(
    () => session?.unresolvedAddresses.find((item) => item.address === route.params.address),
    [route.params.address, session?.unresolvedAddresses],
  );

  if (!session || !resolution) {
    return (
      <ErrorState
        title="Correção não encontrada"
        description="A sessão de rota expirou. Prepare a rota novamente."
        onRetry={() => navigation.goBack()}
      />
    );
  }

  const confirmCorrection = async () => {
    setActionError(undefined);
    try {
      const nextSession = await recreate(
        session,
        manualCoordinate
          ? { [resolution.deliveryId ?? findLocationId(session, resolution)]: manualCoordinate }
          : {},
        address.trim() && !manualCoordinate
          ? { [resolution.deliveryId ?? findLocationId(session, resolution)]: address.trim() }
          : {},
      );
      if (nextSession.unresolvedAddresses.length > 0) {
        const next = nextSession.unresolvedAddresses[0];
        navigation.replace('RouteAddressCorrection', {
          sessionId: nextSession.id,
          address: next.address,
          deliveryId: next.deliveryId,
          returnTo: 'route',
        });
        return;
      }
      await locationTrackingService.startRouteTracking(nextSession.id);
      navigation.replace('RouteMap', { sessionId: nextSession.id });
    } catch (correctionError) {
      setActionError(
        correctionError instanceof Error
          ? correctionError.message
          : 'Não foi possível corrigir o endereço.',
      );
    }
  };

  const mapStops = session.stops;

  return (
    <ScrollScreen>
      <LargeTitleHeader onBack={() => navigation.goBack()} title="Corrigir endereço" />
      <View style={{ gap: theme.spacing.md, padding: theme.spacing.md }}>
        <ErrorState
          title="Endereço não localizado"
          description={resolution.error ?? 'Corrija o texto ou escolha o ponto manualmente.'}
        />
        <Input
          label="Endereço para esta rota"
          required
          clearable
          value={address}
          onChangeText={setAddress}
          onClear={() => setAddress('')}
        />
        <SecondaryButton
          fullWidth
          icon={
            <Ionicons
              color={theme.colors.primary}
              name="create-outline"
              size={theme.sizes.iconSmall}
            />
          }
          onPress={() =>
            navigation.navigate('EditDelivery', { deliveryId: resolution.deliveryId ?? '' })
          }
          disabled={!resolution.deliveryId}
        >
          Editar cadastro do cliente
        </SecondaryButton>
        <Card style={{ height: 280, overflow: 'hidden', padding: 0 }}>
          <NativeRouteMap
            initialCoordinate={mapStops[0]?.coordinates ?? ROUTE_MAP_DEFAULT_CENTER}
            selectable
            onSelectCoordinate={setManualCoordinate}
            polylines={[]}
            stops={mapStops}
          />
        </Card>
        <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
          {manualCoordinate
            ? `Ponto manual selecionado: ${manualCoordinate.latitude.toFixed(5)}, ${manualCoordinate.longitude.toFixed(5)}`
            : 'Toque no mapa para selecionar manualmente um ponto confirmado.'}
        </Text>
        {actionError || error ? (
          <ErrorState title="Não foi possível corrigir" description={actionError ?? error} />
        ) : null}
        <PrimaryButton
          fullWidth
          loading={loading}
          disabled={!address.trim() && !manualCoordinate}
          onPress={() => void confirmCorrection()}
        >
          Confirmar ponto e recalcular
        </PrimaryButton>
      </View>
    </ScrollScreen>
  );
}

function findLocationId(session: RouteSession, resolution: RouteAddressResolution): string {
  const location = [
    session.plan.origin,
    ...session.plan.mandatoryBeforeDeliveries,
    ...session.plan.mandatoryAfterDeliveries,
    session.plan.destination,
  ].find((item) => item.address === resolution.address);
  return location?.id ?? 'route-location';
}
