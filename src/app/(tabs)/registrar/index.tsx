import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import type { SFSymbol } from 'sf-symbols-typescript';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import { NativeGlassHeader } from '@/components/layout';
import {
  NativeCardContextMenu,
  NativeDailyDataSheet,
  NativeGlassIconButton,
} from '@/components/native';
import type { NativeDailyDataValues } from '@/components/native';
import { PremiumCard, PremiumScreen } from '@/components/premium';
import { RegistrarDeliverySheet } from '@/features/deliveries/components/RegistrarDeliverySheet';
import { useRegistrarDeliverySheet } from '@/features/deliveries/hooks/useRegistrarDeliverySheet';
import OpenPaymentClientIcon from '@/features/open-payments/components/OpenPaymentClientIcon';
import { useAppSafeAreaInsets } from '@/providers';
import { useClients } from '@/hooks/useClients';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useCostSettings } from '@/hooks/useCostSettings';
import {
  getCardSurfaceColor,
  getLiquidGlassTint,
  registrarDeliveryDarkLiquidGlassTint,
  useAppTheme,
} from '@/theme';
import { triggerLightImpactHaptic, triggerSelectionHaptic } from '@/utils/haptics';
import { formatCurrency, normalizeMoney, todayIso } from '@/utils/data';
import { toHistoryDelivery } from '@/services/data';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';
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
  return <RegistrarModeSelection />;
}

