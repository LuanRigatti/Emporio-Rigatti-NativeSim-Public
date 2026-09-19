import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { HomeToolbar } from '@/components/navigation/HomeToolbar';
import { AnimatedPressable, PremiumCard, PremiumScreen } from '@/components/premium';
import { HomeProfileSheet } from '@/features/home/profile/HomeProfileSheet';
import { useAppSafeAreaInsets, useAuth } from '@/providers';
import { getCardSurfaceColor, useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import { useRetailHomeMetrics } from '@/hooks/useRetailHomeMetrics';
import { RetailTodayOrdersCard } from './RetailTodayOrdersCard';

type RetailMetricRowProps = {
  accessibilityLabel?: string;
  iconName: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress?: () => void;
  value: string;
};

function RetailMetricRow({
  accessibilityLabel,
  iconName,
  label,
  onPress,
  value,
}: RetailMetricRowProps) {
  const { theme } = useAppTheme();
  const content = (
    <>
      <View
        style={[
          styles.shortcutIcon,
          { backgroundColor: theme.colors.background, borderRadius: theme.radius.pill },
        ]}
      >
        <Ionicons color={theme.colors.textSecondary} name={iconName} size={21} />
      </View>
      <View style={[styles.shortcutCopy, { gap: theme.spacing.xxs }]}>
        <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
          {label}
        </Text>
        <Text
          numberOfLines={1}
          style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}
        >
          {value}
        </Text>
      </View>
      {onPress ? (
        <Ionicons color={theme.colors.textSecondary} name="chevron-forward" size={21} />
      ) : null}
    </>
  );

  if (!onPress) {
    return <View style={styles.shortcutRow}>{content}</View>;
  }

  return (
    <AnimatedPressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      containerStyle={styles.shortcutRowContainer}
      onPress={onPress}
      style={styles.shortcutRow}
    >
      {content}
    </AnimatedPressable>
  );
}

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

export function RetailHome() {
  const router = useRouter();
  const { user } = useAuth();
  const { resolvedMode, theme } = useAppTheme();
  const insets = useAppSafeAreaInsets();
  const { currency: maskCurrency } = useTestModePresentation();
  const metrics = useRetailHomeMetrics();
  const [isProfileSheetVisible, setIsProfileSheetVisible] = useState(false);
  const homeCardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surface);

  const handleOpenRegistrar = useCallback(() => {
    triggerLightImpactHaptic();
    router.push('/registrar-pedido-varejo');
  }, [router]);

  const handleOpenOrder = useCallback(
    (orderId: string) => {
      triggerLightImpactHaptic();
      router.push({ pathname: '/pedido-varejo/[orderId]', params: { orderId } });
    },
    [router],
  );

  const handleOpenProfile = useCallback(() => {
    setIsProfileSheetVisible(true);
  }, []);

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

  const metricsUnavailable = Boolean(metrics.error && !metrics.hasData);
  const loadingValue = metrics.loading || metrics.refreshing;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <HomeToolbar
        foregroundColor={theme.colors.textPrimary}
        imageUri={user?.photoUrl}
        name={user?.displayName?.trim() || 'Conta'}
        onProfilePress={handleOpenProfile}
        showSearch={false}
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
              styles.shortcutCard,
              {
                backgroundColor: homeCardSurface,
                borderRadius: theme.radius.xl + theme.spacing.md,
                padding: theme.spacing.lg,
              },
            ]}
          >
            <View style={[styles.shortcutList, { gap: theme.spacing.xl }]}>
              <RetailMetricRow
                accessibilityLabel="Abrir Registrar Pedido Varejo"
                iconName="cart-outline"
                label="Registrar Pedido"
                onPress={handleOpenRegistrar}
                value="Novo pedido"
              />
              <RetailMetricRow
                iconName="cash-outline"
                label="A receber"
                value={metricValue(metrics.receivable, maskCurrency, loadingValue, metrics.error)}
              />
              <RetailMetricRow
                iconName="trending-up-outline"
                label="Faturamento hoje"
                value={metricValue(metrics.todayRevenue, maskCurrency, loadingValue, metrics.error)}
              />
              <RetailMetricRow
                iconName="bar-chart-outline"
                label="Lucro hoje"
                value={metricValue(metrics.todayProfit, maskCurrency, loadingValue, metrics.error)}
              />
            </View>
          </PremiumCard>
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

        {metrics.todayOrders.length > 0 ? (
          <View style={{ paddingHorizontal: theme.layout.screenHorizontalPadding }}>
            <RetailTodayOrdersCard
              cardSurfaceColor={homeCardSurface}
              onOrderPress={handleOpenOrder}
              orders={metrics.todayOrders}
            />
          </View>
        ) : null}
      </PremiumScreen>
      <HomeProfileSheet
        onVisibleChange={setIsProfileSheetVisible}
        visible={isProfileSheetVisible}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  errorCard: { gap: 6, width: '100%' },
  header: { alignItems: 'center', minHeight: 44, position: 'relative' },
  paddedHomeContent: { width: '100%' },
  root: { flex: 1 },
  shortcutCard: { width: '100%' },
  shortcutCopy: { flex: 1, marginLeft: 12, marginRight: 12 },
  shortcutIcon: { alignItems: 'center', height: 54, justifyContent: 'center', width: 54 },
  shortcutList: { width: '100%' },
  shortcutRow: { alignItems: 'center', flexDirection: 'row', minHeight: 54, width: '100%' },
  shortcutRowContainer: { width: '100%' },
});
