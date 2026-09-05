import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PremiumCard, PremiumScreen } from '@/components/premium';
import { NativeGlassHeader } from '@/components/layout';
import { NativeAvatarButton, NativeSearchField } from '@/components/native';
import { getCardSurfaceColor, getLiquidGlassTint, useAppTheme } from '@/theme';
import { useAppSafeAreaInsets, useAuth } from '@/providers';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';
import { TodayDeliveriesCard } from '@/features/home/components/TodayDeliveriesCard';
import { useOpenPaymentClients } from '@/features/open-payments/hooks/useOpenPaymentClients';
import { HomeSearchResultsSheet } from '@/features/home/components/HomeSearchResultsSheet';
import { HomeSearchHelpSheet } from '@/features/home/help/HomeSearchHelpSheet';
import { HomeProfileSheet } from '@/features/home/profile/HomeProfileSheet';
import { prewarmAppleIntelligence } from '@/features/home/search/AppleIntelligenceSearchInterpreter';
import {
  homeSearchPresentationReducer,
  initialHomeSearchPresentationState,
  isHomeSearchSheetVisible,
} from '@/features/home/hooks/HomeSearchPresentationFlow';
import { useHomeSearch } from '@/features/home/hooks/useHomeSearch';
import { countOpenDocuments } from '@/features/invoices';
import { useClients } from '@/hooks/useClients';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useFactoryPurchases } from '@/hooks/useFactoryPurchases';
import { factoryPurchaseCalculationService } from '@/services/factory-purchases';
import { toHistoryDelivery } from '@/services/data';
import { todayIso } from '@/utils/data';

function PreviewIcon({
  color,
  name,
  size,
}: {
  color: string;
  name: ComponentProps<typeof Ionicons>['name'];
  size?: number;
}) {
  const { theme } = useAppTheme();

  return <Ionicons color={color} name={name} size={size ?? theme.sizes.iconMedium} />;
}

