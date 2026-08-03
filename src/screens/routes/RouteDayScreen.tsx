import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import {
  BottomSheet,
  Card,
  DateInput,
  EmptyState,
  ErrorState,
  Input,
  LargeTitleHeader,
  Loading,
  PrimaryButton,
  ScrollScreen,
  SelectableListItem,
  SegmentedControl,
  SecondaryButton,
} from '@/components';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useRoute } from '@/hooks/useRoute';
import type { DeliveriesStackParamList } from '@/navigation/types';
import {
  createRouteLocation,
  createRoutePlanFromPreset,
  getAvailableRouteDates,
  locationTrackingService,
} from '@/services/routes';
import {
  ROUTE_BASE_ADDRESS,
  ROUTE_FLAMBOYANT_ADDRESS,
  ROUTE_PLAV_ADDRESS,
  type RoutePreset,
  type RouteOptimizationMode,
} from '@/types/route';
import { formatPtBrDate, normalizeLegacyDate, todayIso } from '@/utils/data';
import { useAppTheme } from '@/theme';

type Props = NativeStackScreenProps<DeliveriesStackParamList, 'RouteDay'>;

const presetLabels: Readonly<Record<RoutePreset, string>> = {
  'flamboyant-plav': 'Flamboyant → Entregas → Francisco',
  'plav-flamboyant': 'PLAV → Entregas → Flamboyant → Francisco',
  custom: 'Personalizar',
};

