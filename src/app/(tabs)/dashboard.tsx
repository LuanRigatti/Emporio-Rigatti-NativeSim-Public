import Ionicons from '@expo/vector-icons/Ionicons';
import { useIsFocused, useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PremiumCard, PremiumScreen } from '@/components/premium';
import { NativeGlassHeader } from '@/components/layout';
import { NativeSearchField } from '@/components/native';
import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { TodayDeliveriesCard } from '@/features/home/components/TodayDeliveriesCard';
import { LastRouteCard } from '@/features/home/components/LastRouteCard';
import { FactorySummaryCard } from '@/features/home/components/FactorySummaryCard';
import {
  OpenClientsSummaryCard,
  type OpenClientSummary,
} from '@/features/home/components/OpenClientsSummaryCard';
import { HomeSearchResultsSheet } from '@/features/home/components/HomeSearchResultsSheet';
import { HomeSearchHelpSheet } from '@/features/home/help/HomeSearchHelpSheet';
import { logHomeSearchFlow } from '@/features/home/debug/HomeSearchFlowDebug';
import {
  homeSearchPresentationReducer,
  initialHomeSearchPresentationState,
  isHomeSearchSheetVisible,
} from '@/features/home/hooks/HomeSearchPresentationFlow';
import { useHomeSearch } from '@/features/home/hooks/useHomeSearch';
import { useLatestCompletedRoute } from '@/features/home/hooks/useLatestCompletedRoute';
import { countOpenDocuments, formatOpenDocumentsLabel } from '@/features/invoices';
import { useClients } from '@/hooks/useClients';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useFactoryPurchases } from '@/hooks/useFactoryPurchases';
import { toHistoryDelivery } from '@/services/data';
import { todayIso } from '@/utils/data';

function PreviewIcon({
  color,
  name,
}: {
  color: string;
  name: ComponentProps<typeof Ionicons>['name'];
}) {
  const { theme } = useAppTheme();

  return <Ionicons color={color} name={name} size={theme.sizes.iconMedium} />;
}

