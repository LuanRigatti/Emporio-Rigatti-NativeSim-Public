import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PremiumCard, PremiumScreen } from '@/components/premium';
import { NativeGlassHeader } from '@/components/layout';
import { NativeAvatarButton, NativeGlassIconButton } from '@/components/native';
import { getCardSurfaceColor, getLiquidGlassTint, useAppTheme } from '@/theme';
import { useAppSafeAreaInsets, useAuth } from '@/providers';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';
import { TodayDeliveriesCard } from '@/features/home/components/TodayDeliveriesCard';
import { useOpenPaymentClients } from '@/features/open-payments/hooks/useOpenPaymentClients';
import { HomeProfileSheet } from '@/features/home/profile/HomeProfileSheet';
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
  const { resolvedMode, theme } = useAppTheme();
  const homeCardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surface);
  const { user } = useAuth();
  const {
    currency: maskCurrency,
    enabled: testModeEnabled,
    text: maskText,
  } = useTestModePresentation();
  const insets = useAppSafeAreaInsets();
  const [currentDate, setCurrentDate] = useState(() => todayIso());
  const [isProfileSheetVisible, setIsProfileSheetVisible] = useState(false);
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

  const handleOpenSearch = useCallback(() => {
    triggerLightImpactHaptic();
    router.push('/pesquisa');
  }, [router]);

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
      leftActions={
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
      mode="transparent"
      rightActions={
        <NativeGlassIconButton
          accessibilityLabel="Abrir Pesquisa"
          color={theme.colors.textPrimary}
          containerSize={theme.sizes.touchTargetMinimum}
          fallbackIcon="search"
          glassTint={getLiquidGlassTint(resolvedMode)}
          interactiveGlass
          onPress={handleOpenSearch}
          size={theme.sizes.iconMedium}
          systemImage="magnifyingglass"
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
  widgetCarousel: { flexGrow: 0, transform: [{ translateY: 4 }], width: '100%' },
  widgetRow: { alignSelf: 'flex-start', flexDirection: 'row' },
  widgetCard: { width: 178 },
  widgetHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  widgetCopy: { gap: 8, marginTop: 12 },
});
