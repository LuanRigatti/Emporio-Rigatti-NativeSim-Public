import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import type { SFSymbol } from 'sf-symbols-typescript';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Keyboard, Platform, StyleSheet, Text, useColorScheme, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import { getNativeLargeTitleStyle, NativeGlassHeader } from '@/components/layout';
import {
  MeasuredContextMenuGeometry,
  type ContextMenuCardGeometryStyle,
} from '@/components/layout/MeasuredContextMenuGeometry';
import { ErrorState, InlineError, Loading } from '@/components/feedback';
import {
  NativeCardContextMenu,
  NativeDailyDataSheet,
  NativeGlassIconButton,
} from '@/components/native';
import type { NativeDailyDataValues } from '@/components/native';
import {
  AnimatedPressable,
  GlassSurface,
  PremiumCard,
  PremiumScreen,
  ProgressiveCollapsibleScreen,
  SearchBar,
} from '@/components/premium';
import { ListItem } from '@/components/lists';
import { StickyActionFooter } from '@/components/premium/StickyActionFooter';
import { RegistrarDeliverySheet } from '@/features/deliveries/components/RegistrarDeliverySheet';
import { useRegistrarDeliverySheet } from '@/features/deliveries/hooks/useRegistrarDeliverySheet';
import type { RegistrarDeliverySheetController } from '@/features/deliveries/hooks/useRegistrarDeliverySheet';
import { consumeRecentlyAddedRegistrarDeliveryIds } from '@/features/deliveries/utils/registrarDelivery';
import HomeShortcutCard from '@/features/home/components/HomeShortcutCard';
import { normalizeHomeSearchText } from '@/features/home/search/HomeSearchQueryParser';
import OpenPaymentClientIcon from '@/features/open-payments/components/OpenPaymentClientIcon';
import { RetailOrderRegistrarLauncher } from '@/features/retail-orders/components/RetailOrderRegistrarScreen';
import { useAppMode, useAppSafeAreaInsets } from '@/providers';
import { useClients } from '@/hooks/useClients';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useCostSettings } from '@/hooks/useCostSettings';
import { getCardSurfaceColor, getLiquidGlassTint, useAppTheme } from '@/theme';
import {
  APPROVED_DARK_SHEET_GLASS_TINT,
  APPROVED_LIGHT_SHEET_GLASS_TINT,
} from '@/theme/sheetGlassTints';
import { triggerLightImpactHaptic, triggerSelectionHaptic } from '@/utils/haptics';
import { formatCurrency, normalizeMoney, todayIso } from '@/utils/data';
import { toHistoryDelivery } from '@/services/data';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';
import { wholesaleDeliveryLiveActivityCoordinator } from '@/features/deliveries/liveActivity/LiveActivityCoordinator';
import { useLiveActivityCoordinatorState } from '@/features/deliveries/liveActivity/useLiveActivityCoordinator';
import type { Delivery } from '@/types/data';

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
  const { mode } = useAppMode();
  return mode === 'retail' ? <RetailOrderRegistrarLauncher /> : <RegistrarModeSelection />;
}

function RegistrarModeSelection() {
  const { theme } = useAppTheme();
  const insets = useAppSafeAreaInsets();
  const router = useRouter();

  const handleOpenRegistrarEntrega = () => {
    triggerLightImpactHaptic();
    router.push('/registrar-entrega');
  };

  const handleOpenRegistrarDados = () => {
    triggerLightImpactHaptic();
    router.push('/registrar-dados');
  };

  const header = (
    <NativeGlassHeader
      includeTopSafeArea={false}
      largeTitle
      mode="transparent"
      titleStyle={getNativeLargeTitleStyle(theme.spacing.xxs)}
      title="Registrar"
    />
  );
  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ProgressiveCollapsibleScreen
        compactTitle="Registrar"
        contentGap={0}
        contentTopInset={theme.spacing.xxxl + theme.spacing.xl + 2}
        largeTitle={<View style={styles.header}>{header}</View>}
        nativeTabRoot
        scrollContentContainerStyle={{
          paddingBottom: theme.layout.tabBarHeight + insets.bottom + theme.spacing.lg,
        }}
      >
        <View
          style={[
            styles.modeSelection,
            {
              marginTop: theme.spacing.md * 2 - theme.spacing.xs / 2 - 4,
            },
          ]}
        >
          <View style={[styles.modeOptions, { gap: theme.spacing.sm }]}>
            <HomeShortcutCard
              accessibilityLabel="Abrir Registrar Entrega"
              icon={<Ionicons color={theme.colors.textSecondary} name="cube-outline" size={21} />}
              label="Registrar Entrega"
              onPress={handleOpenRegistrarEntrega}
              trailing={
                <Ionicons
                  color={theme.colors.textSecondary}
                  name="chevron-forward"
                  size={theme.sizes.iconMedium}
                />
              }
            />
            <HomeShortcutCard
              accessibilityLabel="Abrir Registrar Dados"
              icon={
                <Ionicons color={theme.colors.textSecondary} name="calendar-outline" size={21} />
              }
              label="Registrar Dados"
              onPress={handleOpenRegistrarDados}
              trailing={
                <Ionicons
                  color={theme.colors.textSecondary}
                  name="chevron-forward"
                  size={theme.sizes.iconMedium}
                />
              }
            />
          </View>
        </View>
      </ProgressiveCollapsibleScreen>
    </View>
  );
}

