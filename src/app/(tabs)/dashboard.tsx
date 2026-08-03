import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  GlassSurface,
  PremiumCard,
  PremiumScreen,
  type ContextMenuItem,
} from '@/components/premium';
import { NativeGlassHeader } from '@/components/layout';
import { NativeGlassMenu, NativeSearchField, type NativeMenuAction } from '@/components/native';
import { getNativeCapabilities } from '@/platform/nativeCapabilities';
import { useSession } from '@/providers';
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
  const insets = useSafeAreaInsets();
  const { isAuthenticated, signOutMock } = useSession();
  const { reduceMotionEnabled, resolvedMode, theme } = useAppTheme();
  const historyDeliveries = useSyncExternalStore(
    subscribeToHistoryDeliveries,
    getHistoryDeliveries,
    getHistoryDeliveries,
  );
  const [currentDate, setCurrentDate] = useState(() => todayIso());
  const useNativeHeaderOverlay = getNativeCapabilities().canUseExpoUI;
  const [isOptionsMenuVisible, setIsOptionsMenuVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const moreButtonScale = useSharedValue(1);
  const moreButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: moreButtonScale.value }],
  }));

  const animateMoreButton = (toValue: number) => {
    moreButtonScale.set(
      withSpring(
        reduceMotionEnabled ? 1 : toValue,
        reduceMotionEnabled ? undefined : theme.animations.spring.responsive,
      ),
    );
  };
  const optionsExpansion = useSharedValue(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(todayIso()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const todayDeliveries = useMemo(
    () => historyDeliveries.filter((delivery) => delivery.data === currentDate),
    [currentDate, historyDeliveries],
  );

  const handleTodayStatusToggle = useCallback((deliveryId: string) => {
    triggerLightImpactHaptic();
    toggleHistoryDeliveryStatus(deliveryId);
  }, []);

  useEffect(() => {
    optionsExpansion.value = isOptionsMenuVisible
      ? reduceMotionEnabled
        ? 1
        : withSpring(1, theme.animations.spring.gentle)
      : 0;
  }, [isOptionsMenuVisible, optionsExpansion, reduceMotionEnabled, theme.animations.spring.gentle]);

  const optionsMenuAnimatedStyle = useAnimatedStyle(() => ({
    opacity: optionsExpansion.value,
    transform: [
      { translateY: (1 - optionsExpansion.value) * -theme.spacing.sm },
      { scale: 0.92 + optionsExpansion.value * 0.08 },
    ],
  }));
  const handleSignOut = useCallback(async () => {
    if (!isAuthenticated) return;

    await signOutMock();
    router.replace('/login');
  }, [isAuthenticated, router, signOutMock]);
  const menuItems: readonly (ContextMenuItem & { systemImage: string })[] = [
    {
      key: 'logout',
      label: 'Sair da conta',
      icon: 'log-out-outline',
      systemImage: 'rectangle.portrait.and.arrow.right',
      onPress: () => void handleSignOut(),
      destructive: true,
    },
    {
      key: 'notifications',
      label: 'Notificações',
      icon: 'notifications-outline',
      systemImage: 'bell',
      onPress: () => undefined,
    },
    {
      key: 'theme',
      label: 'Modo escuro/claro',
      icon: resolvedMode === 'dark' ? 'sunny-outline' : 'moon-outline',
      systemImage: resolvedMode === 'dark' ? 'sun.max' : 'moon',
      onPress: () => undefined,
    },
    {
      key: 'privacy',
      label: 'Ocultar valores',
      icon: 'eye-off-outline',
      systemImage: 'eye.slash',
      onPress: () => undefined,
    },
  ];
  const nativeMenuActions: readonly NativeMenuAction[] = menuItems.map((item) => ({
    id: item.key,
    title: item.label,
    systemImage: item.systemImage,
    onPress: item.onPress,
    destructive: item.destructive,
    disabled: item.disabled,
  }));
  const handleNativeMenuReady = useCallback(() => setIsOptionsMenuVisible(false), []);
  const homeHeader = (
    <NativeGlassHeader
      includeTopSafeArea={useNativeHeaderOverlay}
      mode={useNativeHeaderOverlay ? 'translucent' : 'transparent'}
      rightActions={
        <NativeGlassMenu
          accessibilityLabel="Mais opções da Home"
          actions={nativeMenuActions}
          color={theme.colors.textPrimary}
          containerSize={theme.sizes.touchTargetMinimum}
          fallbackIcon="ellipsis-horizontal"
          onImplementationReady={handleNativeMenuReady}
          size={theme.sizes.iconMedium}
          systemImage="ellipsis"
          trigger={
            <Animated.View style={moreButtonAnimatedStyle}>
              <Pressable
                accessibilityLabel="Mais opções da Home"
                accessibilityRole="button"
                onPress={() => {
                  triggerLightImpactHaptic();
                  setIsOptionsMenuVisible(true);
                }}
                onPressIn={() => animateMoreButton(theme.animations.scale.pressed)}
                onPressOut={() => animateMoreButton(1)}
                style={({ pressed }) => [
                  styles.moreButton,
                  {
                    backgroundColor: pressed ? theme.colors.glassBorder : 'transparent',
                    borderRadius: theme.sizes.touchTargetMinimum / 2,
                    height: theme.sizes.touchTargetMinimum,
                    width: theme.sizes.touchTargetMinimum,
                  },
                ]}
              >
                <PreviewIcon color={theme.colors.textPrimary} name="ellipsis-horizontal" />
              </Pressable>
            </Animated.View>
          }
        />
      }
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
                4 recebimentos em aberto
              </Text>
            </View>
          </PremiumCard>
          <PremiumCard
            accessibilityLabel="Abrir notas fiscais e boletos"
            onPress={() => router.push('/notas-fiscais-boletos')}
            style={[
              styles.widgetCard,
              { borderRadius: theme.radius.xl + theme.spacing.sm, padding: theme.spacing.lg },
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

      {isOptionsMenuVisible ? (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <Pressable
            accessibilityLabel="Fechar opções"
            accessibilityRole="button"
            onPress={() => setIsOptionsMenuVisible(false)}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View
            style={[
              styles.optionsMenuAnchor,
              optionsMenuAnimatedStyle,
              {
                right: theme.layout.screenHorizontalPadding,
                top: insets.top + theme.sizes.touchTargetMinimum + theme.spacing.xs,
              },
            ]}
          >
            <GlassSurface
              interactive
              style={[
                styles.optionsMenu,
                theme.shadows.elevated,
                {
                  backgroundColor: theme.colors.glassSurface,
                  borderColor: theme.colors.glassBorder,
                  borderRadius: theme.radius.lg,
                  padding: theme.spacing.xs,
                },
              ]}
            >
              {menuItems.map((item) => (
                <Pressable
                  accessibilityLabel={item.label}
                  accessibilityRole="button"
                  key={item.key}
                  onPress={() => {
                    item.onPress();
                    setIsOptionsMenuVisible(false);
                  }}
                  style={({ pressed }) => [
                    styles.optionsMenuItem,
                    {
                      backgroundColor: pressed ? theme.colors.glassBorder : 'transparent',
                      borderRadius: theme.radius.md,
                      minHeight: theme.sizes.touchTargetMinimum,
                      paddingHorizontal: theme.spacing.sm,
                    },
                  ]}
                >
                  <Ionicons
                    color={item.destructive ? theme.colors.danger : theme.colors.textSecondary}
                    name={item.icon ?? 'ellipse-outline'}
                    size={theme.sizes.iconMedium}
                  />
                  <Text
                    style={[
                      theme.typography.callout,
                      {
                        color: item.destructive ? theme.colors.danger : theme.colors.textPrimary,
                        marginLeft: theme.spacing.sm,
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </GlassSurface>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { alignItems: 'center', minHeight: 44, position: 'relative' },
  pageTitle: { textAlign: 'center' },
  moreButton: { alignItems: 'center', justifyContent: 'center' },
  optionsMenuAnchor: { position: 'absolute', transformOrigin: 'top right', zIndex: 10 },
  optionsMenu: { minWidth: 236, overflow: 'hidden' },
  optionsMenuItem: { alignItems: 'center', flexDirection: 'row' },
  heroHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  widgetRow: { alignSelf: 'flex-start', flexDirection: 'row' },
  widgetCard: { width: 178 },
  widgetHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  widgetCopy: { gap: 8, marginTop: 12 },
});
