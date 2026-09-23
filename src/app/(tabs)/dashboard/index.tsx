import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable, PremiumCard, PremiumScreen } from '@/components/premium';
import { NativeGlassHeader } from '@/components/layout';
import {
  HomeToolbar,
  type HomeModeSelectorController,
  useHomeModeSelector,
} from '@/components/navigation/HomeToolbar';
import { getCardSurfaceColor, useAppTheme } from '@/theme';
import { useAppMode, useAppSafeAreaInsets, useAuth } from '@/providers';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';
import HomeModeTitle from '@/features/home/components/HomeModeTitle';
import { useOpenPaymentClients } from '@/features/open-payments/hooks/useOpenPaymentClients';
import { HomeProfileSheet } from '@/features/home/profile/HomeProfileSheet';
import { countOpenDocuments } from '@/features/invoices';
import { useClients } from '@/hooks/useClients';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useFactoryPurchases } from '@/hooks/useFactoryPurchases';
import { factoryPurchaseCalculationService } from '@/services/factory-purchases';
import { todayIso } from '@/utils/data';
import { RetailHome } from '@/features/home/components/RetailHome';

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

function WholesaleHome({ modeSelector }: { modeSelector: HomeModeSelectorController }) {
  const router = useRouter();
  const { user } = useAuth();
  const { resolvedMode, theme } = useAppTheme();
  const homeCardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surface);
  const { currency: maskCurrency, text: maskText } = useTestModePresentation();
  const insets = useAppSafeAreaInsets();
  const [currentDate, setCurrentDate] = useState(() => todayIso());
  const [isProfileSheetVisible, setIsProfileSheetVisible] = useState(false);
  const { deliveries: dailyDeliveries } = useDeliveries({ mode: 'today', date: currentDate });
  const { clients } = useClients();
  const { dataUnavailable: factoryDataUnavailable, purchases: factoryPurchases } =
    useFactoryPurchases();
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
  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(todayIso()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const modeLabel = modeSelector.mode === 'retail' ? 'Varejo' : 'Atacado';
  const openDocumentsCount = useMemo(
    () => countOpenDocuments(invoiceDeliveries, clients),
    [invoiceDeliveries, clients],
  );
  const factoryOpenAmount = useMemo(
    () => factoryPurchaseCalculationService.summarize(factoryPurchases).openValue,
    [factoryPurchases],
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

  const homeHeader = (
    <NativeGlassHeader
      includeTopSafeArea={false}
      mode="transparent"
      largeTitle
      title={
        <HomeModeTitle
          accessibilityLabel={`Alterar modo. Modo atual: ${modeLabel}`}
          label={modeLabel}
          onPress={modeSelector.open}
        />
      }
    />
  );
  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <HomeToolbar
        foregroundColor={theme.colors.textPrimary}
        imageUri={user?.photoUrl}
        modeSelector={modeSelector}
        name={user?.displayName?.trim() || 'Conta'}
        onProfilePress={handleOpenProfile}
        onSearchPress={handleOpenSearch}
      />
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
      >
        <View
          style={[
            styles.paddedHomeContent,
            { gap: theme.spacing.lg, paddingHorizontal: theme.layout.screenHorizontalPadding },
          ]}
        >
          <View style={styles.header}>{homeHeader}</View>
        </View>

        <View
          style={{
            marginTop: 4,
            paddingHorizontal: theme.layout.screenHorizontalPadding,
          }}
        >
          <PremiumCard
            style={[
              styles.homeShortcutCard,
              {
                backgroundColor: homeCardSurface,
                borderRadius: theme.radius.xl + theme.spacing.md,
                padding: theme.spacing.lg,
              },
            ]}
          >
            <View style={[styles.homeShortcutList, { gap: theme.spacing.xl }]}>
              <AnimatedPressable
                accessibilityLabel="Abrir Registrar Entrega"
                accessibilityRole="button"
                containerStyle={styles.homeShortcutRowContainer}
                onPress={handleOpenRegistrarEntrega}
                style={styles.homeShortcutRow}
              >
                <View
                  style={[styles.homeShortcutIcon, { backgroundColor: theme.colors.background }]}
                >
                  <PreviewIcon color={theme.colors.textSecondary} name="cube-outline" size={21} />
                </View>
                <View
                  style={[
                    styles.homeShortcutCopy,
                    {
                      gap: theme.spacing.xxs,
                      marginLeft: theme.spacing.sm,
                      marginRight: theme.spacing.sm,
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
                <PreviewIcon color={theme.colors.textSecondary} name="chevron-forward" />
              </AnimatedPressable>
              <AnimatedPressable
                accessibilityLabel="Abrir recebimentos em aberto"
                accessibilityRole="button"
                containerStyle={styles.homeShortcutRowContainer}
                onPress={handleOpenRecebimentos}
                style={styles.homeShortcutRow}
              >
                <View
                  style={[styles.homeShortcutIcon, { backgroundColor: theme.colors.background }]}
                >
                  <PreviewIcon
                    color={
                      openPaymentClientCards.length > 0
                        ? theme.colors.danger
                        : theme.colors.textSecondary
                    }
                    name="cash-outline"
                    size={21}
                  />
                </View>
                <View
                  style={[
                    styles.homeShortcutCopy,
                    {
                      gap: theme.spacing.xxs,
                      marginLeft: theme.spacing.sm,
                      marginRight: theme.spacing.sm,
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
                <PreviewIcon color={theme.colors.textSecondary} name="chevron-forward" />
              </AnimatedPressable>
              <AnimatedPressable
                accessibilityLabel="Abrir documentos"
                accessibilityRole="button"
                containerStyle={styles.homeShortcutRowContainer}
                onPress={handleOpenDocumentos}
                style={styles.homeShortcutRow}
              >
                <View
                  style={[styles.homeShortcutIcon, { backgroundColor: theme.colors.background }]}
                >
                  <PreviewIcon
                    color={
                      openDocumentsCount > 0 ? theme.colors.warning : theme.colors.textSecondary
                    }
                    name="document-text-outline"
                    size={21}
                  />
                </View>
                <View
                  style={[
                    styles.homeShortcutCopy,
                    {
                      gap: theme.spacing.xxs,
                      marginLeft: theme.spacing.sm,
                      marginRight: theme.spacing.sm,
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
                <PreviewIcon color={theme.colors.textSecondary} name="chevron-forward" />
              </AnimatedPressable>
              <AnimatedPressable
                accessibilityLabel="Abrir Fábrica"
                accessibilityRole="button"
                containerStyle={styles.homeShortcutRowContainer}
                onPress={handleOpenFactory}
                style={styles.homeShortcutRow}
              >
                <View
                  style={[styles.homeShortcutIcon, { backgroundColor: theme.colors.background }]}
                >
                  <PreviewIcon
                    color={theme.colors.textSecondary}
                    name="business-outline"
                    size={21}
                  />
                </View>
                <View
                  style={[
                    styles.homeShortcutCopy,
                    {
                      gap: theme.spacing.xxs,
                      marginLeft: theme.spacing.sm,
                      marginRight: theme.spacing.sm,
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
                    {factoryDataUnavailable
                      ? maskText('Indisponível')
                      : maskCurrency(factoryOpenAmount)}
                  </Text>
                </View>
                <PreviewIcon color={theme.colors.textSecondary} name="chevron-forward" />
              </AnimatedPressable>
            </View>
          </PremiumCard>
        </View>
      </PremiumScreen>
      <HomeProfileSheet
        onVisibleChange={setIsProfileSheetVisible}
        visible={isProfileSheetVisible}
      />
    </View>
  );
}

export default function DashboardRoute() {
  const { isReady, mode } = useAppMode();
  const modeSelector = useHomeModeSelector();
  if (!isReady) return null;
  return mode === 'retail' ? (
    <RetailHome modeSelector={modeSelector} />
  ) : (
    <WholesaleHome modeSelector={modeSelector} />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { alignItems: 'center', minHeight: 44, position: 'relative' },
  paddedHomeContent: { width: '100%' },
  homeShortcutCard: { width: '100%' },
  homeShortcutList: { width: '100%' },
  homeShortcutRowContainer: { width: '100%' },
  homeShortcutRow: { alignItems: 'center', flexDirection: 'row', minHeight: 54, width: '100%' },
  homeShortcutIcon: {
    alignItems: 'center',
    borderRadius: 27,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  homeShortcutCopy: { flex: 1 },
});