export function RegistrarDailyDataScreen() {
  const insets = useAppSafeAreaInsets();
  const { resolvedMode, theme } = useAppTheme();
  const registrarCardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surface);
  const { enabled: testModeEnabled, text: maskText } = useTestModePresentation();
  const [isDeleting, setIsDeleting] = useState(false);
  const {
    addFieldValue,
    deleteDailyData,
    getLatestDailyValue,
    getValues,
    isHydrated,
    remoteStatus,
    setFieldValue,
  } = useCostSettings();
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
  const dailyDataViewState = hasDailyData
    ? 'populated'
    : !isHydrated || remoteStatus === 'loading'
      ? 'loading'
      : remoteStatus === 'failed'
        ? 'error'
        : 'empty';
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

  const originalContentTopOffset = theme.spacing.xl + theme.spacing.xxl + theme.spacing.xxs * 2 + 2;
  const pageTitle = (
    <NativeGlassHeader
      includeTopSafeArea={false}
      largeTitle
      mode="transparent"
      title="Dados Diários"
      titleStyle={getNativeLargeTitleStyle(theme.spacing.xxs)}
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
  const dailyDataPreview = (geometryStyle?: ContextMenuCardGeometryStyle) => (
    <View
      style={[
        styles.dailyDataCard,
        {
          backgroundColor: registrarCardSurface,
          borderRadius: theme.radius.xl + theme.spacing.sm,
          overflow: 'hidden',
          padding: theme.spacing.lg,
          width: '100%',
        },
        geometryStyle,
      ]}
    >
      {renderDailyDataContent()}
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ProgressiveCollapsibleScreen
        compactTitle="Dados Diários"
        contentGap={0}
        contentTopInset={originalContentTopOffset}
        largeTitle={pageTitle}
        largeTitleContainerStyle={{
          marginBottom: theme.spacing.xs,
          paddingHorizontal: theme.layout.screenHorizontalPadding,
        }}
        nativeHeader
        scrollContentContainerStyle={{
          paddingBottom: theme.layout.tabBarHeight + insets.bottom + theme.spacing.lg,
          paddingHorizontal: 0,
        }}
        scrollViewProps={{ keyboardShouldPersistTaps: 'handled' }}
      >
        <View
          style={[styles.dailyDataList, { gap: theme.spacing.sm, paddingTop: theme.spacing.md }]}
        >
          <Animated.View style={styles.fullWidth}>
            <MeasuredContextMenuGeometry>
              {({ onLayout, previewFrameStyle, triggerWidthStyle }) => (
                <View
                  onLayout={onLayout}
                  style={[
                    styles.dailyDataContextWrapper,
                    {
                      backgroundColor: registrarCardSurface,
                      borderRadius: hasDailyData
                        ? theme.radius.xl + theme.spacing.sm
                        : theme.radius.xl + theme.spacing.lg,
                      height: hasDailyData ? dailyDataCardMinHeight : undefined,
                      minHeight: hasDailyData ? dailyDataCardMinHeight : undefined,
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
                        height: hasDailyData ? dailyDataCardMinHeight : undefined,
                      },
                    ]}
                    preview={dailyDataPreview(previewFrameStyle)}
                  >
                    <Animated.View style={[styles.fullWidth, triggerWidthStyle]}>
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
                      ) : dailyDataViewState === 'loading' ? (
                        <View style={styles.emptyStateCard}>
                          <Loading
                            label="Carregando dados de hoje..."
                            style={{
                              paddingHorizontal: theme.spacing.lg,
                              paddingVertical: theme.spacing.md,
                            }}
                          />
                        </View>
                      ) : dailyDataViewState === 'error' ? (
                        <View style={[styles.emptyStateCard, { padding: theme.spacing.md }]}>
                          <InlineError message="Não foi possível confirmar os dados de hoje." />
                        </View>
                      ) : (
                        <View
                          style={[
                            styles.emptyStateCard,
                            {
                              paddingHorizontal: theme.spacing.lg,
                              paddingVertical: theme.spacing.md,
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
              )}
            </MeasuredContextMenuGeometry>
          </Animated.View>
        </View>
      </ProgressiveCollapsibleScreen>
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
        glassSurface
        glassTint={
          resolvedMode === 'dark' ? APPROVED_DARK_SHEET_GLASS_TINT : APPROVED_LIGHT_SHEET_GLASS_TINT
        }
        initialValues={dailySheetInitialValues}
        onSubmit={handleDailyDataSubmit}
        onVisibleChange={setSheetVisible}
        presentationBackgroundInteraction="disabled"
        presentationBackgroundMode="native"
        visible={sheetVisible}
      />
    </View>
  );
}

export function RegistrarDeliveryScreen({
  inlineClientSelection = false,
  showLargeTitle = false,
}: {
  inlineClientSelection?: boolean;
  showLargeTitle?: boolean;
} = {}) {
  const colorScheme = useColorScheme();
  const insets = useAppSafeAreaInsets();
  const { reduceMotionEnabled, resolvedMode, theme } = useAppTheme();
  const router = useRouter();
  const registrarCardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surface);
  const {
    quantity: maskQuantity,
    text: maskText,
    enabled: testModeEnabled,
  } = useTestModePresentation();
  const dark = colorScheme === 'dark';
  const { clients } = useClients();
  const [currentDate, setCurrentDate] = useState(() => todayIso());
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [clientSearchBlurRequestKey, setClientSearchBlurRequestKey] = useState(0);
  const [clientSearchFocused, setClientSearchFocused] = useState(false);
  const [deliverySortMode, setDeliverySortMode] = useState<DeliverySortMode>('latest');
  const {
    allDeliveries: sourceDeliveries,
    create,
    error: deliveryError,
    loading: deliveriesLoading,
    reload: reloadDeliveries,
    remove: removeDelivery,
  } = useDeliveries({
    mode: 'today',
    date: currentDate,
  });
  const registrarDeliverySheet = useRegistrarDeliverySheet({
    clients,
    create,
    preserveSelectedClientOnDismiss: inlineClientSelection,
  });
  const normalizedClientSearchQuery = useMemo(
    () => normalizeHomeSearchText(clientSearchQuery),
    [clientSearchQuery],
  );
  const filteredClientItems = useMemo(() => {
    const items = registrarDeliverySheet.clientItems;
    if (!normalizedClientSearchQuery) return items;

    return items.filter((item) =>
      normalizeHomeSearchText(item.title).includes(normalizedClientSearchQuery),
    );
  }, [normalizedClientSearchQuery, registrarDeliverySheet.clientItems]);
  const { markRecentlyAddedDeliveryIds, openSheet, recentlyAddedDeliveryIds } =
    registrarDeliverySheet;
  const handleOpenClientRegistration = useCallback(
    (clientId: string) => {
      if (clientSearchFocused) {
        Keyboard.dismiss();
        setClientSearchBlurRequestKey((requestKey) => requestKey + 1);
        return;
      }

      triggerLightImpactHaptic();
      router.push({ pathname: '/registrar-entrega/[clientId]', params: { clientId } });
    },
    [clientSearchFocused, router],
  );
  const handleClientSearchFocus = useCallback(() => {
    setClientSearchFocused(true);
    triggerLightImpactHaptic();
  }, []);
  const handleClientSearchBlur = useCallback(() => {
    setClientSearchFocused(false);
  }, []);
  const handleOpenNewClient = useCallback(() => {
    router.push('/clientes/novo');
  }, [router]);
  useFocusEffect(
    useCallback(() => {
      markRecentlyAddedDeliveryIds(consumeRecentlyAddedRegistrarDeliveryIds());
      setCurrentDate(todayIso());

      const refreshDate = setInterval(() => setCurrentDate(todayIso()), 60_000);
      return () => clearInterval(refreshDate);
    }, [markRecentlyAddedDeliveryIds]),
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
  const totalBuckets = todayDeliveries.reduce(
    (total, delivery) => total + delivery.quantidadeBaldes,
    0,
  );
  const deliveryTotal =
    todayDeliveries.length > 0 ? (
      <Text
        numberOfLines={1}
        selectable
        style={[
          theme.typography.footnote,
          { color: theme.colors.textSecondary, fontVariant: ['tabular-nums'] },
        ]}
      >
        {maskQuantity(totalBuckets)}
      </Text>
    ) : undefined;
  const hasTodayDeliveries = todayDeliveries.length > 0;
  const deliveryViewState = hasTodayDeliveries
    ? 'populated'
    : deliveriesLoading
      ? 'loading'
      : deliveryError
        ? 'error'
        : 'empty';
  const deliveryStateCardHeight = theme.spacing.md * 2 + theme.typography.body.lineHeight;
  const stickyActionFooterHeight = 58 + insets.bottom + theme.spacing.md + theme.spacing.sm;
  const deliveryRowHeight =
    theme.spacing.sm * 2 +
    Math.max(
      54,
      theme.typography.body.lineHeight,
      theme.typography.callout.lineHeight + theme.typography.footnote.lineHeight + 2,
    );
  const deliveryCardHeight = !hasTodayDeliveries
    ? deliveryStateCardHeight
    : todayDeliveries.length * deliveryRowHeight +
      Math.max(0, todayDeliveries.length - 1) * theme.spacing.xs;
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
  const deliveryItemTransitionDuration = reduceMotionEnabled
    ? 0
    : theme.animations.duration.standard;
  const deliveryItemLayoutTransition = LinearTransition.duration(deliveryItemTransitionDuration);

  const handleDeliverySortChange = useCallback((sortMode: DeliverySortMode) => {
    triggerSelectionHaptic();
    setDeliverySortMode(sortMode);
  }, []);

  const clientSelectionTitle = inlineClientSelection ? 'Clientes' : 'Entregas';

  const header = (
    <NativeGlassHeader
      collapsibleTitleRole="compact"
      includeTopSafeArea
      mode="transparent"
      pointerEvents="box-none"
      rightActions={showLargeTitle ? undefined : deliveryTotal}
      title={showLargeTitle ? '' : clientSelectionTitle}
    />
  );
  const pageTitle = showLargeTitle ? (
    <NativeGlassHeader
      collapsibleTitleRole="large"
      includeTopSafeArea={false}
      largeTitle
      mode="transparent"
      rightActions={inlineClientSelection ? undefined : deliveryTotal}
      title={clientSelectionTitle}
      titleStyle={getNativeLargeTitleStyle(theme.spacing.xxs)}
    />
  ) : null;

  const originalContentTopOffset = theme.spacing.xl + theme.spacing.xxl + theme.spacing.xxs * 2 + 2;
  const pageTitleBlock = (
    <>
      {pageTitle ? (
        <View
          style={[
            styles.pageTitleBlock,
            {
              marginBottom: theme.spacing.xs,
              marginTop: theme.spacing.xl + theme.spacing.xxl + theme.spacing.xxs * 2 + 2,
              paddingHorizontal: theme.layout.screenHorizontalPadding,
            },
          ]}
        >
          {pageTitle}
        </View>
      ) : null}
    </>
  );
  const deliveryList = (
    <View
      style={[
        styles.deliveryList,
        {
          gap: theme.spacing.sm,
          paddingTop:
            inlineClientSelection && showLargeTitle
              ? theme.spacing.sm
              : showLargeTitle
                ? theme.spacing.md
                : 28,
        },
      ]}
    >
      {inlineClientSelection ? (
        <RegistrarClientSelectionSection
          cardSurfaceColor={registrarCardSurface}
          hasSearchQuery={normalizedClientSearchQuery.length > 0}
          items={filteredClientItems}
          onSelect={handleOpenClientRegistration}
          searchFocused={clientSearchFocused}
        />
      ) : null}
      {!inlineClientSelection && hasTodayDeliveries ? (
        <>
          {!showLargeTitle ? (
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
          ) : null}
          <Animated.View style={[styles.fullWidth, deliveryCardAnimatedStyle]}>
            <View style={[styles.todayDeliveriesGroup, { gap: theme.spacing.xs }]}>
              {todayDeliveries.map((delivery) => {
                const renderDeliveryItemRow = (preview = false) => (
                  <View
                    style={[
                      styles.deliveryItemRow,
                      {
                        backgroundColor: preview ? registrarCardSurface : 'transparent',
                        borderRadius: theme.radius.xl + theme.spacing.sm,
                        height: deliveryRowHeight,
                        overflow: preview ? 'hidden' : undefined,
                        paddingHorizontal: theme.spacing.md,
                        paddingVertical: theme.spacing.sm,
                        width: '100%',
                      },
                    ]}
                  >
                    <OpenPaymentClientIcon />
                    <View style={styles.deliveryItemCopy}>
                      <Text
                        style={[
                          theme.typography.body,
                          {
                            color: theme.colors.textPrimary,
                            fontWeight: theme.typography.headline.fontWeight,
                          },
                        ]}
                      >
                        {delivery.cliente}
                      </Text>
                      <Text
                        style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}
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
                const cardStyle = [
                  styles.deliveryItemCard,
                  styles.fullWidth,
                  {
                    borderRadius: theme.radius.xl + theme.spacing.sm,
                    height: deliveryRowHeight,
                  },
                ];

                return (
                  <MeasuredContextMenuGeometry key={delivery.id}>
                    {({ onLayout, previewFrameStyle, triggerWidthStyle }) => (
                      <Animated.View
                        entering={FadeIn.duration(deliveryItemTransitionDuration)}
                        exiting={FadeOut.duration(deliveryItemTransitionDuration)}
                        layout={deliveryItemLayoutTransition}
                        onLayout={onLayout}
                        style={styles.fullWidth}
                      >
                        <NativeCardContextMenu
                          actions={rowActions}
                          matchContents={{ horizontal: true, vertical: false }}
                          preview={
                            <PremiumCard style={[cardStyle, previewFrameStyle]}>
                              {renderDeliveryItemRow(true)}
                            </PremiumCard>
                          }
                          style={[
                            styles.deliveryContextMenu,
                            {
                              borderRadius: theme.radius.xl + theme.spacing.sm,
                              height: deliveryRowHeight,
                            },
                          ]}
                        >
                          <PremiumCard style={[cardStyle, triggerWidthStyle]}>
                            {rowContent}
                          </PremiumCard>
                        </NativeCardContextMenu>
                      </Animated.View>
                    )}
                  </MeasuredContextMenuGeometry>
                );
              })}
            </View>
          </Animated.View>
        </>
      ) : inlineClientSelection ? null : deliveryViewState === 'loading' ? (
        <Animated.View style={[styles.fullWidth, deliveryCardAnimatedStyle]}>
          <PremiumCard
            style={[
              styles.emptyDeliveryCard,
              {
                borderRadius: theme.radius.xl + theme.spacing.lg,
                height: '100%',
                padding: 0,
              },
            ]}
          >
            <Loading label="Carregando entregas..." style={{ paddingVertical: theme.spacing.md }} />
          </PremiumCard>
        </Animated.View>
      ) : deliveryViewState === 'error' ? (
        <Animated.View style={styles.fullWidth}>
          <ErrorState
            description={deliveryError}
            onRetry={() => void reloadDeliveries()}
            style={{ padding: theme.spacing.md }}
            title="Não foi possível carregar entregas"
          />
        </Animated.View>
      ) : (
        <Animated.View style={[styles.fullWidth, deliveryCardAnimatedStyle]}>
          <PremiumCard
            style={[
              styles.emptyDeliveryCard,
              {
                borderRadius: theme.radius.xl + theme.spacing.lg,
                height: '100%',
                padding: 0,
              },
            ]}
          >
            <View style={[styles.emptyStateCard, { paddingVertical: theme.spacing.md }]}>
              <Text
                style={[
                  theme.typography.body,
                  { color: theme.colors.textSecondary, textAlign: 'center' },
                ]}
              >
                Nenhuma entrega hoje
              </Text>
            </View>
          </PremiumCard>
        </Animated.View>
      )}
    </View>
  );
  const shouldUseProgressiveCollapsibleScreen = inlineClientSelection && showLargeTitle;
  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <RegistrarDeliveryToolbar
        inlineClientSelection={inlineClientSelection}
        onCreateClient={handleOpenNewClient}
        onSortChange={handleDeliverySortChange}
        sortMode={deliverySortMode}
      />
      {shouldUseProgressiveCollapsibleScreen ? (
        <ProgressiveCollapsibleScreen
          compactTitle={clientSelectionTitle}
          contentGap={0}
          contentTopInset={originalContentTopOffset}
          largeTitle={pageTitle}
          largeTitleContainerStyle={{
            marginBottom: theme.spacing.xs,
            paddingHorizontal: theme.layout.screenHorizontalPadding,
          }}
          nativeHeader
          scrollViewProps={{
            automaticallyAdjustKeyboardInsets: true,
            keyboardShouldPersistTaps: 'handled',
          }}
          scrollContentContainerStyle={{
            paddingBottom:
              theme.layout.tabBarHeight +
              insets.bottom +
              theme.spacing.xl +
              (inlineClientSelection ? stickyActionFooterHeight : 0),
            paddingHorizontal: 0,
          }}
        >
          {deliveryList}
        </ProgressiveCollapsibleScreen>
      ) : (
        <PremiumScreen
          collapsibleTitle={showLargeTitle ? { compactTitle: clientSelectionTitle } : undefined}
          contentContainerStyle={{
            paddingBottom:
              theme.layout.tabBarHeight +
              insets.bottom +
              theme.spacing.xl +
              (inlineClientSelection ? stickyActionFooterHeight : 0),
            paddingHorizontal: 0,
          }}
          overlayHeader={header}
          overlayHeaderContentOffset={showLargeTitle ? theme.sizes.touchTargetMinimum : undefined}
          overlayHeaderSpacing={showLargeTitle ? 0 : theme.spacing.md}
          progressiveBlur
        >
          {pageTitleBlock}
          {deliveryList}
        </PremiumScreen>
      )}
      {inlineClientSelection ? (
        <StickyActionFooter
          contentContainerStyle={{ paddingHorizontal: '8%' }}
          height={stickyActionFooterHeight}
          keyboardAware
        >
          <GlassSurface glassEffectStyle="clear" interactive style={{ width: '100%' }}>
            <SearchBar
              accessibilityLabel="Buscar cliente"
              blurRequestKey={clientSearchBlurRequestKey}
              keyboardAppearance={resolvedMode === 'dark' ? 'dark' : 'light'}
              onChangeText={setClientSearchQuery}
              onClear={() => setClientSearchQuery('')}
              onBlur={handleClientSearchBlur}
              onFocus={handleClientSearchFocus}
              placeholder="Buscar cliente"
              returnKeyType="search"
              style={{
                backgroundColor: 'transparent',
                borderColor: 'transparent',
                borderWidth: 0,
              }}
              value={clientSearchQuery}
            />
          </GlassSurface>
        </StickyActionFooter>
      ) : (
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
      )}
      {!inlineClientSelection ? (
        <RegistrarDeliverySheet controller={registrarDeliverySheet} />
      ) : null}
    </View>
  );
}

function RegistrarClientSelectionSection({
  cardSurfaceColor,
  hasSearchQuery,
  items,
  onSelect,
  searchFocused,
}: {
  cardSurfaceColor: string;
  hasSearchQuery: boolean;
  items: RegistrarDeliverySheetController['clientItems'];
  onSelect: (clientId: string) => void;
  searchFocused: boolean;
}) {
  const { resolvedMode, theme } = useAppTheme();

  return (
    <View style={styles.clientSelectionSection}>
      {items.length > 0 ? (
        <View style={{ gap: theme.spacing.sm, width: '100%' }}>
          {items.map((item) => {
            return (
              <AnimatedPressable
                accessibilityHint="Abrir registro de entrega para este cliente"
                accessibilityLabel={item.title}
                accessibilityRole="button"
                containerStyle={{ width: '100%' }}
                disablePressAnimation={searchFocused}
                key={item.id}
                onPress={() => onSelect(item.id)}
              >
                <ListItem
                  leading={
                    <OpenPaymentClientIcon
                      backgroundColor={
                        resolvedMode === 'dark'
                          ? theme.colors.selectionSurface
                          : theme.colors.background
                      }
                      iconColor={
                        resolvedMode === 'dark'
                          ? theme.colors.selectionContent
                          : theme.colors.textPrimary
                      }
                      iconName="person"
                    />
                  }
                  style={{
                    backgroundColor: cardSurfaceColor,
                    borderRadius: theme.radius.pill,
                    borderCurve: 'continuous',
                    overflow: 'hidden',
                    paddingHorizontal: theme.spacing.md,
                    width: '100%',
                  }}
                  title={item.title}
                />
              </AnimatedPressable>
            );
          })}
        </View>
      ) : hasSearchQuery ? (
        <Text
          style={[
            theme.typography.body,
            { color: theme.colors.textSecondary, paddingVertical: theme.spacing.sm },
          ]}
        >
          Nenhum cliente encontrado
        </Text>
      ) : (
        <View
          style={[
            styles.clientSelectionEmpty,
            { gap: theme.spacing.sm, paddingVertical: theme.spacing.xl },
          ]}
        >
          <Ionicons color={theme.colors.textSecondary} name="person-add-outline" size={28} />
          <Text
            style={[
              theme.typography.headline,
              { color: theme.colors.textPrimary, textAlign: 'center' },
            ]}
          >
            Nenhum cliente cadastrado
          </Text>
          <Text
            style={[
              theme.typography.footnote,
              { color: theme.colors.textSecondary, textAlign: 'center' },
            ]}
          >
            Cadastre um cliente para registrar uma entrega.
          </Text>
        </View>
      )}
    </View>
  );
}

function RegistrarDeliveryToolbar({
  inlineClientSelection,
  onCreateClient,
  onSortChange,
  sortMode,
}: {
  inlineClientSelection: boolean;
  onCreateClient: () => void;
  onSortChange: (sortMode: DeliverySortMode) => void;
  sortMode: DeliverySortMode;
}) {
  const { theme } = useAppTheme();
  const liveActivityState = useLiveActivityCoordinatorState();

  if (inlineClientSelection) {
    return (
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityHint="Abre o cadastro de cliente"
          accessibilityLabel="Novo cliente"
          onPress={onCreateClient}
          separateBackground={false}
          tintColor={theme.colors.textPrimary}
        >
          <Stack.Toolbar.Icon sf="person.badge.plus" />
          <Stack.Toolbar.Label>Novo cliente</Stack.Toolbar.Label>
        </Stack.Toolbar.Button>
        {Platform.OS === 'ios' ? (
          <Stack.Toolbar.Button
            accessibilityHint={
              liveActivityState.isActive
                ? 'Encerra a Atividade ao vivo das entregas no Atacado'
                : liveActivityState.supported !== true
                  ? 'Disponível em uma Development Build iOS com suporte a Live Activities'
                  : liveActivityState.canStart
                    ? 'Mostra os baldes e as entregas de hoje na Tela Bloqueada e na Dynamic Island'
                    : 'Aguarde uma consulta completa das entregas de hoje'
            }
            accessibilityLabel={
              liveActivityState.isActive
                ? 'Encerrar atividade ao vivo'
                : 'Iniciar atividade ao vivo'
            }
            disabled={
              liveActivityState.isBusy ||
              liveActivityState.supported !== true ||
              (!liveActivityState.isActive && !liveActivityState.canStart)
            }
            icon="dot.radiowaves.left.and.right"
            onPress={() => {
              void wholesaleDeliveryLiveActivityCoordinator.toggleFromToolbar().then((result) => {
                if (!result.ok) Alert.alert('Atividade ao vivo', result.message);
              });
            }}
            selected={liveActivityState.isActive}
            separateBackground={false}
            tintColor={theme.colors.textPrimary}
          />
        ) : null}
      </Stack.Toolbar>
    );
  }

  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Menu
        accessibilityLabel="Ordenar entregas"
        icon="line.3.horizontal.decrease"
        separateBackground={false}
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
  modeOptions: { width: '100%' },
  fullWidth: { width: '100%' },
  pageTitleBlock: { width: '100%' },
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
  deliveryList: { paddingHorizontal: 16, paddingTop: 28 },
  emptyDeliveryCard: { width: '100%' },
  clientSelectionSection: { width: '100%' },
  clientSelectionEmpty: { alignItems: 'center', width: '100%' },
  deliveryItemCard: { padding: 0 },
  deliveryTitleSlot: { alignItems: 'center', justifyContent: 'center', width: '100%' },
  deliveryDayTitle: { textAlign: 'center' },
  todayDeliveriesGroup: { width: '100%' },
  deliveryContextMenu: { width: '100%' },
  deliveryItemRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  deliveryItemCopy: { flex: 1, gap: 2 },
});