export function RouteDayScreen({ navigation, route }: Props) {
  const { theme } = useAppTheme();
  const [date, setDate] = useState(
    () => normalizeLegacyDate(route.params?.date ?? '') ?? todayIso(),
  );
  const [preset, setPreset] = useState<RoutePreset>('flamboyant-plav');
  const [optimization, setOptimization] = useState<RouteOptimizationMode>('distance');
  const [customOrigin, setCustomOrigin] = useState(ROUTE_BASE_ADDRESS);
  const [customBefore, setCustomBefore] = useState('');
  const [customAfter, setCustomAfter] = useState('');
  const [customDestination, setCustomDestination] = useState(ROUTE_BASE_ADDRESS);
  const [actionError, setActionError] = useState<string>();
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const {
    deliveries,
    allDeliveries,
    loading: deliveriesLoading,
    error: deliveriesError,
    snapshot,
    reload,
  } = useDeliveries({ mode: 'today', date });
  const { create, loading: routeLoading } = useRoute();
  const availableRouteDates = useMemo(() => {
    const dates = getAvailableRouteDates(allDeliveries);
    return dates.includes(date)
      ? dates
      : [date, ...dates].sort((left, right) => right.localeCompare(left));
  }, [allDeliveries, date]);
  const deliveryCountByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    allDeliveries.forEach((delivery) => {
      const normalizedDate = normalizeLegacyDate(delivery.data);
      if (normalizedDate) counts[normalizedDate] = (counts[normalizedDate] ?? 0) + 1;
    });
    return counts;
  }, [allDeliveries]);

  const createCustomLocations = (value: string, prefix: string) =>
    value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((address, index) =>
        createRouteLocation(`${prefix}-${index}`, address, address, 'mandatory'),
      );

  const plan = useMemo(() => {
    if (preset !== 'custom') return createRoutePlanFromPreset(date, preset, optimization);
    return {
      ...createRoutePlanFromPreset(date, 'custom', optimization),
      origin: createRouteLocation('origin-custom', 'Origem', customOrigin, 'origin'),
      mandatoryBeforeDeliveries: createCustomLocations(customBefore, 'mandatory-before'),
      mandatoryAfterDeliveries: createCustomLocations(customAfter, 'mandatory-after'),
      destination: createRouteLocation(
        'destination-custom',
        'Destino final',
        customDestination,
        'destination',
      ),
    };
  }, [customAfter, customBefore, customDestination, customOrigin, date, optimization, preset]);

  const startRoute = async () => {
    if (!snapshot) return;
    setActionError(undefined);
    try {
      const session = await create(plan, deliveries, snapshot);
      if (session.unresolvedAddresses.length > 0) {
        navigation.navigate('RouteAddressCorrection', {
          sessionId: session.id,
          address: session.unresolvedAddresses[0]?.address ?? '',
          deliveryId: session.unresolvedAddresses[0]?.deliveryId,
          returnTo: 'route',
        });
      } else {
        await locationTrackingService.startRouteTracking(session.id);
        navigation.navigate('RouteMap', { sessionId: session.id });
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível iniciar a rota.');
    }
  };

  return (
    <ScrollScreen refreshing={deliveriesLoading} onRefresh={() => void reload()}>
      <LargeTitleHeader
        onBack={() => navigation.goBack()}
        subtitle="Configure os pontos antes de otimizar"
        title="Rota do dia"
      />
      <View style={{ gap: theme.spacing.md, padding: theme.spacing.md }}>
        <DateInput
          helperText="Selecione uma data com entregas para montar a rota."
          label="Data das entregas"
          required
          value={formatPtBrDate(date)}
          onPress={() => setDatePickerVisible(true)}
        />
        <BottomSheet
          onClose={() => setDatePickerVisible(false)}
          title="Selecionar data da rota"
          visible={datePickerVisible}
        >
          <ScrollView
            contentContainerStyle={{ gap: theme.spacing.xs }}
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: theme.sizes.bottomSheetMinimumHeight * 3 }}
          >
            {availableRouteDates.length > 0 ? (
              availableRouteDates.map((availableDate) => (
                <SelectableListItem
                  key={availableDate}
                  onSelect={() => {
                    setDate(availableDate);
                    setDatePickerVisible(false);
                  }}
                  selected={availableDate === date}
                  subtitle={`${deliveryCountByDate[availableDate] ?? 0} entrega(s)`}
                  title={formatPtBrDate(availableDate)}
                />
              ))
            ) : (
              <EmptyState
                description="Não existem entregas com data válida para selecionar."
                title="Nenhuma data disponível"
              />
            )}
          </ScrollView>
        </BottomSheet>

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
            Como será a rota?
          </Text>
          {(['flamboyant-plav', 'plav-flamboyant', 'custom'] as const).map((item) => (
            <SecondaryButton
              fullWidth
              icon={
                <Ionicons
                  color={preset === item ? theme.colors.primary : theme.colors.textSecondary}
                  name={preset === item ? 'checkmark-circle' : 'ellipse-outline'}
                  size={theme.sizes.iconSmall}
                />
              }
              key={item}
              onPress={() => setPreset(item)}
            >
              {presetLabels[item]}
            </SecondaryButton>
          ))}
        </View>

        <SegmentedControl
          options={[
            { value: 'distance' as const, label: 'Menor distância' },
            { value: 'time' as const, label: 'Menor tempo' },
          ]}
          value={optimization}
          onChange={setOptimization}
        />

        {preset === 'custom' ? (
          <Card>
            <View style={{ gap: theme.spacing.md }}>
              <Input label="Origem" required value={customOrigin} onChangeText={setCustomOrigin} />
              <Input
                label="Paradas obrigatórias antes das entregas"
                helperText="Uma parada por linha. A ordem será preservada."
                multiline
                value={customBefore}
                onChangeText={setCustomBefore}
              />
              <Input
                label="Últimas paradas operacionais"
                helperText="Uma parada por linha. A ordem será preservada."
                multiline
                value={customAfter}
                onChangeText={setCustomAfter}
              />
              <Input
                label="Destino final"
                required
                value={customDestination}
                onChangeText={setCustomDestination}
              />
            </View>
          </Card>
        ) : null}

        <Card>
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
            Pontos fixos
          </Text>
          <Text
            style={[
              theme.typography.body,
              { color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
            ]}
          >
            {preset === 'flamboyant-plav'
              ? ROUTE_FLAMBOYANT_ADDRESS
              : preset === 'plav-flamboyant'
                ? `${ROUTE_PLAV_ADDRESS} → ${ROUTE_FLAMBOYANT_ADDRESS}`
                : 'A ordem informada será preservada.'}
          </Text>
          <Text
            style={[
              theme.typography.footnote,
              { color: theme.colors.textSecondary, marginTop: theme.spacing.sm },
            ]}
          >
            Destino final padrão: {ROUTE_BASE_ADDRESS}
          </Text>
        </Card>

        {deliveriesError ? (
          <ErrorState
            title="Não foi possível carregar entregas"
            description={deliveriesError}
            onRetry={() => void reload()}
          />
        ) : null}
        {!deliveriesLoading && !deliveriesError && deliveries.length === 0 ? (
          <EmptyState
            title="Nenhuma entrega nesta data"
            description="A rota precisa de entregas para ser calculada."
          />
        ) : null}
        {!deliveriesLoading && deliveries.length > 0 ? (
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
            {deliveries.length} entrega(s) serão incluídas e poderão ser reordenadas.
          </Text>
        ) : null}
        {actionError ? (
          <ErrorState title="Não foi possível preparar a rota" description={actionError} />
        ) : null}
        <PrimaryButton
          fullWidth
          loading={routeLoading}
          disabled={deliveriesLoading || !snapshot}
          onPress={() => void startRoute()}
        >
          Otimizar rota
        </PrimaryButton>
        {routeLoading ? <Loading label="Consultando endereços e rotas" /> : null}
      </View>
    </ScrollScreen>
  );
}
