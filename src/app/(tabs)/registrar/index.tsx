import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import type { SFSymbol } from 'sf-symbols-typescript';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import { NativeGlassHeader } from '@/components/layout';
import {
  NativeBottomSheet,
  NativeCardContextMenu,
  NativeDailyDataSheet,
  NativeGlassIconButton,
} from '@/components/native';
import type {
  NativeBottomSheetConfirmation,
  NativeBottomSheetItem,
  NativeDailyDataValues,
} from '@/components/native';
import { PremiumCard, PremiumScreen } from '@/components/premium';
import { useAppSafeAreaInsets } from '@/providers';
import { useClients } from '@/hooks/useClients';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useCostSettings } from '@/hooks/useCostSettings';
import { getLiquidGlassTint, useAppTheme } from '@/theme';
import { triggerLightImpactHaptic, triggerSelectionHaptic } from '@/utils/haptics';
import { formatCurrency, normalizeMoney, todayIso } from '@/utils/data';
import { toHistoryDelivery } from '@/services/data';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';
import type { Delivery } from '@/types/data';

const BUCKET_PRICE = 49.8;
const DELIVERY_CARD_GROWTH_DURATION = 200;

type DeliverySortMode = 'latest' | 'alphabetical' | 'quantity';

function sortDeliveryRecords(
  deliveries: readonly Delivery[],
  date: string,
  sortMode: DeliverySortMode,
  recentlyAddedDeliveryIds: readonly string[],
): Delivery[] {
  const recentOrder = new Map(
    recentlyAddedDeliveryIds.map((deliveryId, index) => [deliveryId, index]),
  );

  return deliveries
    .map((delivery, index) => ({ delivery, index }))
    .filter(({ delivery }) => delivery.data === date)
    .sort((left, right) => {
      if (sortMode === 'alphabetical') {
        return (
          left.delivery.cliente.localeCompare(right.delivery.cliente, 'pt-BR', {
            sensitivity: 'base',
          }) || left.index - right.index
        );
      }

      if (sortMode === 'quantity') {
        return right.delivery.quantidade - left.delivery.quantidade || left.index - right.index;
      }

      const leftRecent = recentOrder.get(left.delivery.id);
      const rightRecent = recentOrder.get(right.delivery.id);
      if (leftRecent !== undefined || rightRecent !== undefined) {
        if (leftRecent === undefined) return 1;
        if (rightRecent === undefined) return -1;
        if (leftRecent !== rightRecent) return leftRecent - rightRecent;
      }

      const leftCreatedAt = left.delivery.createdAt;
      const rightCreatedAt = right.delivery.createdAt;
      if (leftCreatedAt !== undefined || rightCreatedAt !== undefined) {
        if (leftCreatedAt === undefined) return 1;
        if (rightCreatedAt === undefined) return -1;
        if (leftCreatedAt !== rightCreatedAt) return rightCreatedAt - leftCreatedAt;
      }

      return left.index - right.index;
    })
    .map(({ delivery }) => delivery);
}

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
    router.push('/registrar/entrega');
  };

  const handleOpenRegistrarDados = () => {
    triggerLightImpactHaptic();
    router.push('/registrar/dados');
  };

  const header = (
    <NativeGlassHeader
      includeTopSafeArea={false}
      largeTitle
      mode="transparent"
      titleStyle={{
        fontFamily: 'System',
        fontSize: 36,
        fontWeight: '700',
        marginLeft: -(theme.spacing.xxs * 2),
      }}
      title="Registrar"
    />
  );
  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <PremiumScreen
        contentContainerStyle={[
          styles.modeSelectionContent,
          { marginTop: theme.spacing.xxxl + theme.spacing.xl + 2 },
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

export function RegistrarDailyDataScreen() {
  const insets = useAppSafeAreaInsets();
  const { resolvedMode, theme } = useAppTheme();
  const { enabled: testModeEnabled, text: maskText } = useTestModePresentation();
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
  const dailyDataCardMinHeight =
    theme.spacing.lg * 2 +
    theme.typography.caption.lineHeight +
    theme.spacing.md +
    theme.typography.body.lineHeight * 4 +
    theme.spacing.sm * 3;

  const handleDailyDataSubmit = useCallback(
    async (values: NativeDailyDataValues) => {
      if (testModeEnabled) return;
      await Promise.all([
        addFieldValue('day', dailyDate, 'estar', values.estar),
        addFieldValue('day', dailyDate, 'other', values.other),
        addFieldValue('day', dailyDate, 'kilometers', values.kilometers),
        setFieldValue('day', dailyDate, 'fuelPrice', values.fuelPrice),
      ]);
    },
    [addFieldValue, dailyDate, setFieldValue, testModeEnabled],
  );

  const handleDeleteDailyData = useCallback(async () => {
    if (isDeleting || testModeEnabled) return;

    setIsDeleting(true);
    triggerLightImpactHaptic();
    try {
      await deleteDailyData(dailyDate);
    } finally {
      setIsDeleting(false);
    }
  }, [dailyDate, deleteDailyData, isDeleting, testModeEnabled]);

  const openDailyDataSheet = useCallback(() => {
    triggerLightImpactHaptic();
    setDailySheetInitialValues({
      ...EMPTY_DAILY_DATA_VALUES,
      fuelPrice: getLatestDailyValue('fuelPrice') || '6,59',
    });
    setSheetVisible(true);
  }, [getLatestDailyValue]);

  const header = (
    <NativeGlassHeader
      mode="transparent"
      rightActions={<View style={styles.headerTrailingActions} />}
      title={'Dados Diários'}
    />
  );
  const renderDailyDataContent = () => (
    <>
      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
        {formatDeliveryDate(dailyDate)}
      </Text>
      <View style={styles.dailyDataRows}>
        <DailyDataRow label="Estar" value={maskText(formatStoredCost(dailyValues.estar))} />
        <DailyDataRow label="Outros" value={maskText(formatStoredCost(dailyValues.other))} />
        <DailyDataRow
          label="Km"
          value={maskText(`${formatStoredNumber(String(totalKilometers))} km`)}
        />
        <DailyDataRow
          label="Preço do combustível"
          value={maskText(formatStoredCost(dailyValues.fuelPrice))}
        />
      </View>
    </>
  );
  const dailyDataPreview = (
    <View
      style={[
        styles.dailyDataCard,
        {
          backgroundColor: resolvedMode === 'dark' ? theme.colors.surfaceElevated : theme.colors.surface,
          borderRadius: theme.radius.xl + theme.spacing.sm,
          overflow: 'hidden',
          padding: theme.spacing.lg,
          width: '100%',
        },
      ]}
    >
      {renderDailyDataContent()}
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <PremiumScreen
        contentContainerStyle={[styles.dailyDataContent, { paddingHorizontal: 0 }]}
        overlayHeader={header}
        progressiveBlur
      >
        <View style={[styles.dailyDataList, { gap: theme.spacing.sm }]}>
          <Animated.View style={styles.fullWidth}>
            <View
              style={[
                styles.dailyDataContextWrapper,
                {
                  backgroundColor:
                    resolvedMode === 'dark' ? theme.colors.surfaceElevated : theme.colors.surface,
                  borderRadius: hasDailyData
                    ? theme.radius.xl + theme.spacing.sm
                    : theme.radius.xl + theme.spacing.lg,
                  height: dailyDataCardMinHeight,
                  minHeight: dailyDataCardMinHeight,
                  overflow: 'hidden',
                  width: '100%',
                },
                resolvedMode === 'dark' ? theme.shadows.none : theme.shadows.card,
              ]}
            >
            <NativeCardContextMenu
              actions={
                hasDailyData
                  ? [
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
                    ]
                  : []
              }
              style={[
                styles.dailyDataContextWrapper,
                {
                  borderRadius: hasDailyData
                    ? theme.radius.xl + theme.spacing.sm
                    : theme.radius.xl + theme.spacing.lg,
                  height: dailyDataCardMinHeight,
                },
              ]}
              preview={dailyDataPreview}
            >
              <Animated.View style={styles.fullWidth}>
                {hasDailyData ? (
                  <Animated.View entering={FadeIn.duration(theme.animations.duration.fast)}>
                    <View
                      style={[
                        styles.dailyDataCard,
                        {
                          backgroundColor: 'transparent',
                          borderRadius: theme.radius.xl + theme.spacing.sm,
                          padding: theme.spacing.lg,
                          width: '100%',
                        },
                      ]}
                    >
                      {renderDailyDataContent()}
                    </View>
                  </Animated.View>
                ) : (
                  <View
                    style={[
                      styles.emptyStateCard,
                      {
                        minHeight: dailyDataCardMinHeight,
                        paddingVertical: theme.spacing.xxl * 2,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        theme.typography.body,
                        { color: theme.colors.textSecondary, textAlign: 'center' },
                      ]}
                    >
                      Nenhum dado hoje
                    </Text>
                  </View>
                )}
              </Animated.View>
              </NativeCardContextMenu>
            </View>
          </Animated.View>
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
            accessibilityLabel="Adicionar dados diÃ¡rios"
            color={theme.colors.textPrimary}
            containerSize={56}
            containerWidth={116}
            glassTint={getLiquidGlassTint(resolvedMode)}
            interactiveGlass
            label="Adicionar"
            labelSize={18}
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

export function RegistrarDeliveryScreen() {
  const colorScheme = useColorScheme();
  const insets = useAppSafeAreaInsets();
  const { resolvedMode, theme } = useAppTheme();
  const { quantity: maskQuantity, text: maskText, enabled: testModeEnabled } =
    useTestModePresentation();
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
  const [deliverySortMode, setDeliverySortMode] = useState<DeliverySortMode>('latest');
  const [recentlyAddedDeliveryIds, setRecentlyAddedDeliveryIds] = useState<readonly string[]>([]);
  const {
    allDeliveries: sourceDeliveries,
    create,
    remove: removeDelivery,
  } = useDeliveries({
    mode: 'today',
    date: currentDate,
  });
  useFocusEffect(
    useCallback(() => {
      setCurrentDate(todayIso());

      const refreshDate = setInterval(() => setCurrentDate(todayIso()), 60_000);
      return () => clearInterval(refreshDate);
    }, []),
  );
  const todayDeliveries = useMemo(
    () =>
      sortDeliveryRecords(
        sourceDeliveries,
        currentDate,
        deliverySortMode,
        recentlyAddedDeliveryIds,
      ).map(toHistoryDelivery),
    [currentDate, deliverySortMode, recentlyAddedDeliveryIds, sourceDeliveries],
  );
  const emptyDeliveryCardMinHeight =
    theme.spacing.xxl * 4 + theme.typography.body.lineHeight;
  const deliveryRowHeight =
    (theme.spacing.sm + theme.spacing.xs) * 2 +
    Math.max(
      theme.typography.body.lineHeight,
      theme.typography.callout.lineHeight + theme.typography.footnote.lineHeight + 2,
    );
  const deliveryCardContentHeight =
    theme.typography.headline.lineHeight -
    theme.spacing.xs +
    todayDeliveries.length * deliveryRowHeight +
    Math.max(0, todayDeliveries.length - 1) * theme.spacing.xs;
  const deliveryCardHeight =
    todayDeliveries.length <= 1
      ? emptyDeliveryCardMinHeight
      : theme.spacing.md * 2 + deliveryCardContentHeight;
  const deliveryCardHeightValue = useDerivedValue(
    () =>
      withTiming(deliveryCardHeight, {
        duration: DELIVERY_CARD_GROWTH_DURATION,
        easing: Easing.out(Easing.quad),
      }),
    [deliveryCardHeight],
  );
  const deliveryCardAnimatedStyle = useAnimatedStyle(() => ({
    height: deliveryCardHeightValue.value,
  }));

  const openSheet = () => {
    triggerLightImpactHaptic();
    setSelectedClient(null);
    setSheetVisible(true);
  };
  const handleConfirm = (confirmation: NativeBottomSheetConfirmation) => {
    if (testModeEnabled) return;
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
    }).then((created) => {
      setRecentlyAddedDeliveryIds((current) => [
        created.id,
        ...current.filter((deliveryId) => deliveryId !== created.id),
      ]);
    }).catch(() => undefined);
    setSheetVisible(false);
  };

  const handleDeliverySortChange = useCallback((sortMode: DeliverySortMode) => {
    triggerSelectionHaptic();
    setDeliverySortMode(sortMode);
  }, []);
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
  const handleSheetPageSettled = useCallback((page: number) => {
    if (page === 0) setSelectedClient(null);
  }, []);

  const header = (
    <NativeGlassHeader
      includeTopSafeArea
      mode="transparent"
      pointerEvents="box-none"
      title="Entregas"
    />
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <RegistrarDeliveryToolbar
        onSortChange={handleDeliverySortChange}
        sortMode={deliverySortMode}
      />
      <PremiumScreen
        contentContainerStyle={{
          paddingBottom: theme.layout.tabBarHeight + insets.bottom + theme.spacing.xl,
          paddingHorizontal: 0,
        }}
        overlayHeader={header}
        progressiveBlur
      >
        <View style={[styles.deliveryList, { gap: theme.spacing.sm }]}>
          <Animated.View style={[styles.fullWidth, deliveryCardAnimatedStyle]}>
            <PremiumCard
              style={[
                styles.deliveryCard,
                {
                  height: '100%',
                },
                todayDeliveries.length > 0
                  ? {
                      borderRadius: theme.radius.xl + theme.spacing.lg,
                      padding: theme.spacing.md,
                      position: 'relative',
                    }
                  : {
                      borderRadius: theme.radius.xl + theme.spacing.lg,
                      paddingVertical: theme.spacing.xxl * 2,
                    },
              ]}
            >
            <Animated.View style={[styles.fullWidth, styles.deliveryContent]}>
              {todayDeliveries.length > 0 ? (
                <>
                  <View
                    style={[
                      styles.deliveryTitleSlot,
                      {
                        height: theme.typography.headline.lineHeight,
                        marginTop: -theme.spacing.xs,
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
                  </View>
                  <View style={[styles.fullWidth, styles.deliveryContentViewport]}>
                  <View
                    style={[
                      styles.todayDeliveriesGroup,
                      { gap: theme.spacing.xs },
                    ]}
                  >
                    {todayDeliveries.map((delivery) => {
                      const renderDeliveryItemRow = (preview = false) => (
                        <View style={[
                            styles.deliveryItemRow,
                            {
                              backgroundColor: preview
                                ? theme.colors.surface
                                : 'transparent',
                              borderRadius: theme.radius.xl + theme.spacing.sm,
                              height: deliveryRowHeight,
                              overflow: preview ? 'hidden' : undefined,
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
                              style={[
                                theme.typography.footnote,
                                { color: theme.colors.textSecondary },
                              ]}
                            >
                              {maskQuantity(delivery.quantidadeBaldes)}
                            </Text>
                          </View>
                          <Text
                            style={[
                              theme.typography.body,
                              { color: theme.colors.textPrimary, fontWeight: '600' },
                            ]}
                          >
                            {maskText(delivery.valor)}
                          </Text>
                        </View>
                      );
                      const rowContent = renderDeliveryItemRow();
                      const rowActions = [
                        {
                          destructive: true,
                          disabled: testModeEnabled,
                          id: 'delete-delivery',
                          onPress: () => {
                            void removeDelivery(delivery.id);
                          },
                          systemImage: 'trash' as const,
                          title: 'Excluir',
                        },
                      ];

                      return (
                        <View
                          key={delivery.id}
                          style={[
                            styles.deliveryContextMenu,
                            {
                              backgroundColor: theme.colors.surface,
                              borderRadius: theme.radius.xl + theme.spacing.sm,
                              height: deliveryRowHeight,
                              overflow: 'hidden',
                              width: '100%',
                            },
                          ]}
                        >
                          <NativeCardContextMenu
                            actions={rowActions}
                            preview={renderDeliveryItemRow(true)}
                            style={[
                              styles.deliveryContextMenu,
                              {
                                borderRadius: theme.radius.xl + theme.spacing.sm,
                                height: '100%',
                                width: '100%',
                              },
                            ]}
                          >
                            {rowContent}
                          </NativeCardContextMenu>
                        </View>
                      );
                    })}
                  </View>
                  </View>
                </>
              ) : (
                <View style={styles.emptyStateCard}>
                  <Text
                    style={[
                      theme.typography.body,
                      { color: theme.colors.textSecondary, textAlign: 'center' },
                    ]}
                  >
                    Nenhuma entrega hoje
                  </Text>
                </View>
              )}
            </Animated.View>
            </PremiumCard>
          </Animated.View>
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
            glassTint={getLiquidGlassTint(resolvedMode)}
            interactiveGlass
            label="Adicionar"
            labelSize={18}
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
        onPageSettled={handleSheetPageSettled}
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

function RegistrarDeliveryToolbar({
  onSortChange,
  sortMode,
}: {
  onSortChange: (sortMode: DeliverySortMode) => void;
  sortMode: DeliverySortMode;
}) {
  const { theme } = useAppTheme();

  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Menu
        accessibilityLabel="Ordenar entregas"
        icon="line.3.horizontal.decrease"
        separateBackground={false}
        title="Ordenar entregas"
        tintColor={theme.colors.textPrimary}
      >
        <Stack.Toolbar.MenuAction
          icon={'clock.arrow.circlepath' as SFSymbol}
          isOn={sortMode === 'latest'}
          onPress={() => onSortChange('latest')}
        >
          Recentes
        </Stack.Toolbar.MenuAction>
        <Stack.Toolbar.MenuAction
          icon={'textformat.abc' as SFSymbol}
          isOn={sortMode === 'alphabetical'}
          onPress={() => onSortChange('alphabetical')}
        >
          Ordem alfabética
        </Stack.Toolbar.MenuAction>
        <Stack.Toolbar.MenuAction
          icon={'chart.bar.fill' as SFSymbol}
          isOn={sortMode === 'quantity'}
          onPress={() => onSortChange('quantity')}
        >
          Quantidade de baldes
        </Stack.Toolbar.MenuAction>
      </Stack.Toolbar.Menu>
    </Stack.Toolbar>
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
  fullWidth: { width: '100%' },
  floatingAdd: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  dailyDataList: { paddingHorizontal: 16, paddingTop: 28 },
  emptyStateCard: { alignItems: 'center', justifyContent: 'center', width: '100%' },
  dailyDataContextWrapper: { width: '100%' },
  dailyDataCard: { gap: 16 },
  dailyDataRows: { gap: 12 },
  dailyDataRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headerTrailingActions: { width: 104 },
  deliveryList: { paddingHorizontal: 16, paddingTop: 28 },
  deliveryCard: { gap: 8, overflow: 'visible' },
  deliveryContent: { flex: 1 },
  deliveryContentViewport: { flex: 1, overflow: 'hidden' },
  deliveryTitleSlot: { alignItems: 'center', justifyContent: 'center', width: '100%' },
  deliveryDayTitle: { textAlign: 'center' },
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
