import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  GlassButton,
  GlassSurface,
  PremiumCard,
  PremiumScreen,
  type ContextMenuItem,
} from '@/components/premium';
import { useSession } from '@/providers';
import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { TabHapticListener } from '@/navigation/TabHapticListener';

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
  const [isOptionsMenuVisible, setIsOptionsMenuVisible] = useState(false);
  const moreButtonScale = useSharedValue(1);
  const moreButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: moreButtonScale.value }],
  }));

  const animateMoreButton = (toValue: number) => {
    moreButtonScale.value = withSpring(
      reduceMotionEnabled ? 1 : toValue,
      reduceMotionEnabled ? undefined : theme.animations.spring.responsive,
    );
  };
  const optionsExpansion = useSharedValue(0);

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
  const menuItems: readonly ContextMenuItem[] = [
    {
      key: 'logout',
      label: 'Sair da conta',
      icon: 'log-out-outline',
      onPress: () => void handleSignOut(),
      destructive: true,
    },
    {
      key: 'notifications',
      label: 'Notificações',
      icon: 'notifications-outline',
      onPress: () => undefined,
    },
    {
      key: 'theme',
      label: 'Modo escuro/claro',
      icon: resolvedMode === 'dark' ? 'sunny-outline' : 'moon-outline',
      onPress: () => undefined,
    },
    {
      key: 'privacy',
      label: 'Ocultar valores',
      icon: 'eye-off-outline',
      onPress: () => undefined,
    },
  ];

  return (
    <View style={styles.root}>
      <TabHapticListener />
      <PremiumScreen contentContainerStyle={{ gap: theme.spacing.xl }}>
        <View style={styles.header}>
          <Text
            style={[theme.typography.title3, styles.pageTitle, { color: theme.colors.textPrimary }]}
          >
            Home
          </Text>
          <GlassSurface
            style={[
              styles.moreButtonContainer,
              {
                borderRadius: theme.radius.pill,
                minHeight: theme.sizes.touchTargetMinimum,
                minWidth: theme.sizes.touchTargetMinimum,
              },
            ]}
          >
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
                    borderRadius: theme.radius.pill,
                    minHeight: theme.sizes.touchTargetMinimum,
                    minWidth: theme.sizes.touchTargetMinimum,
                  },
                ]}
              >
                <PreviewIcon color={theme.colors.textPrimary} name="ellipsis-horizontal" />
              </Pressable>
            </Animated.View>
          </GlassSurface>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <View style={[styles.actionsRow, { gap: theme.spacing.sm }]}>
            <GlassButton
              accessibilityHint="Ação visual de demonstração"
              icon="add"
              label="Nova entrega"
              onPress={() => undefined}
              variant="contrast"
            />
            <GlassButton
              accessibilityHint="Ação visual de demonstração"
              icon="navigate-outline"
              label="Rota"
              onPress={() => undefined}
            />
          </View>
        </View>

        <PremiumCard
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
        </PremiumCard>

        <PremiumCard
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
        </PremiumCard>

        <PremiumCard
          accessibilityLabel="Abrir pagamentos em aberto"
          onPress={() => router.push('/pagamentos-em-aberto')}
          style={{
            backgroundColor:
              resolvedMode === 'dark' ? theme.colors.surface : theme.colors.warningSurface,
            borderRadius: theme.radius.xl + theme.spacing.sm,
          }}
        >
          <View style={[styles.alertRow, { gap: theme.spacing.sm }]}>
            <PreviewIcon color={theme.colors.warning} name="alert-circle-outline" />
            <View style={[styles.alertContent, { gap: theme.spacing.xs }]}>
              <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
                4 pagamentos pendentes
              </Text>
              <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
                Revise as cobranças em aberto.
              </Text>
            </View>
            <PreviewIcon color={theme.colors.textSecondary} name="chevron-forward" />
          </View>
        </PremiumCard>
      </PremiumScreen>

      <GlassSurface
        style={[
          styles.floatingAction,
          theme.shadows.elevated,
          {
            borderRadius: theme.radius.pill,
            bottom: theme.spacing.lg,
            right: theme.spacing.lg,
          },
        ]}
      >
        <Pressable
          accessibilityHint="Ação visual de demonstração"
          accessibilityLabel="Adicionar entrega"
          accessibilityRole="button"
          onPress={() => undefined}
          style={({ pressed }) => [
            styles.floatingActionButton,
            {
              borderRadius: theme.radius.pill,
              height: theme.sizes.touchTargetMinimum + theme.spacing.sm,
              opacity: pressed ? theme.opacities.pressed : 1,
              width: theme.sizes.touchTargetMinimum + theme.spacing.sm,
            },
          ]}
        >
          <Ionicons color={theme.colors.textPrimary} name="add" size={theme.sizes.iconLarge} />
        </Pressable>
      </GlassSurface>

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
  moreButtonContainer: { position: 'absolute', right: 0 },
  moreButton: { alignItems: 'center', justifyContent: 'center' },
  optionsMenuAnchor: { position: 'absolute', transformOrigin: 'top right', zIndex: 10 },
  optionsMenu: { minWidth: 236, overflow: 'hidden' },
  optionsMenuItem: { alignItems: 'center', flexDirection: 'row' },
  heroHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  actionsRow: { flexDirection: 'row' },
  alertRow: { alignItems: 'center', flexDirection: 'row' },
  alertContent: { flex: 1 },
  floatingAction: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
  },
  floatingActionButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
