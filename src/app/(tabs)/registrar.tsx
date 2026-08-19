import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NativeGlassHeader } from '@/components/layout';
import {
  NativeBottomSheet,
  NativeCardContextMenu,
  NativeDailyDataSheet,
  NativeGlassBackButton,
  NativeGlassIconButton,
} from '@/components/native';
import type {
  NativeBottomSheetConfirmation,
  NativeBottomSheetItem,
  NativeDailyDataValues,
} from '@/components/native';
import { PremiumCard, PremiumScreen } from '@/components/premium';
import { useClients } from '@/hooks/useClients';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useCostSettings } from '@/hooks/useCostSettings';
import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { formatCurrency, normalizeMoney, todayIso } from '@/utils/data';
import { toHistoryDelivery } from '@/services/data';

const BUCKET_PRICE = 49.8;

const EMPTY_DAILY_DATA_VALUES: NativeDailyDataValues = {
  estar: '',
  fuelPrice: '',
  kilometers: '',
  other: '',
};

export default function PrototypeRegistrar() {
  return <RegistrarModeSelection />;
}

function RegistrarModeSelection() {
  const { theme } = useAppTheme();
  const router = useRouter();

  const handleOpenRegistrarEntrega = () => {
    triggerLightImpactHaptic();
    router.push('/registrar-entrega');
  };

  const handleOpenRegistrarDados = () => {
    triggerLightImpactHaptic();
    router.push('/registrar-dados-diarios');
  };

  const header = (
    <NativeGlassHeader
      includeTopSafeArea={false}
      largeTitle
      mode="transparent"
      titleStyle={{ fontFamily: 'System', marginLeft: -(theme.spacing.xxs * 2) }}
      title="Registrar"
    />
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <PremiumScreen
        contentContainerStyle={[
          styles.modeSelectionContent,
          { marginTop: theme.spacing.xxxl + theme.spacing.xl },
        ]}
        progressiveBlurHeight={
          theme.spacing.xxxl + theme.spacing.xs * 2 + theme.spacing.xl + theme.spacing.sm
        }
        progressiveBlurTopOffset={0}
        progressiveBlur
      >
        <View style={styles.header}>{header}</View>
        <View
          style={[
            styles.modeSelection,
            { gap: theme.spacing.sm, marginTop: theme.spacing.md * 2 - theme.spacing.xs / 2 },
          ]}
        >
          <View style={[styles.widgetRow, { gap: theme.spacing.sm }]}>
            <PremiumCard
              accessibilityLabel="Abrir Registrar Entrega"
              onPress={handleOpenRegistrarEntrega}
              style={[
                styles.widgetCard,
                { borderRadius: theme.radius.xl + theme.spacing.sm, padding: theme.spacing.lg },
              ]}
            >
              <View style={styles.widgetHeader}>
                <Ionicons
                  color={theme.colors.textSecondary}
                  name="cube-outline"
                  size={theme.sizes.iconMedium}
                />
                <Ionicons
                  color={theme.colors.textSecondary}
                  name="chevron-forward"
                  size={theme.sizes.iconMedium}
                />
              </View>
              <View
                style={[styles.widgetCopy, { minHeight: theme.typography.headline.lineHeight * 2 }]}
              >
                <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
                  Registrar Entrega
                </Text>
              </View>
            </PremiumCard>
            <PremiumCard
              accessibilityLabel="Abrir Registrar Dados"
              onPress={handleOpenRegistrarDados}
              style={[
                styles.widgetCard,
                { borderRadius: theme.radius.xl + theme.spacing.sm, padding: theme.spacing.lg },
              ]}
            >
              <View style={styles.widgetHeader}>
                <Ionicons
                  color={theme.colors.textSecondary}
                  name="calendar-outline"
                  size={theme.sizes.iconMedium}
                />
                <Ionicons
                  color={theme.colors.textSecondary}
                  name="chevron-forward"
                  size={theme.sizes.iconMedium}
                />
              </View>
              <View
                style={[styles.widgetCopy, { minHeight: theme.typography.headline.lineHeight * 2 }]}
              >
                <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
                  Registrar Dados
                </Text>
              </View>
            </PremiumCard>
          </View>
        </View>
      </PremiumScreen>
    </View>
  );
}