export default function Home() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { resolvedMode, theme } = useAppTheme();
  const homeCardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surface);
  const { user } = useAuth();
  const {
    currency: maskCurrency,
    enabled: testModeEnabled,
    text: maskText,
  } = useTestModePresentation();
  const insets = useAppSafeAreaInsets();
  const [focusEntryKey, setFocusEntryKey] = useState(0);
  const wasFocused = useRef(false);
  const [currentDate, setCurrentDate] = useState(() => todayIso());
  const [searchText, setSearchText] = useState('');
  const [isHelpSheetVisible, setIsHelpSheetVisible] = useState(false);
  const [isProfileSheetVisible, setIsProfileSheetVisible] = useState(false);
  const helpKeyboardWillHideSubscription = useRef<ReturnType<typeof Keyboard.addListener> | null>(
    null,
  );
  const helpKeyboardDidHideSubscription = useRef<ReturnType<typeof Keyboard.addListener> | null>(
    null,
  );
  const helpPresentationPending = useRef(false);
  const [searchFlow, dispatchSearchFlow] = useReducer(
    homeSearchPresentationReducer,
    initialHomeSearchPresentationState,
  );
  const activeSearchId = useRef(0);
  const { search: runHomeSearch } = useHomeSearch();
  const {
    deliveries: dailyDeliveries,
    remove: removeDelivery,
    toggleDelivered: toggleDelivery,
  } = useDeliveries({ mode: 'today', date: currentDate });
  const { clients } = useClients();
  const { purchases: factoryPurchases } = useFactoryPurchases();
  const eligibleClientIds = useMemo(
    () =>
      clients
        .filter((client) => client.usesInvoice || client.usesBoleto)
        .map((client) => client.clientId),
    [clients],
  );
  const { deliveries: invoiceDeliveries } = useDeliveries({
    clientIds: eligibleClientIds,
    mode: 'all',
  });
  const { clientCards: openPaymentClientCards, totalOpenAmount } = useOpenPaymentClients();
  const historyDeliveries = useMemo(
    () => dailyDeliveries.map(toHistoryDelivery),
    [dailyDeliveries],
  );
  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(todayIso()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const todayDeliveries = useMemo(() => historyDeliveries, [historyDeliveries]);
  const openDocumentsCount = useMemo(
    () => countOpenDocuments(invoiceDeliveries, clients),
    [invoiceDeliveries, clients],
  );
  const factoryOpenAmount = useMemo(
    () => factoryPurchaseCalculationService.summarize(factoryPurchases).openValue,
    [factoryPurchases],
  );
  useEffect(() => {
    if (isFocused && !wasFocused.current) {
      setFocusEntryKey((currentKey) => currentKey + 1);
    }

    wasFocused.current = isFocused;
  }, [isFocused]);

  useEffect(() => {
    if (searchFlow.phase !== 'resultReady' || !searchFlow.response) return;

    dispatchSearchFlow({ type: 'CONTENT_COMMITTED' });
  }, [searchFlow.phase, searchFlow.response]);

  useEffect(() => {
    if (searchFlow.phase !== 'readyToPresent') return;

    dispatchSearchFlow({ type: 'PRESENTATION_REQUESTED' });
  }, [searchFlow.phase]);

  const handleTodayStatusToggle = useCallback(
    (deliveryId: string) => {
      if (testModeEnabled) return;
      triggerLightImpactHaptic();
      void toggleDelivery(deliveryId);
    },
    [testModeEnabled, toggleDelivery],
  );

  const handleTodayDeliveryDelete = useCallback(
    (deliveryId: string) => {
      if (testModeEnabled) return;
      void removeDelivery(deliveryId);
    },
    [removeDelivery, testModeEnabled],
  );

  const handleSearchTextChange = useCallback((value: string) => setSearchText(value), []);

  const handleSearchFocusChange = useCallback((focused: boolean) => {
    if (focused) void prewarmAppleIntelligence();
  }, []);

  const submitHomeSearch = useCallback(
    (submittedValue: string) => {
      const searchId = activeSearchId.current + 1;
      const query = submittedValue.trim();
      if (!query) return;
      activeSearchId.current = searchId;
      Keyboard.dismiss();
      dispatchSearchFlow({ type: 'SEARCH_SUBMITTED', searchId });
      void runHomeSearch(query).then((nextResponse) => {
        if (!nextResponse || nextResponse.stale) {
          if (!nextResponse) {
            dispatchSearchFlow({ type: 'SEARCH_UNAVAILABLE', searchId });
          }
          return;
        }
        dispatchSearchFlow({ type: 'RESULT_RECEIVED', response: nextResponse, searchId });
      });
    },
    [runHomeSearch],
  );

  const handleSearchSubmit = useCallback(
    (submittedValue: string) => submitHomeSearch(submittedValue),
    [submitHomeSearch],
  );

  const handleSearchSheetImplementationReady = useCallback(
    (_implementation: 'swiftui' | 'fallback') => {
      dispatchSearchFlow({ type: 'IMPLEMENTATION_READY' });
    },
    [],
  );

  const handleSearchSheetVisibleChange = useCallback((nextVisible: boolean) => {
    dispatchSearchFlow({ type: 'NATIVE_VISIBILITY_CHANGED', visible: nextVisible });
  }, []);

  const clearHelpKeyboardListeners = useCallback(() => {
    helpKeyboardWillHideSubscription.current?.remove();
    helpKeyboardWillHideSubscription.current = null;
    helpKeyboardDidHideSubscription.current?.remove();
    helpKeyboardDidHideSubscription.current = null;
  }, []);

  const presentHelpSheet = useCallback(() => {
    clearHelpKeyboardListeners();

    if (!helpPresentationPending.current) return;

    helpPresentationPending.current = false;
    setIsHelpSheetVisible(true);
  }, [clearHelpKeyboardListeners]);

  const handlePressHelp = useCallback(() => {
    if (isHelpSheetVisible || helpPresentationPending.current) return;

    helpPresentationPending.current = true;
    if (!Keyboard.isVisible()) {
      presentHelpSheet();
      return;
    }

    clearHelpKeyboardListeners();
    helpKeyboardWillHideSubscription.current = Keyboard.addListener(
      'keyboardWillHide',
      presentHelpSheet,
    );
    helpKeyboardDidHideSubscription.current = Keyboard.addListener(
      'keyboardDidHide',
      presentHelpSheet,
    );
    Keyboard.dismiss();
  }, [
    clearHelpKeyboardListeners,
    isHelpSheetVisible,
    presentHelpSheet,
  ]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        clearHelpKeyboardListeners();
        helpPresentationPending.current = false;
        setIsHelpSheetVisible(false);
      };
    }, [clearHelpKeyboardListeners]),
  );

  const handleHelpSelectQuery = useCallback(
    (selectedQuery: string) => {
      setIsHelpSheetVisible(false);
      setSearchText(selectedQuery);
      handleSearchSubmit(selectedQuery);
    },
    [handleSearchSubmit],
  );

  const handleHelpSheetDismiss = useCallback(() => {
    setIsHelpSheetVisible(false);
  }, []);

  const handleSearchSheetDismiss = useCallback(() => {
    setSearchText('');
    setFocusEntryKey((currentKey) => currentKey + 1);
    dispatchSearchFlow({ type: 'DISMISS_COMPLETED' });
  }, []);

  const handleOpenRecebimentos = useCallback(() => {
    triggerLightImpactHaptic();
    router.push('/em-aberto');
  }, [router]);

  const handleOpenFactory = useCallback(() => {
    triggerLightImpactHaptic();
    router.push('/fabrica-compras');
  }, [router]);

  const handleOpenRegistrarEntrega = useCallback(() => {
    triggerLightImpactHaptic();
    router.push('/registrar-entrega');
  }, [router]);

  const handleOpenDocumentos = useCallback(() => {
    triggerLightImpactHaptic();
    router.push('/notas-fiscais-boletos');
  }, [router]);

  const handleOpenProfile = useCallback(() => {
    setIsProfileSheetVisible(true);
  }, []);

  const accountName = user?.displayName?.trim() || 'Conta';

  const homeToolbar = (
    <NativeGlassHeader
      includeTopSafeArea
      mode="transparent"
      rightActions={
        <NativeAvatarButton
          accessibilityHint="Exibe os dados da conta e a opção de sair"
          accessibilityLabel="Abrir perfil da conta"
          avatarSize="medium"
          containerSize={theme.sizes.touchTargetMinimum}
          glassTint={getLiquidGlassTint(resolvedMode)}
          haptic="light"
          imageUri={user?.photoUrl}
          name={accountName}
          onPress={handleOpenProfile}
        />
      }
      title=""
    />
  );

  const homeHeader = (
    <NativeGlassHeader
      includeTopSafeArea={false}
      mode="transparent"
      largeTitle
      title="Home"
      titleStyle={{
        fontFamily: 'System',
        fontSize: 36,
        fontWeight: '700',
        marginLeft: -(theme.spacing.xxs * 2),
      }}
    />
  );
  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <PremiumScreen
        contentContainerStyle={{
          gap: theme.spacing.lg,
          marginTop: theme.spacing.xl + theme.spacing.xxl + theme.spacing.xxs * 2 + 2,
          paddingBottom: theme.layout.tabBarHeight + insets.bottom + theme.spacing.xxxl,
          paddingHorizontal: 0,
        }}
        progressiveBlurHeight={
          theme.spacing.xxxl + theme.spacing.xs * 2 + theme.spacing.xl + theme.spacing.sm
        }
        progressiveBlurTopOffset={0}
        progressiveBlur
        overlayHeader={homeToolbar}
        overlayHeaderContentOffset={theme.sizes.touchTargetMinimum}
      >
        <View
          style={[
            styles.paddedHomeContent,
            { gap: theme.spacing.lg, paddingHorizontal: theme.layout.screenHorizontalPadding },
          ]}
        >
          <View style={styles.header}>{homeHeader}</View>

          <View style={{ marginBottom: theme.spacing.xs, marginTop: 0 }}>
            <NativeSearchField
              accessibilityLabel="Buscar clientes, entregas e filtros"
              onChangeText={handleSearchTextChange}
              onFocusChange={handleSearchFocusChange}
              onPressHelp={handlePressHelp}
              onSubmit={handleSearchSubmit}
              placeholder="Busque clientes, entregas e filtros"
              focusEntryKey={focusEntryKey}
              value={searchText}
            />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.widgetRow,
            {
              gap: theme.spacing.sm,
              paddingLeft: theme.spacing.xs,
              paddingRight: theme.spacing.xs,
            },
          ]}
          decelerationRate="fast"
          directionalLockEnabled
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          snapToAlignment="start"
          snapToInterval={178 + theme.spacing.sm}
          style={styles.widgetCarousel}
        >
          <PremiumCard
            accessibilityLabel="Abrir Registrar Entrega"
            onPress={handleOpenRegistrarEntrega}
            style={[
              styles.widgetCard,
              {
                backgroundColor: homeCardSurface,
                borderRadius: theme.radius.xl + theme.spacing.sm,
                padding: theme.spacing.lg,
              },
            ]}
          >
            <View style={styles.widgetHeader}>
              <PreviewIcon color={theme.colors.textSecondary} name="cube-outline" />
              <PreviewIcon color={theme.colors.textSecondary} name="chevron-forward" />
            </View>
            <View
              style={[
                styles.widgetCopy,
                {
                  gap: theme.spacing.xxs,
                  minHeight: theme.typography.headline.lineHeight * 2,
                },
              ]}
            >
              <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
                Registrar Entrega
              </Text>
              <Text
                numberOfLines={1}
                style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}
              >
                {maskText(`${dailyDeliveries.length} hoje`)}
              </Text>
            </View>
          </PremiumCard>
          <PremiumCard
            accessibilityLabel="Abrir recebimentos em aberto"
            onPress={handleOpenRecebimentos}
            style={[
              styles.widgetCard,
              {
                backgroundColor: homeCardSurface,
                borderRadius: theme.radius.xl + theme.spacing.sm,
                padding: theme.spacing.lg,
              },
            ]}
          >
            <View style={styles.widgetHeader}>
              <PreviewIcon
                color={
                  openPaymentClientCards.length > 0
                    ? theme.colors.danger
                    : theme.colors.textSecondary
                }
                name="cash-outline"
              />
              <PreviewIcon color={theme.colors.textSecondary} name="chevron-forward" />
            </View>
            <View
              style={[
                styles.widgetCopy,
                {
                  gap: theme.spacing.xxs,
                  minHeight: theme.typography.headline.lineHeight * 2,
                },
              ]}
            >
              <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
                Em aberto
              </Text>
              <Text
                numberOfLines={1}
                style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}
              >
                {maskCurrency(totalOpenAmount)}
              </Text>
            </View>
          </PremiumCard>
          <PremiumCard
            accessibilityLabel="Abrir documentos"
            onPress={handleOpenDocumentos}
            style={[
              styles.widgetCard,
              {
                backgroundColor: homeCardSurface,
                borderRadius: theme.radius.xl + theme.spacing.sm,
                padding: theme.spacing.lg,
              },
            ]}
          >
            <View style={styles.widgetHeader}>
              <PreviewIcon
                color={openDocumentsCount > 0 ? theme.colors.warning : theme.colors.textSecondary}
                name="document-text-outline"
              />
              <PreviewIcon color={theme.colors.textSecondary} name="chevron-forward" />
            </View>
            <View
              style={[
                styles.widgetCopy,
                {
                  gap: theme.spacing.xxs,
                  minHeight: theme.typography.headline.lineHeight * 2,
                },
              ]}
            >
              <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
                Documentos
              </Text>
              <Text
                numberOfLines={1}
                style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}
              >
                {maskText(`${openDocumentsCount} em aberto`)}
              </Text>
            </View>
          </PremiumCard>
          <PremiumCard
            accessibilityLabel="Abrir Fábrica"
            onPress={handleOpenFactory}
            style={[
              styles.widgetCard,
              {
                backgroundColor: homeCardSurface,
                borderRadius: theme.radius.xl + theme.spacing.sm,
                padding: theme.spacing.lg,
              },
            ]}
          >
            <View style={styles.widgetHeader}>
              <PreviewIcon color={theme.colors.textSecondary} name="business-outline" />
              <PreviewIcon color={theme.colors.textSecondary} name="chevron-forward" />
            </View>
            <View
              style={[
                styles.widgetCopy,
                {
                  gap: theme.spacing.xxs,
                  minHeight: theme.typography.headline.lineHeight * 2,
                },
              ]}
            >
              <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
                Fábrica
              </Text>
              <Text
                numberOfLines={1}
                style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}
              >
                {maskCurrency(factoryOpenAmount)}
              </Text>
            </View>
          </PremiumCard>
        </ScrollView>

        <View style={{ paddingHorizontal: theme.layout.screenHorizontalPadding }}>
          <TodayDeliveriesCard
            cardSurfaceColor={homeCardSurface}
            deliveries={todayDeliveries}
            onDelete={handleTodayDeliveryDelete}
            onToggleStatus={handleTodayStatusToggle}
          />
        </View>
      </PremiumScreen>
      <HomeSearchResultsSheet
        loading={searchFlow.searchInFlight}
        onDismiss={handleSearchSheetDismiss}
        onImplementationReady={handleSearchSheetImplementationReady}
        onVisibleChange={handleSearchSheetVisibleChange}
        response={searchFlow.response}
        visible={isHomeSearchSheetVisible(searchFlow)}
      />
      <HomeSearchHelpSheet
        onDismiss={handleHelpSheetDismiss}
        onSelectQuery={handleHelpSelectQuery}
        visible={isHelpSheetVisible}
      />
      <HomeProfileSheet
        onVisibleChange={setIsProfileSheetVisible}
        visible={isProfileSheetVisible}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { alignItems: 'center', minHeight: 44, position: 'relative' },
  paddedHomeContent: { width: '100%' },
  widgetCarousel: { flexGrow: 0, width: '100%' },
  widgetRow: { alignSelf: 'flex-start', flexDirection: 'row' },
  widgetCard: { width: 178 },
  widgetHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  widgetCopy: { gap: 8, marginTop: 12 },
});
