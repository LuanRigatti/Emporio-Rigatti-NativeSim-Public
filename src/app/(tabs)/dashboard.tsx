import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable, PremiumCard, PremiumScreen } from '@/components/premium';
import { Badge } from '@/components/feedback';
import { NativeGlassHeader } from '@/components/layout';
import { NativeAvatarButton, NativeCardContextMenu, NativeSearchField } from '@/components/native';
import { financialCalculationService } from '@/services/finance';
import { getLiquidGlassTint, lightTheme, useAppTheme } from '@/theme';
import { useAppSafeAreaInsets, useAuth } from '@/providers';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { formatDateAsDayMonthYear } from '@/utils/groupItemsByDate';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';
import { TodayDeliveriesCard } from '@/features/home/components/TodayDeliveriesCard';
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
import { countOpenDocuments, formatOpenDocumentsLabel } from '@/features/invoices';
import { useClients } from '@/hooks/useClients';
import { useDeliveries } from '@/hooks/useDeliveries';
import { toHistoryDelivery } from '@/services/data';
import { formatClientName, normalizeClientKey, todayIso } from '@/utils/data';

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
  const helpKeyboardWillHideSubscription = useRef<
    ReturnType<typeof Keyboard.addListener> | null
  >(null);
  const helpKeyboardDidHideSubscription = useRef<
    ReturnType<typeof Keyboard.addListener> | null
  >(null);
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
  const { deliveries: openPaymentDeliveries, editMany } = useDeliveries({
    deliveryStatus: 'Entregue',
    mode: 'all',
    status: 'Não Pago',
  });
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
  const openPaymentClientCards = useMemo(
    () =>
      financialCalculationService
        .rankClients(openPaymentDeliveries, { periodo: 'todos' })
        .filter((client) => client.valor > 0)
        .map((client) => ({
          ...client,
          deliveries: openPaymentDeliveries.filter(
            (delivery) =>
              normalizeClientKey(formatClientName(delivery.cliente)) ===
              normalizeClientKey(client.nome),
          ),
        })),
    [openPaymentDeliveries],
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

  const handleOpenPayment = useCallback(
    (deliveryId: string) => {
      if (testModeEnabled) return;
      triggerLightImpactHaptic();
      void editMany([deliveryId], { status: 'Pago' });
    },
    [editMany, testModeEnabled],
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

  const handleSearchSubmit = useCallback(
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

  const handleSearchSheetImplementationReady = useCallback(
    (_implementation: 'swiftui' | 'fallback') => {
      dispatchSearchFlow({ type: 'IMPLEMENTATION_READY' });
    },
    [],
  );

  const handleSearchSheetVisibleChange = useCallback(
    (nextVisible: boolean) => {
      dispatchSearchFlow({ type: 'NATIVE_VISIBILITY_CHANGED', visible: nextVisible });
    },
    [],
  );

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
  }, [clearHelpKeyboardListeners, isHelpSheetVisible, presentHelpSheet]);

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

  const handleOpenRecebimentos = () => {
    triggerLightImpactHaptic();
    router.push('/pagamentos-em-aberto');
  };

  const handleOpenRegistrarEntrega = () => {
    triggerLightImpactHaptic();
    router.push('/registrar-entrega');
  };

  const handleOpenDocumentos = () => {
    triggerLightImpactHaptic();
    router.push('/notas-fiscais-boletos');
  };

  const handleOpenFactory = () => {
    triggerLightImpactHaptic();
    router.push('/fabrica-compras');
  };

  const openPaymentCardMinHeight =
    theme.spacing.md * 2 +
    theme.typography.callout.lineHeight +
    theme.spacing.xxs / 2 +
    theme.typography.footnote.lineHeight;

  const renderOpenPaymentRow = (
    client: (typeof openPaymentClientCards)[number],
    preview = false,
  ) => (
    <View
      style={[
        styles.openPaymentCard,
        {
          backgroundColor: preview ? theme.colors.surface : 'transparent',
          borderRadius: theme.radius.xl + theme.spacing.sm,
          overflow: preview ? 'hidden' : undefined,
          padding: theme.spacing.md,
          minHeight: openPaymentCardMinHeight,
          width: '100%',
        },
      ]}
    >
      <Text
        style={[
          theme.typography.callout,
          {
            color: theme.colors.textPrimary,
            fontSize: theme.typography.callout.fontSize + 1,
            fontWeight: theme.typography.headline.fontWeight,
            marginLeft: theme.spacing.xxs,
          },
        ]}
      >
        {client.nome}
      </Text>
      <Badge
        label={maskCurrency(client.valor)}
        labelStyle={[
          theme.typography.footnote,
          {
            color: resolvedMode === 'dark' ? theme.colors.danger : lightTheme.colors.danger,
            fontWeight: theme.typography.headline.fontWeight,
          },
        ]}
        style={{
          backgroundColor:
            resolvedMode === 'dark' ? theme.colors.dangerSurface : lightTheme.colors.dangerSurface,
          transform: [{ translateY: 10 }],
        }}
        tone="danger"
      />
    </View>
  );

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
        }}
        progressiveBlurHeight={
          theme.spacing.xxxl + theme.spacing.xs * 2 + theme.spacing.xl + theme.spacing.sm
        }
        progressiveBlurTopOffset={0}
        progressiveBlur
        overlayHeader={homeToolbar}
        overlayHeaderContentOffset={theme.sizes.touchTargetMinimum}
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

        <View style={[styles.widgetRow, { gap: theme.spacing.sm }]}>
          <PremiumCard
            accessibilityLabel="Abrir Registrar Entrega"
            disablePressAnimation
            onPress={handleOpenRegistrarEntrega}
            style={[
              styles.widgetCard,
              { borderRadius: theme.radius.xl + theme.spacing.sm, padding: theme.spacing.lg },
            ]}
          >
            <View style={styles.widgetHeader}>
              <PreviewIcon color={theme.colors.textSecondary} name="cube-outline" />
              <PreviewIcon color={theme.colors.textSecondary} name="chevron-forward" />
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
            accessibilityLabel="Abrir documentos"
            disablePressAnimation
            onPress={handleOpenDocumentos}
            style={[
              styles.widgetCard,
              {
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
              style={[styles.widgetCopy, { minHeight: theme.typography.headline.lineHeight * 2 }]}
            >
              <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
                {maskText(formatOpenDocumentsLabel(openDocumentsCount))}
              </Text>
            </View>
          </PremiumCard>
        </View>

        <View style={styles.shortcutCards}>
          <View
            style={[
              styles.openPaymentCardContainer,
              {
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.xl + theme.spacing.sm,
                overflow: 'hidden',
                width: '100%',
              },
            ]}
          >
            <AnimatedPressable
              accessibilityLabel="Abrir Fábrica"
              accessibilityRole="button"
              disablePressAnimation
              onPress={handleOpenFactory}
              style={styles.openPaymentContextMenu}
            >
              <View
                style={[
                  styles.openPaymentCard,
                  {
                    backgroundColor: 'transparent',
                    borderRadius: theme.radius.xl + theme.spacing.sm,
                    minHeight: openPaymentCardMinHeight,
                    padding: theme.spacing.md,
                    width: '100%',
                  },
                ]}
              >
                <View
                  style={{
                    alignItems: 'center',
                    flexDirection: 'row',
                    gap: theme.spacing.sm,
                  }}
                >
                  <View style={{ transform: [{ translateY: -2 }] }}>
                    <PreviewIcon
                      color={theme.colors.textSecondary}
                      name="business-outline"
                      size={theme.sizes.iconSmall}
                    />
                  </View>
                  <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
                    Fábrica
                  </Text>
                </View>
                <PreviewIcon color={theme.colors.textSecondary} name="chevron-forward" />
              </View>
            </AnimatedPressable>
          </View>
        </View>

        <TodayDeliveriesCard
          deliveries={todayDeliveries}
          onDelete={handleTodayDeliveryDelete}
          onToggleStatus={handleTodayStatusToggle}
        />

        <View style={[styles.openPaymentsSection, { gap: theme.spacing.md }]}>
          <AnimatedPressable
            accessibilityLabel="Abrir recebimentos em aberto"
            accessibilityRole="button"
            disablePressAnimation
            onPress={handleOpenRecebimentos}
            style={styles.openPaymentsSectionHeader}
          >
            <Text
              style={[
                theme.typography.headline,
                { color: theme.colors.textPrimary, marginLeft: theme.spacing.lg },
              ]}
            >
              Em aberto
            </Text>
            <View
              style={{
                marginRight: theme.spacing.lg,
                transform: [{ translateX: theme.spacing.xxs / 2 + 2 }],
              }}
            >
              <PreviewIcon color={theme.colors.textSecondary} name="chevron-forward" />
            </View>
          </AnimatedPressable>
          {openPaymentClientCards.length > 0 ? (
            <View style={[styles.openPaymentCards, { gap: theme.spacing.xs }]}>
              {openPaymentClientCards.map((client) => (
                <View
                  key={client.nome}
                  style={[
                    styles.openPaymentCardContainer,
                    {
                      backgroundColor: theme.colors.surface,
                      borderRadius: theme.radius.xl + theme.spacing.sm,
                      overflow: 'hidden',
                      minHeight: openPaymentCardMinHeight,
                      width: '100%',
                    },
                  ]}
                >
                  <NativeCardContextMenu
                    actions={client.deliveries.map((delivery) => ({
                      id: `complete-payment-${delivery.id}`,
                      disabled: testModeEnabled,
                      onPress: () => handleOpenPayment(delivery.id),
                      systemImage: 'checkmark.circle.fill' as const,
                      title:
                        client.deliveries.length === 1
                          ? 'Pago'
                          : `Pago · ${formatDateAsDayMonthYear(delivery.data)} · ${maskCurrency(delivery.valor)}`,
                    }))}
                    preview={renderOpenPaymentRow(client, true)}
                    style={[
                      styles.openPaymentContextMenu,
                      {
                        borderRadius: theme.radius.xl + theme.spacing.sm,
                        minHeight: openPaymentCardMinHeight,
                      },
                    ]}
                  >
                    {renderOpenPaymentRow(client)}
                  </NativeCardContextMenu>
                </View>
              ))}
            </View>
          ) : null}
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
  shortcutCards: { width: '100%' },
  openPaymentsSection: { width: '100%' },
  openPaymentsSectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  openPaymentCards: { width: '100%' },
  openPaymentCardContainer: { overflow: 'hidden', width: '100%' },
  openPaymentContextMenu: { width: '100%' },
  openPaymentCard: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  widgetRow: { alignSelf: 'flex-start', flexDirection: 'row' },
  widgetCard: { width: 178 },
  widgetHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  widgetCopy: { gap: 8, marginTop: 12 },
});