export function RegistrarDailyDataScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { resolvedMode, theme } = useAppTheme();
  const [isDeleting, setIsDeleting] = useState(false);
  const { addFieldValue, deleteDailyData, getLatestDailyValue, getValues, setFieldValue } =
    useCostSettings();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [dailySheetInitialValues, setDailySheetInitialValues] = useState(EMPTY_DAILY_DATA_VALUES);
  const dailyDate = todayIso();
  const dailyValues = useMemo(
    () => getValues('day', dailyDate) ?? EMPTY_DAILY_DATA_VALUES,
    [dailyDate, getValues],
  );
  const totalKilometers = dailyValues.kilometers ? Number(dailyValues.kilometers) : 0;
  const hasDailyData = useMemo(
    () =>
      Boolean(
        dailyValues.estar ||
        dailyValues.fuelPrice ||
        dailyValues.kilometers ||
        dailyValues.other ||
        totalKilometers > 0,
      ),
    [dailyValues, totalKilometers],
  );

  const handleDailyDataSubmit = useCallback(
    async (values: NativeDailyDataValues) => {
      await Promise.all([
        addFieldValue('day', dailyDate, 'estar', values.estar),
        addFieldValue('day', dailyDate, 'other', values.other),
        addFieldValue('day', dailyDate, 'kilometers', values.kilometers),
        setFieldValue('day', dailyDate, 'fuelPrice', values.fuelPrice),
      ]);
    },
    [addFieldValue, setFieldValue, dailyDate],
  );

  const handleDeleteDailyData = useCallback(async () => {
    if (isDeleting) return;

    setIsDeleting(true);
    triggerLightImpactHaptic();
    try {
      await deleteDailyData(dailyDate);
    } finally {
      setIsDeleting(false);
    }
  }, [dailyDate, deleteDailyData, isDeleting]);

  const openDailyDataSheet = useCallback(() => {
    triggerLightImpactHaptic();
    setDailySheetInitialValues({
      ...EMPTY_DAILY_DATA_VALUES,
      fuelPrice: getLatestDailyValue('fuelPrice'),
    });
    setSheetVisible(true);
  }, [getLatestDailyValue]);

  const header = (
    <NativeGlassHeader
      leftActions={
        <View style={styles.headerLeadingActions}>
          <NativeGlassBackButton
            accessibilityLabel="Voltar para Registrar"
            color={theme.colors.textPrimary}
            containerSize={theme.sizes.touchTargetMinimum}
            onPress={onBack}
            size={theme.sizes.iconMedium}
          />
        </View>
      }
      mode="transparent"
      rightActions={<View style={styles.headerTrailingActions} />}
      title={'Dados Diários'}
    />
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <PremiumScreen
        contentContainerStyle={styles.dailyDataContent}
        overlayHeader={header}
        progressiveBlur
      >
        {hasDailyData ? (
          <View style={[styles.dailyDataList, { gap: theme.spacing.sm }]}>
            <NativeCardContextMenu
              actions={[
                {
                  destructive: true,
                  disabled: isDeleting,
                  id: 'delete-daily-data',
                  onPress: () => {
                    void handleDeleteDailyData();
                  },
                  systemImage: 'trash',
                  title: 'Excluir',
                },
              ]}
              style={[
                styles.dailyDataContextWrapper,
                { borderRadius: theme.radius.xl + theme.spacing.sm },
              ]}
            >
              <PremiumCard
                style={[
                  styles.dailyDataCard,
                  {
                    backgroundColor:
                      resolvedMode === 'dark' ? theme.colors.surfaceElevated : '#FFFFFF',
                    borderRadius: theme.radius.xl + theme.spacing.sm,
                    width: '100%',
                  },
                ]}
              >
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  {formatDeliveryDate(dailyDate)}
                </Text>
                <View style={styles.dailyDataRows}>
                  <DailyDataRow label="Estar" value={formatStoredCost(dailyValues.estar)} />
                  <DailyDataRow label="Outros" value={formatStoredCost(dailyValues.other)} />
                  <DailyDataRow
                    label="Km"
                    value={`${formatStoredNumber(String(totalKilometers))} km`}
                  />
                  <DailyDataRow
                    label="Preço do combustível"
                    value={formatStoredCost(dailyValues.fuelPrice)}
                  />
                </View>
              </PremiumCard>
            </NativeCardContextMenu>
          </View>
        ) : null}
      </PremiumScreen>
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <View
          style={[
            styles.floatingAdd,
            {
              bottom: Math.max(0, insets.bottom - theme.spacing.xs),
            },
          ]}
        >
          <NativeGlassIconButton
            accessibilityLabel="Adicionar dados diÃ¡rios"
            color={theme.colors.textPrimary}
            containerSize={56}
            containerWidth={116}
            interactiveGlass
            label="Adicionar"
            onPress={openDailyDataSheet}
            shape="capsule"
          />
        </View>
      </View>
      <NativeDailyDataSheet
        initialValues={dailySheetInitialValues}
        onSubmit={handleDailyDataSubmit}
        onVisibleChange={setSheetVisible}
        visible={sheetVisible}
      />
    </View>
  );
}

