import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useMemo, useSyncExternalStore, useState } from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NativeGlassHeader } from '@/components/layout';
import {
  NativeBottomSheet,
  NativeDailyDataSheet,
  NativeGlassBackButton,
  NativeGlassIconButton,
  NativeSwipeActionsList,
} from '@/components/native';
import type {
  NativeBottomSheetItem,
  NativeDailyDataValues,
  NativeSwipeActionsListItem,
} from '@/components/native';
import { PremiumCard, PremiumScreen } from '@/components/premium';
import { useClients } from '@/hooks/useClients';
import { useCostSettings } from '@/hooks/useCostSettings';
import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { formatCurrency, normalizeMoney, todayIso } from '@/utils/data';
import {
  addHistoryDelivery,
  getAddedHistoryDeliveries,
  subscribeToAddedHistoryDeliveries,
  removeAddedHistoryDeliveries,
} from '@/features/history/data/historyDeliveryStore';

const BUCKET_PRICE = 49.8;

export default function PrototypeRegistrar() {
  return <RegistrarModeSelection />;
}

function RegistrarModeSelection() {
  const { theme } = useAppTheme();
  const router = useRouter();

  const header = <NativeGlassHeader mode="transparent" title="Registrar" />;

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <PremiumScreen
        contentContainerStyle={styles.modeSelectionContent}
        overlayHeader={header}
        progressiveBlur
      >
        <View
          style={[
            styles.modeSelection,
            { gap: theme.spacing.sm, marginTop: theme.spacing.md * 2 - theme.spacing.xs / 2 },
          ]}
        >
          <View style={[styles.widgetRow, { gap: theme.spacing.sm }]}>
            <PremiumCard
              accessibilityLabel="Abrir Registrar Entrega"
              onPress={() => router.push('/registrar-entrega')}
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
              <View style={styles.widgetCopy}>
                <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
                  Registrar Entrega
                </Text>
              </View>
            </PremiumCard>
            <PremiumCard
              accessibilityLabel="Abrir Registrar Dados DiÃ¡rios"
              onPress={() => router.push('/registrar-dados-diarios')}
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
              <View style={styles.widgetCopy}>
                <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
                  {'Registrar Dados Di\u00e1rios'}
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
  const { theme } = useAppTheme();
  const { getValues, updateField } = useCostSettings();
  const [sheetVisible, setSheetVisible] = useState(false);
  const dailyDate = todayIso();
  const dailyValues = getValues('day', dailyDate);
  const hasDailyData = Boolean(dailyValues.estar.trim() || dailyValues.other.trim());

  const handleDailyDataSubmit = useCallback(
    (values: NativeDailyDataValues) => {
      const date = todayIso();
      updateField('day', date, 'estar', values.estar);
      updateField('day', date, 'other', values.other);
    },
    [updateField],
  );

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
      rightActions={
        <View style={styles.headerTrailingActions}>
          <NativeGlassIconButton
            accessibilityLabel="Mais opÃ§Ãµes de dados diÃ¡rios"
            color={theme.colors.textPrimary}
            containerSize={44}
            fallbackIcon="ellipsis-horizontal"
            interactiveGlass
            onPress={() => undefined}
            size={20}
            systemImage="ellipsis"
          />
        </View>
      }
      title={'Dados Di\u00e1rios'}
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
            <PremiumCard
              style={[styles.dailyDataCard, { borderRadius: theme.radius.xl + theme.spacing.sm }]}
            >
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                {formatDeliveryDate(dailyDate)}
              </Text>
              <View style={styles.dailyDataRows}>
                <DailyDataRow label="Estar" value={formatStoredCost(dailyValues.estar)} />
                <DailyDataRow label="Outros" value={formatStoredCost(dailyValues.other)} />
              </View>
            </PremiumCard>
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
            onPress={() => setSheetVisible(true)}
            shape="capsule"
          />
        </View>
      </View>
      <NativeDailyDataSheet
        initialValues={{ estar: dailyValues.estar, other: dailyValues.other }}
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
  const deliveries = useSyncExternalStore(
    subscribeToAddedHistoryDeliveries,
    getAddedHistoryDeliveries,
    getAddedHistoryDeliveries,
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
  const handleConfirm = (confirmation: Parameters<typeof addHistoryDelivery>[0]) => {
    addHistoryDelivery(confirmation);
    setSheetVisible(false);
  };
  const handleDeleteBySwipe = useCallback((deliveryId: string) => {
    triggerLightImpactHaptic();
    removeAddedHistoryDeliveries(new Set([deliveryId]));
  }, []);
  const handleSelectClient = useCallback((item: NativeBottomSheetItem) => {
    setSelectedClient(item);
  }, []);
  const handleSheetVisibleChange = useCallback((visible: boolean) => {
    setSheetVisible(visible);
    if (!visible) setSelectedClient(null);
  }, []);
  const nativeDeliveryItems = useMemo<NativeSwipeActionsListItem[]>(
    () =>
      [...todayDeliveries].reverse().map((delivery) => ({
        id: delivery.id,
        overline: formatDeliveryDate(delivery.data),
        subtitle: `${delivery.quantidadeBaldes} ${delivery.quantidadeBaldes === 1 ? 'balde' : 'baldes'}`,
        title: delivery.cliente,
        trailingText: delivery.valor,
      })),
    [todayDeliveries],
  );

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
              style={[styles.deliveryCard, { borderRadius: theme.radius.xl + theme.spacing.sm }]}
            >
              <NativeSwipeActionsList
                colors={{
                  border: theme.colors.borderStrong,
                  selectionContent: theme.colors.selectionContent,
                  selectionSurface: theme.colors.selectionSurface,
                  textPrimary: theme.colors.textPrimary,
                  textSecondary: theme.colors.textSecondary,
                }}
                items={nativeDeliveryItems}
                onDelete={handleDeleteBySwipe}
                trailingValueAlignment="top"
              />
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
  dailyDataCard: { gap: 16 },
  dailyDataRows: { gap: 12 },
  dailyDataRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headerLeadingActions: { alignItems: 'flex-start', width: 104 },
  headerTrailingActions: { alignItems: 'flex-end', width: 104 },
  deliveryHeaderLeadingActions: { alignItems: 'flex-start', width: 44 },
  deliveryList: { paddingHorizontal: 16, paddingTop: 28 },
  deliveryCard: { gap: 8 },
});
