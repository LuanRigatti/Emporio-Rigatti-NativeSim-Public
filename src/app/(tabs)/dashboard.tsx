import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PremiumCard, PremiumScreen } from '@/components/premium';
import { NativeGlassHeader } from '@/components/layout';
import { NativeSearchField } from '@/components/native';
import { getNativeCapabilities } from '@/platform/nativeCapabilities';
import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { TabHapticListener } from '@/navigation/TabHapticListener';
import { TodayDeliveriesCard } from '@/features/home/components/TodayDeliveriesCard';
import {
  getHistoryDeliveries,
  subscribeToHistoryDeliveries,
  toggleHistoryDeliveryStatus,
} from '@/features/history/data/historyDeliveryStore';
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
  const { theme } = useAppTheme();
  const useNativeHeaderOverlay = getNativeCapabilities().canUseExpoUI;
  const historyDeliveries = useSyncExternalStore(
    subscribeToHistoryDeliveries,
    getHistoryDeliveries,
    getHistoryDeliveries,
  );
  const [currentDate, setCurrentDate] = useState(() => todayIso());
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(todayIso()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const todayDeliveries = useMemo(
    () => historyDeliveries.filter((delivery) => delivery.data === currentDate),
    [currentDate, historyDeliveries],
  );
  const openPaymentsCount = useMemo(
    () => historyDeliveries.filter((delivery) => delivery.status === 'pendente').length,
    [historyDeliveries],
  );

  const handleTodayStatusToggle = useCallback((deliveryId: string) => {
    triggerLightImpactHaptic();
    toggleHistoryDeliveryStatus(deliveryId);
  }, []);

  const homeHeader = (
    <NativeGlassHeader
      includeTopSafeArea={useNativeHeaderOverlay}
      mode={useNativeHeaderOverlay ? 'translucent' : 'transparent'}
      title="Home"
    />
  );

  return (
    <View style={styles.root}>
      <TabHapticListener />
      <PremiumScreen
        contentContainerStyle={{ gap: theme.spacing.lg, marginTop: -theme.spacing.xs }}
        overlayHeader={useNativeHeaderOverlay ? homeHeader : undefined}
        progressiveBlur
      >
        {!useNativeHeaderOverlay ? <View style={styles.header}>{homeHeader}</View> : null}

        <View style={{ marginBottom: theme.spacing.xs, marginTop: -theme.spacing.xs }}>
          <NativeSearchField
            accessibilityLabel="Buscar clientes, entregas e filtros"
            onChangeText={setSearchText}
            placeholder="Busque clientes, entregas, filtros"
            value={searchText}
          />
        </View>

        <TodayDeliveriesCard
          deliveries={todayDeliveries}
          onToggleStatus={handleTodayStatusToggle}
        />

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
            accessibilityLabel="Abrir recebimentos em aberto"
            onPress={() => router.push('/pagamentos-em-aberto')}
            style={[
              styles.widgetCard,
              { borderRadius: theme.radius.xl + theme.spacing.sm, padding: theme.spacing.lg },
            ]}
          >
            <View style={styles.widgetHeader}>
              <PreviewIcon color={theme.colors.warning} name="alert-circle-outline" />
              <PreviewIcon color={theme.colors.textSecondary} name="chevron-forward" />
            </View>
            <View style={styles.widgetCopy}>
              <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
                {openPaymentsCount} recebimentos em aberto
              </Text>
            </View>
          </PremiumCard>
          <PremiumCard
            accessibilityLabel="Abrir notas fiscais e boletos"
            onPress={() => router.push('/notas-fiscais-boletos')}
            style={[
              styles.widgetCard,
              {
                borderRadius: theme.radius.xl + theme.spacing.sm,
                padding: theme.spacing.lg,
              },
            ]}
          >
            <View style={styles.widgetHeader}>
              <PreviewIcon color={theme.colors.textSecondary} name="document-text-outline" />
              <PreviewIcon color={theme.colors.textSecondary} name="chevron-forward" />
            </View>
            <View style={styles.widgetCopy}>
              <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
                Notas fiscais/boletos
              </Text>
            </View>
          </PremiumCard>
        </View>
      </PremiumScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { alignItems: 'center', minHeight: 44, position: 'relative' },
  pageTitle: { textAlign: 'center' },
  heroHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  widgetRow: { alignSelf: 'flex-start', flexDirection: 'row' },
  widgetCard: { width: 178 },
  widgetHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  widgetCopy: { gap: 8, marginTop: 12 },
});