export function RegistrarDeliveryScreen({ onBack }: { onBack: () => void }) {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [selectedClient, setSelectedClient] = useState<NativeBottomSheetItem | null>(null);
  const dark = colorScheme === 'dark';
  const { clients } = useClients();
  const clientItems = useMemo<NativeBottomSheetItem[]>(
    () =>
      clients.map((client) => ({
        bucketPrice: client.currentPrice,
        id: client.clientId,
        title: client.canonicalName,
        systemImage: 'person.crop.circle.fill',
      })),
    [clients],
  );
  const [currentDate, setCurrentDate] = useState(() => todayIso());
  const {
    deliveries: firestoreDeliveries,
    create,
    remove: removeDelivery,
  } = useDeliveries({
    mode: 'today',
    date: currentDate,
  });
  const deliveries = useMemo(
    () => firestoreDeliveries.map(toHistoryDelivery),
    [firestoreDeliveries],
  );
  useFocusEffect(
    useCallback(() => {
      setCurrentDate(todayIso());

      const refreshDate = setInterval(() => setCurrentDate(todayIso()), 60_000);
      return () => clearInterval(refreshDate);
    }, []),
  );
  const todayDeliveries = useMemo(
    () => deliveries.filter((delivery) => delivery.data === currentDate),
    [currentDate, deliveries],
  );
  const openSheet = () => {
    triggerLightImpactHaptic();
    setSelectedClient(null);
    setSheetVisible(true);
  };
  const handleConfirm = (confirmation: NativeBottomSheetConfirmation) => {
    const currentClient = clients.find((client) => client.clientId === confirmation.client.id);
    if (!currentClient?.clientId || !currentClient.address) return;
    const bucketPrice = currentClient.currentPrice ?? confirmation.bucketPrice;
    void create({
      address: currentClient.address,
      addressConfirmed: true,
      clientId: currentClient.clientId,
      clientName: confirmation.client.title,
      date: todayIso(confirmation.date),
      delivered: false,
      invoiceStatus: 'a_emitir',
      quantity: confirmation.quantity,
      status: 'Não Pago',
      value: bucketPrice * confirmation.quantity,
      valueWasManuallyChanged: false,
      historicalUnitPrice: bucketPrice,
    });
    setSheetVisible(false);
  };
  const handleSelectClient = useCallback(
    (item: NativeBottomSheetItem) => {
      const currentClient = clients.find((client) => client.clientId === item.id);
      setSelectedClient({
        ...item,
        bucketPrice: currentClient?.currentPrice ?? item.bucketPrice,
      });
    },
    [clients],
  );
  const handleSheetVisibleChange = useCallback((visible: boolean) => {
    setSheetVisible(visible);
    if (!visible) setSelectedClient(null);
  }, []);

  const header = (
    <NativeGlassHeader
      includeTopSafeArea
      leftActions={
        <View style={styles.deliveryHeaderLeadingActions}>
          <NativeGlassBackButton
            accessibilityLabel="Voltar para Registrar"
            color={dark ? '#FFFFFF' : '#000000'}
            containerSize={44}
            onPress={onBack}
            size={20}
          />
        </View>
      }
      mode="transparent"
      pointerEvents="box-none"
      title="Entregas"
    />
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <PremiumScreen
        contentContainerStyle={{
          paddingBottom: theme.layout.tabBarHeight + insets.bottom + theme.spacing.xl,
          paddingHorizontal: 0,
        }}
        overlayHeader={header}
        progressiveBlur
      >
        <View style={[styles.deliveryList, { gap: theme.spacing.sm }]}>
          {todayDeliveries.length > 0 ? (
            <PremiumCard
              style={[
                styles.deliveryCard,
                {
                  borderRadius: theme.radius.xl + theme.spacing.xl,
                  padding: theme.spacing.md,
                  position: 'relative',
                },
              ]}
            >
              <Text
                style={[
                  theme.typography.headline,
                  styles.deliveryDayTitle,
                  { color: theme.colors.textPrimary },
                ]}
              >
                Hoje
              </Text>
              <View
                style={[
                  styles.todayDeliveriesGroup,
                  { gap: theme.spacing.xs, marginTop: theme.spacing.xl },
                ]}
              >
                {[...todayDeliveries].reverse().map((delivery) => (
                  <NativeCardContextMenu
                    actions={[
                      {
                        destructive: true,
                        id: 'delete-delivery',
                        onPress: () => {
                          void removeDelivery(delivery.id);
                        },
                        systemImage: 'trash',
                        title: 'Excluir',
                      },
                    ]}
                    key={delivery.id}
                    style={[
                      styles.deliveryContextMenu,
                      { borderRadius: theme.radius.xl + theme.spacing.sm },
                    ]}
                  >
                    <View
                      style={[
                        styles.deliveryItemRow,
                        {
                          backgroundColor: theme.colors.surface,
                          borderRadius: theme.radius.xl + theme.spacing.sm,
                          paddingHorizontal: theme.spacing.md,
                          paddingVertical: theme.spacing.sm + theme.spacing.xs,
                          width: '100%',
                        },
                      ]}
                    >
                      <View style={styles.deliveryItemCopy}>
                        <Text
                          style={[
                            theme.typography.callout,
                            { color: theme.colors.textPrimary, fontWeight: '700' },
                          ]}
                        >
                          {delivery.cliente}
                        </Text>
                        <Text
                          style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}
                        >
                          {`${delivery.quantidadeBaldes} ${delivery.quantidadeBaldes === 1 ? 'balde' : 'baldes'}`}
                        </Text>
                      </View>
                      <Text
                        style={[
                          theme.typography.body,
                          { color: theme.colors.textPrimary, fontWeight: '600' },
                        ]}
                      >
                        {delivery.valor}
                      </Text>
                    </View>
                  </NativeCardContextMenu>
                ))}
              </View>
            </PremiumCard>
          ) : null}
        </View>
      </PremiumScreen>
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <View
          style={[
            styles.floatingAdd,
            {
              bottom: Math.max(0, insets.bottom - theme.spacing.xs),
            },
          ]}
        >
          <NativeGlassIconButton
            accessibilityLabel="Adicionar entrega"
            color={dark ? '#FFFFFF' : '#000000'}
            containerSize={56}
            containerWidth={116}
            interactiveGlass
            label="Adicionar"
            onPress={openSheet}
            shape="capsule"
          />
        </View>
      </View>
      <NativeBottomSheet
        bucketPrice={BUCKET_PRICE}
        hostSizing="viewport"
        items={clientItems}
        onConfirm={handleConfirm}
        onSelect={handleSelectClient}
        onVisibleChange={handleSheetVisibleChange}
        selectedItem={selectedClient}
        title="Adicionar entrega"
        titleSystemImage="plus"
        subtitle="Escolha o cliente"
        visible={sheetVisible}
      />
    </View>
  );
}