export default function Home() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [focusEntryKey, setFocusEntryKey] = useState(0);
  const wasFocused = useRef(false);
  const [currentDate, setCurrentDate] = useState(() => todayIso());
  const [searchText, setSearchText] = useState('');
  const [isHelpSheetVisible, setIsHelpSheetVisible] = useState(false);
  const [searchFlow, dispatchSearchFlow] = useReducer(
    homeSearchPresentationReducer,
    initialHomeSearchPresentationState,
  );
  const activeSearchId = useRef(0);
  const previousSearchPhase = useRef(searchFlow.phase);
  const lastSubmitAt = useRef<number | null>(null);
  const lastTextChangeAt = useRef<number | null>(null);
  const { search: runHomeSearch } = useHomeSearch();
  const latestCompletedRoute = useLatestCompletedRoute();
  const {
    deliveries: dailyDeliveries,
    remove: removeDelivery,
    toggleDelivered: toggleDelivery,
  } = useDeliveries({ mode: 'today', date: currentDate });
  const { deliveries: pendingDeliveries } = useDeliveries({ mode: 'all', status: 'Não Pago' });
  const { loading: factoryPurchasesLoading, purchases: factoryPurchases } = useFactoryPurchases({
    period: 'all',
  });
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
  const historyDeliveries = useMemo(
    () => dailyDeliveries.map(toHistoryDelivery),
    [dailyDeliveries],
  );
  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(todayIso()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const todayDeliveries = useMemo(() => historyDeliveries, [historyDeliveries]);
  const openClientSummaries = useMemo<OpenClientSummary[]>(() => {
    const grouped = new Map<string, OpenClientSummary>();

    for (const delivery of pendingDeliveries) {
      const clientName = delivery.cliente.trim();
      if (!clientName) continue;

      const id = delivery.clientId ?? clientName.toLocaleLowerCase('pt-BR');
      const current = grouped.get(id);
      grouped.set(id, {
        amount: (current?.amount ?? 0) + delivery.valor,
        clientName: current?.clientName ?? clientName,
        id,
      });
    }

    return [...grouped.values()].sort((first, second) =>
      first.clientName.localeCompare(second.clientName, 'pt-BR'),
    );
  }, [pendingDeliveries]);
  const openDocumentsCount = useMemo(
    () => countOpenDocuments(invoiceDeliveries, clients),
    [invoiceDeliveries, clients],
  );

  useEffect(() => {
    if (isFocused && !wasFocused.current) {
      setFocusEntryKey((currentKey) => currentKey + 1);
    }

    wasFocused.current = isFocused;
  }, [isFocused]);

  useEffect(() => {
    if (previousSearchPhase.current === searchFlow.phase) return;

    logHomeSearchFlow('state-transition', {
      searchId: searchFlow.activeSearchId,
      presentationId: searchFlow.presentationId,
      from: previousSearchPhase.current,
      to: searchFlow.phase,
    });
    previousSearchPhase.current = searchFlow.phase;
  }, [searchFlow.activeSearchId, searchFlow.phase, searchFlow.presentationId]);

  useEffect(() => {
    if (searchFlow.phase !== 'resultReady' || !searchFlow.response) return;

    logHomeSearchFlow('content-committed', {
      searchId: searchFlow.activeSearchId,
      resultCount: searchFlow.response.results.length,
    });
    dispatchSearchFlow({ type: 'CONTENT_COMMITTED' });
  }, [searchFlow.activeSearchId, searchFlow.phase, searchFlow.response]);

  useEffect(() => {
    if (searchFlow.phase !== 'readyToPresent') return;

    logHomeSearchFlow('presentation-requested', {
      searchId: searchFlow.activeSearchId,
      presentationId: searchFlow.presentationId + 1,
    });
    dispatchSearchFlow({ type: 'PRESENTATION_REQUESTED' });
  }, [searchFlow.activeSearchId, searchFlow.phase, searchFlow.presentationId]);

  const handleTodayStatusToggle = useCallback(
    (deliveryId: string) => {
      triggerLightImpactHaptic();
      void toggleDelivery(deliveryId);
    },
    [toggleDelivery],
  );

  const handleTodayDeliveryDelete = useCallback(
    (deliveryId: string) => {
      void removeDelivery(deliveryId);
    },
    [removeDelivery],
  );

  const handleSearchTextChange = useCallback((value: string) => {
    const timestampMs = Date.now();
    lastTextChangeAt.current = timestampMs;
    if (lastSubmitAt.current !== null && timestampMs - lastSubmitAt.current < 500) {
      logHomeSearchFlow('text-change-after-submit', {
        searchId: activeSearchId.current,
        elapsedMs: timestampMs - lastSubmitAt.current,
        textLength: value.length,
      });
    }
    setSearchText(value);
  }, []);

  const handleSearchSubmit = useCallback(
    (submittedValue: string) => {
      const searchId = activeSearchId.current + 1;
      const timestampMs = Date.now();
      lastSubmitAt.current = timestampMs;
      const query = submittedValue.trim();
      logHomeSearchFlow('submit-received', {
        searchId,
        queryLength: query.length,
        msSinceTextChange:
          lastTextChangeAt.current === null ? null : timestampMs - lastTextChangeAt.current,
      });
      if (!query) {
        logHomeSearchFlow('submit-ignored-empty', { searchId });
        return;
      }
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

        logHomeSearchFlow('result-ready', {
          searchId,
          resultCount: nextResponse.results.length,
        });
        dispatchSearchFlow({ type: 'RESULT_RECEIVED', response: nextResponse, searchId });
      });
    },
    [runHomeSearch],
  );

  const handleSearchSheetImplementationReady = useCallback(
    (implementation: 'swiftui' | 'fallback') => {
      logHomeSearchFlow('implementation-ready', { implementation });
      dispatchSearchFlow({ type: 'IMPLEMENTATION_READY' });
    },
    [],
  );

  const handleSearchSheetVisibleChange = useCallback(
    (nextVisible: boolean) => {
      logHomeSearchFlow('sheet-visible-change', {
        searchId: searchFlow.activeSearchId,
        presentationId: searchFlow.presentationId,
        visible: nextVisible,
      });
      dispatchSearchFlow({ type: 'NATIVE_VISIBILITY_CHANGED', visible: nextVisible });
    },
    [searchFlow.activeSearchId, searchFlow.presentationId],
  );

  const handlePressHelp = useCallback(() => {
    Keyboard.dismiss();
    setIsHelpSheetVisible(true);
  }, []);

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
    logHomeSearchFlow('dismiss-confirmed', {
      searchId: searchFlow.activeSearchId,
      presentationId: searchFlow.presentationId,
    });
    setSearchText('');
    setFocusEntryKey((currentKey) => currentKey + 1);
    dispatchSearchFlow({ type: 'DISMISS_COMPLETED' });
  }, [searchFlow.activeSearchId, searchFlow.presentationId]);

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

  const handleOpenLastRoute = () => {
    triggerLightImpactHaptic();
    if (latestCompletedRoute?.id) {
      router.push(`/localizacao/${encodeURIComponent(latestCompletedRoute.id)}`);
    } else {
      router.push('/localizacao');
    }
  };

  const homeHeader = (
    <NativeGlassHeader
      includeTopSafeArea={false}
      mode="transparent"
      largeTitle
      title="Home"
      titleStyle={{
        fontFamily: 'System',
        fontSize: 32,
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
          marginTop: theme.spacing.xl + theme.spacing.xxl - theme.spacing.md + theme.spacing.xxs,
          paddingBottom: theme.layout.tabBarHeight + insets.bottom + theme.spacing.xxxl,
        }}
        progressiveBlurHeight={
          theme.spacing.xxxl + theme.spacing.xs * 2 + theme.spacing.xl + theme.spacing.sm
        }
        progressiveBlurTopOffset={0}
        progressiveBlur
      >
        <View style={styles.header}>{homeHeader}</View>

        <View style={{ marginBottom: theme.spacing.xs, marginTop: 0 }}>
          <NativeSearchField
            accessibilityLabel="Buscar clientes, entregas e filtros"
            onChangeText={handleSearchTextChange}
            onPressHelp={handlePressHelp}
            onSubmit={handleSearchSubmit}
            placeholder="Busque clientes, entregas e filtros"
            focusEntryKey={focusEntryKey}
            value={searchText}
          />
        </View>

        {/* <PremiumCard
          style={{
            borderRadius: theme.radius.xl + theme.spacing.sm,
            gap: theme.spacing.sm,
            padding: theme.spacing.xl,
          }}
        >
          <View style={styles.heroHeader}>
            <Text
              style={[
                theme.typography.caption,
                {
                  color:
                    resolvedMode === 'dark'
                      ? theme.colors.textPrimary
                      : theme.colors.contrastSurface,
                },
              ]}
            >
              FATURAMENTO MENSAL
            </Text>
            <PreviewIcon color={theme.colors.revenue} name="trending-up" />
          </View>
          <Text style={[theme.typography.metricLarge, { color: theme.colors.textPrimary }]}>
            R$ 12.540,00
          </Text>
        </PremiumCard> */}

        {/* <PremiumCard
          style={{
            borderRadius: theme.radius.xl + theme.spacing.sm,
            gap: theme.spacing.sm,
            padding: theme.spacing.xl,
          }}
        >
          <View style={styles.heroHeader}>
            <Text
              style={[
                theme.typography.caption,
                {
                  color:
                    resolvedMode === 'dark'
                      ? theme.colors.textPrimary
                      : theme.colors.contrastSurface,
                },
              ]}
            >
              LUCRO LÍQUIDO MENSAL
            </Text>
            <PreviewIcon color={theme.colors.profit} name="trending-up" />
          </View>
          <Text style={[theme.typography.metricLarge, { color: theme.colors.textPrimary }]}>
            R$ 9.840,00
          </Text>
        </PremiumCard> */}

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
                {formatOpenDocumentsLabel(openDocumentsCount)}
              </Text>
            </View>
          </PremiumCard>
        </View>

        <View style={[styles.lowerHomeContent, { gap: theme.spacing.lg }]}>
          <LastRouteCard onPress={handleOpenLastRoute} session={latestCompletedRoute} />

          <View style={[styles.openHomeContent, { gap: theme.spacing.lg }]}>
            <OpenClientsSummaryCard
              clients={openClientSummaries}
              onPress={handleOpenRecebimentos}
            />

            <FactorySummaryCard
              loading={factoryPurchasesLoading}
              onPress={handleOpenFactory}
              purchases={factoryPurchases}
            />

            <TodayDeliveriesCard
              deliveries={todayDeliveries}
              onDelete={handleTodayDeliveryDelete}
              onToggleStatus={handleTodayStatusToggle}
            />
          </View>
        </View>
      </PremiumScreen>
      <HomeSearchResultsSheet
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { alignItems: 'center', minHeight: 44, position: 'relative' },
  pageTitle: { textAlign: 'center' },
  heroHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  lowerHomeContent: { width: '100%' },
  openHomeContent: { width: '100%' },
  widgetRow: { alignSelf: 'flex-start', flexDirection: 'row' },
  widgetCard: { width: 178 },
  widgetHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  widgetCopy: { gap: 8, marginTop: 12 },
});
