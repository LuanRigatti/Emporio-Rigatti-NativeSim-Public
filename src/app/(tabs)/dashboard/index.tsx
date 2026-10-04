import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ProgressiveCollapsibleScreen } from '@/components/premium';
import { NativeGlassHeader } from '@/components/layout';
import {
  HomeToolbar,
  type HomeModeSelectorController,
  useHomeModeSelector,
} from '@/components/navigation/HomeToolbar';
import { useAppTheme } from '@/theme';
import { useAppMode, useAppSafeAreaInsets } from '@/providers';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';
import HomeModeTitle from '@/features/home/components/HomeModeTitle';
import HomeShortcutCard from '@/features/home/components/HomeShortcutCard';
import HomeModeTitleCompactRN from '@/features/home/components/HomeModeTitleCompactRN';
import { useOpenPaymentClients } from '@/features/open-payments/hooks/useOpenPaymentClients';
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
  const { theme } = useAppTheme();
  const { currency: maskCurrency, text: maskText } = useTestModePresentation();
  const insets = useAppSafeAreaInsets();
  const [currentDate, setCurrentDate] = useState(() => todayIso());
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
  const { totalOpenAmount } = useOpenPaymentClients();
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
  const renderHomeModeTitle = () => (
    <HomeModeTitleCompactRN
      accessibilityLabel={`Alterar modo. Modo atual: ${modeLabel}`}
      label={modeLabel}
      onPress={modeSelector.open}
    />
  );
  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <HomeToolbar modeSelector={modeSelector} onSearchPress={handleOpenSearch} />
      <ProgressiveCollapsibleScreen
        compactTitle={renderHomeModeTitle()}
        compactTitleInteractive
        contentGap={theme.spacing.lg}
        contentTopInset={theme.spacing.xl + theme.spacing.xxl + theme.spacing.xxs * 2 + 2}
        largeTitle={
          <View
            style={[
              styles.paddedHomeContent,
              { gap: theme.spacing.lg, paddingHorizontal: theme.layout.screenHorizontalPadding },
            ]}
          >
            <View style={styles.header}>{homeHeader}</View>
          </View>
        }
        nativeTabRoot
        scrollContentContainerStyle={{
          paddingBottom: theme.layout.tabBarHeight + insets.bottom + theme.spacing.xxxl,
          paddingHorizontal: 0,
        }}
      >
        <View
          style={{
            marginTop: 4,
            paddingHorizontal: theme.layout.screenHorizontalPadding,
          }}
        >
          <View style={[styles.homeShortcutList, { gap: theme.spacing.sm }]}>
            <HomeShortcutCard
              accessibilityLabel="Abrir Registrar Entrega"
              icon={
                <PreviewIcon color={theme.colors.textSecondary} name="cube-outline" size={21} />
              }
              label="Registrar Entrega"
              onPress={handleOpenRegistrarEntrega}
              trailing={<PreviewIcon color={theme.colors.textSecondary} name="chevron-forward" />}
              value={maskText(`${dailyDeliveries.length} hoje`)}
            />
            <HomeShortcutCard
              accessibilityLabel="Abrir recebimentos em aberto"
              icon={<PreviewIcon color={theme.colors.textPrimary} name="cash-outline" size={21} />}
              label="Em aberto"
              onPress={handleOpenRecebimentos}
              trailing={<PreviewIcon color={theme.colors.textSecondary} name="chevron-forward" />}
              value={maskCurrency(totalOpenAmount)}
            />
            <HomeShortcutCard
              accessibilityLabel="Abrir documentos"
              icon={
                <PreviewIcon
                  color={openDocumentsCount > 0 ? theme.colors.warning : theme.colors.textSecondary}
                  name="document-text-outline"
                  size={21}
                />
              }
              label="Documentos"
              onPress={handleOpenDocumentos}
              trailing={<PreviewIcon color={theme.colors.textSecondary} name="chevron-forward" />}
              value={maskText(`${openDocumentsCount} em aberto`)}
            />
            <HomeShortcutCard
              accessibilityLabel="Abrir Fábrica"
              icon={
                <PreviewIcon color={theme.colors.textSecondary} name="business-outline" size={21} />
              }
              label="Fábrica"
              onPress={handleOpenFactory}
              trailing={<PreviewIcon color={theme.colors.textSecondary} name="chevron-forward" />}
              value={
                factoryDataUnavailable ? maskText('Indisponível') : maskCurrency(factoryOpenAmount)
              }
            />
          </View>
        </View>
      </ProgressiveCollapsibleScreen>
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
  homeShortcutList: { width: '100%' },
});
