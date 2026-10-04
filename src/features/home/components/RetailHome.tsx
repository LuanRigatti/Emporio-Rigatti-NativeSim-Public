import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { HomeToolbar, type HomeModeSelectorController } from '@/components/navigation/HomeToolbar';
import { PremiumCard, ProgressiveCollapsibleScreen } from '@/components/premium';
import { useAppSafeAreaInsets } from '@/providers';
import { getCardSurfaceColor, useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';
import HomeModeTitleCompactRN from './HomeModeTitleCompactRN';
import HomeModeTitle from './HomeModeTitle';
import HomeShortcutCard from './HomeShortcutCard';

import { useRetailHomeMetrics } from '@/hooks/useRetailHomeMetrics';

function metricValue(
  value: number | null,
  maskCurrency: (value: number) => string,
  loading: boolean,
  error?: string,
): string {
  if (value !== null) return maskCurrency(value);
  if (loading) return 'Carregando…';
  return error ? 'Indisponível' : '—';
}

export function RetailHome({ modeSelector }: { modeSelector: HomeModeSelectorController }) {
  const router = useRouter();
  const { resolvedMode, theme } = useAppTheme();
  const insets = useAppSafeAreaInsets();
  const { currency: maskCurrency } = useTestModePresentation();
  const metrics = useRetailHomeMetrics();
  const homeCardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surface);
  const modeLabel = modeSelector.mode === 'retail' ? 'Varejo' : 'Atacado';

  const handleOpenRegistrar = useCallback(() => {
    triggerLightImpactHaptic();
    router.push('/registrar-pedido-varejo');
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

  const metricsUnavailable = Boolean(metrics.error && !metrics.hasData);
  const loadingValue = metrics.loading || metrics.refreshing;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <HomeToolbar modeSelector={modeSelector} />
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
          <View style={[styles.shortcutList, { gap: theme.spacing.sm }]}>
            <HomeShortcutCard
              accessibilityLabel="Abrir Registrar Pedido Varejo"
              icon={<Ionicons color={theme.colors.textSecondary} name="cart-outline" size={21} />}
              label="Registrar Pedido"
              onPress={handleOpenRegistrar}
              trailing={
                <Ionicons color={theme.colors.textSecondary} name="chevron-forward" size={21} />
              }
              value="Novo pedido"
            />
            <HomeShortcutCard
              icon={<Ionicons color={theme.colors.textSecondary} name="cash-outline" size={21} />}
              label="A receber"
              value={metricValue(metrics.receivable, maskCurrency, loadingValue, metrics.error)}
            />
            <HomeShortcutCard
              icon={
                <Ionicons color={theme.colors.textSecondary} name="trending-up-outline" size={21} />
              }
              label="Faturamento hoje"
              value={metricValue(metrics.todayRevenue, maskCurrency, loadingValue, metrics.error)}
            />
            <HomeShortcutCard
              icon={
                <Ionicons color={theme.colors.textSecondary} name="bar-chart-outline" size={21} />
              }
              label="Lucro hoje"
              value={metricValue(metrics.todayProfit, maskCurrency, loadingValue, metrics.error)}
            />
          </View>
        </View>

        {metricsUnavailable ? (
          <View style={{ paddingHorizontal: theme.layout.screenHorizontalPadding }}>
            <PremiumCard
              accessibilityLabel="Tentar carregar dados do Varejo"
              onPress={metrics.reload}
              style={[styles.errorCard, { backgroundColor: homeCardSurface }]}
            >
              <Text style={[theme.typography.body, { color: theme.colors.danger }]}>
                {metrics.error}
              </Text>
              <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
                Toque para tentar novamente.
              </Text>
            </PremiumCard>
          </View>
        ) : null}
      </ProgressiveCollapsibleScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  errorCard: { gap: 6, width: '100%' },
  header: { alignItems: 'center', minHeight: 44, position: 'relative' },
  paddedHomeContent: { width: '100%' },
  root: { flex: 1 },
  shortcutList: { width: '100%' },
});