function RegistrarModeSelection() {
  const { resolvedMode, theme } = useAppTheme();
  const registrarCardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surface);
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
            {
              gap: theme.spacing.sm,
              marginTop: theme.spacing.md * 2 - theme.spacing.xs / 2 - 4,
            },
          ]}
        >
          <View style={[styles.widgetRow, { gap: theme.spacing.sm }]}>
            <PremiumCard
              accessibilityLabel="Abrir Registrar Entrega"
              onPress={handleOpenRegistrarEntrega}
              style={[
                styles.widgetCard,
                {
                  backgroundColor: registrarCardSurface,
                  borderRadius: theme.radius.xl + theme.spacing.sm,
                  padding: theme.spacing.lg,
                },
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
                {
                  backgroundColor: registrarCardSurface,
                  borderRadius: theme.radius.xl + theme.spacing.sm,
                  padding: theme.spacing.lg,
                },
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

export function RegistrarDailyDataScreen({ showLargeTitle = false }: { showLargeTitle?: boolean } = {}) {
  const insets = useAppSafeAreaInsets();
  const { resolvedMode, theme } = useAppTheme();
  const useDarkGlassSurface = resolvedMode === 'dark';
  const registrarCardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surface);
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
      title={showLargeTitle ? '' : 'Dados Diários'}
    />
  );
  const pageTitle = showLargeTitle ? (
    <NativeGlassHeader
      includeTopSafeArea={false}
      largeTitle
      mode="transparent"
      title="Dados Diários"
      titleStyle={{
        fontFamily: 'System',
        fontSize: 36,
        fontWeight: '700',
        marginLeft: -(theme.spacing.xxs * 2),
      }}
    />
  ) : null;
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
          backgroundColor: registrarCardSurface,
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
        overlayHeaderContentOffset={showLargeTitle ? theme.sizes.touchTargetMinimum : undefined}
        overlayHeaderSpacing={showLargeTitle ? 0 : theme.spacing.md}
        progressiveBlur
      >
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
        <View
          style={[
            styles.dailyDataList,
            { gap: theme.spacing.sm, paddingTop: showLargeTitle ? theme.spacing.md : 28 },
          ]}
        >
          <Animated.View style={styles.fullWidth}>
            <View
              style={[
                styles.dailyDataContextWrapper,
                {
                  backgroundColor: registrarCardSurface,
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
        glassSurface={useDarkGlassSurface}
        glassTint={
          useDarkGlassSurface ? registrarDeliveryDarkLiquidGlassTint : undefined
        }
        initialValues={dailySheetInitialValues}
        onSubmit={handleDailyDataSubmit}
        onVisibleChange={setSheetVisible}
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
  const registrarCardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surface);
  const { quantity: maskQuantity, text: maskText, enabled: testModeEnabled } =
    useTestModePresentation();
  const dark = colorScheme === 'dark';
  const { clients } = useClients();
  const [currentDate, setCurrentDate] = useState(() => todayIso());
  const [deliverySortMode, setDeliverySortMode] = useState<DeliverySortMode>('latest');
  const {
    allDeliveries: sourceDeliveries,
    create,
    remove: removeDelivery,
  } = useDeliveries({
    mode: 'today',
    date: currentDate,
  });
  const registrarDeliverySheet = useRegistrarDeliverySheet({ clients, create });
  const { openSheet, recentlyAddedDeliveryIds } = registrarDeliverySheet;
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
    theme.spacing.sm * 2 +
    Math.max(
      54,
      theme.typography.body.lineHeight,
      theme.typography.callout.lineHeight + theme.typography.footnote.lineHeight + 2,
    );
  const deliveryCardHeight =
    todayDeliveries.length === 0
      ? emptyDeliveryCardMinHeight
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

  const header = (
    <NativeGlassHeader
      includeTopSafeArea
      mode="transparent"
      pointerEvents="box-none"
      title={showLargeTitle ? '' : 'Entregas'}
    />
  );
  const pageTitle = showLargeTitle ? (
    <NativeGlassHeader
      includeTopSafeArea={false}
      largeTitle
      mode="transparent"
      title="Entregas"
      titleStyle={{
        fontFamily: 'System',
        fontSize: 36,
        fontWeight: '700',
        marginLeft: -(theme.spacing.xxs * 2),
      }}
    />
  ) : null;

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
        overlayHeaderContentOffset={showLargeTitle ? theme.sizes.touchTargetMinimum : undefined}
        overlayHeaderSpacing={showLargeTitle ? 0 : theme.spacing.md}
        progressiveBlur
      >
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
        <View
          style={[
            styles.deliveryList,
            { gap: theme.spacing.sm, paddingTop: showLargeTitle ? theme.spacing.md : 28 },
          ]}
        >
          {todayDeliveries.length > 0 ? (
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
                    const cardStyle = [
                      styles.deliveryItemCard,
                      styles.fullWidth,
                      {
                        borderRadius: theme.radius.xl + theme.spacing.sm,
                        height: deliveryRowHeight,
                      },
                    ];

                    return (
                      <Animated.View
                        entering={FadeIn.duration(deliveryItemTransitionDuration)}
                        exiting={FadeOut.duration(deliveryItemTransitionDuration)}
                        key={delivery.id}
                        layout={deliveryItemLayoutTransition}
                        style={styles.fullWidth}
                      >
                        <NativeCardContextMenu
                          actions={rowActions}
                          preview={
                            <PremiumCard style={cardStyle}>
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
                          <PremiumCard style={cardStyle}>{rowContent}</PremiumCard>
                        </NativeCardContextMenu>
                      </Animated.View>
                    );
                  })}
                </View>
              </Animated.View>
            </>
          ) : (
            <Animated.View style={[styles.fullWidth, deliveryCardAnimatedStyle]}>
              <PremiumCard
                style={[
                  styles.emptyDeliveryCard,
                  {
                    borderRadius: theme.radius.xl + theme.spacing.lg,
                    height: '100%',
                    paddingVertical: theme.spacing.xxl * 2,
                  },
                ]}
              >
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
              </PremiumCard>
            </Animated.View>
          )}
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
      <RegistrarDeliverySheet
        controller={registrarDeliverySheet}
        initialPage={inlineClientSelection ? 1 : 0}
        useClientPager={inlineClientSelection}
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
  headerTrailingActions: { width: 104 },
  deliveryList: { paddingHorizontal: 16, paddingTop: 28 },
  emptyDeliveryCard: { width: '100%' },
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