function formatDeliveryDate(value: string) {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function formatStoredCost(value: string): string {
  return formatCurrency(normalizeMoney(value) ?? 0);
}

function formatStoredNumber(value: string): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(
    normalizeMoney(value) ?? 0,
  );
}

function DailyDataRow({ label, value }: { label: string; value: string }) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.dailyDataRow}>
      <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>{label}</Text>
      <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { minHeight: 44 },
  modeSelectionContent: { flexGrow: 1 },
  modeSelection: { flex: 1 },
  widgetRow: { alignSelf: 'flex-start', flexDirection: 'row' },
  widgetCard: { width: 178 },
  widgetHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  widgetCopy: { gap: 8, marginTop: 12 },
  dailyDataContent: { flexGrow: 1 },
  floatingAdd: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  dailyDataList: { paddingHorizontal: 16, paddingTop: 28 },
  dailyDataContextWrapper: { width: '100%' },
  dailyDataCard: { gap: 16 },
  dailyDataRows: { gap: 12 },
  dailyDataRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headerLeadingActions: { alignItems: 'flex-start', width: 104 },
  headerTrailingActions: { width: 104 },
  deliveryHeaderLeadingActions: { alignItems: 'flex-start', width: 44 },
  deliveryList: { paddingHorizontal: 16, paddingTop: 28 },
  deliveryCard: { gap: 8, overflow: 'hidden' },
  deliveryDayTitle: { left: 0, position: 'absolute', right: 0, textAlign: 'center', top: 8 },
  todayDeliveriesGroup: { width: '100%' },
  deliveryContextMenu: { width: '100%' },
  deliveryItemRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  deliveryItemCopy: { flex: 1, gap: 2 },
});
