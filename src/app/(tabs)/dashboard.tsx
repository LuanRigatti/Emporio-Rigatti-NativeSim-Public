import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  GlassButton,
  GlassSurface,
  PremiumCard,
  PremiumScreen,
  PremiumSection,
  type ContextMenuItem,
} from '@/components/premium';
import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';

type OpenPaymentPreview = {
  client: string;
  quantity: string;
  pendingDeliveries: string;
  amount: string;
};

const openPaymentPreview: readonly OpenPaymentPreview[] = [
  { client: 'Elias', quantity: '6 baldes', pendingDeliveries: '2 entr.', amount: 'R$ 298,80' },
  {
    client: 'Guilherme',
    quantity: '4 baldes',
    pendingDeliveries: '1 entr.',
    amount: 'R$ 194,00',
  },
  { client: 'Aldo', quantity: '3 baldes', pendingDeliveries: '1 entr.', amount: 'R$ 156,00' },
  { client: 'Rafael', quantity: '4 baldes', pendingDeliveries: '1 entr.', amount: 'R$ 124,00' },
  { client: 'Sofia', quantity: '3 baldes', pendingDeliveries: '1 entr.', amount: 'R$ 130,00' },
];

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

function OpenPaymentRow({ item }: { item: OpenPaymentPreview }) {
  const { theme } = useAppTheme();

  return (
    <View
      style={[
        styles.openPaymentRow,
        {
          gap: theme.spacing.sm,
          minHeight: theme.sizes.touchTargetMinimum + theme.spacing.sm,
        },
      ]}
    >
      <View
        style={[
          styles.openPaymentIcon,
          {
            backgroundColor: theme.colors.dangerSurface,
            borderRadius: theme.radius.md,
            height: theme.sizes.touchTargetMinimum,
            width: theme.sizes.touchTargetMinimum,
          },
        ]}
      >
        <PreviewIcon color={theme.colors.danger} name="alert-outline" />
      </View>
      <View style={[styles.openPaymentContent, { gap: theme.spacing.xxs }]}>
        <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
          {item.client}
        </Text>
        <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
          {item.quantity} ·{' '}
          <Text style={{ color: theme.colors.danger }}>{item.pendingDeliveries}</Text>
        </Text>
      </View>
      <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
        {item.amount}
      </Text>
    </View>
  );
}

export default function Home() {
  const insets = useSafeAreaInsets();
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
  const menuItems: readonly ContextMenuItem[] = [
    {
      key: 'logout',
      label: 'Sair da conta',
      icon: 'log-out-outline',
      onPress: () => undefined,
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
      <PremiumScreen contentContainerStyle={{ gap: theme.spacing.xxl }}>
        <View style={styles.header}>
          <View>
            <Text
              style={[
                theme.typography.largeTitle,
                {
                  color: theme.colors.textPrimary,
                  fontSize:
                    (theme.typography.largeTitle.fontSize ?? theme.spacing.xxl) +
                    theme.spacing.xxs / 2,
                  lineHeight:
                    (theme.typography.largeTitle.lineHeight ?? theme.spacing.xxxl) +
                    theme.spacing.xxs / 2,
                },
              ]}
            >
              Home
            </Text>
          </View>
          <GlassSurface
            style={[
              styles.moreButton,
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

        <PremiumSection title="Ações rápidas">
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
          <GlassButton
            accessibilityHint="Ação visual de demonstração"
            icon="receipt-outline"
            label="Gasto do dia"
            onPress={() => undefined}
          />
        </PremiumSection>

        {process.env.NODE_ENV !== 'production' ? (
          <Link
            accessibilityLabel="Abrir showcase de componentes nativos"
            href="/dev/native-components-showcase"
            style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}
          >
            Native Components Showcase
          </Link>
        ) : null}

        <PremiumCard
          style={{ borderRadius: theme.radius.xl + theme.spacing.sm, gap: theme.spacing.sm }}
        >
          <View style={styles.heroHeader}>
            <Text style={[theme.typography.subheadline, { color: theme.colors.textSecondary }]}>
              FATURAMENTO MENSAL
            </Text>
            <PreviewIcon color={theme.colors.revenue} name="trending-up" />
          </View>
          <Text style={[theme.typography.metricLarge, { color: theme.colors.textPrimary }]}>
            R$ 12.540,00
          </Text>
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            Julho de 2026
          </Text>
        </PremiumCard>

        <PremiumCard
          style={{ borderRadius: theme.radius.xl + theme.spacing.sm, gap: theme.spacing.sm }}
        >
          <View style={styles.heroHeader}>
            <Text style={[theme.typography.subheadline, { color: theme.colors.textSecondary }]}>
              LUCRO LÍQUIDO MENSAL
            </Text>
            <PreviewIcon color={theme.colors.profit} name="trending-up" />
          </View>
          <Text style={[theme.typography.metricLarge, { color: theme.colors.textPrimary }]}>
            R$ 9.840,00
          </Text>
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            Após custos do período
          </Text>
        </PremiumCard>

        <PremiumCard
          style={{ borderRadius: theme.radius.xl + theme.spacing.sm, gap: theme.spacing.md }}
        >
          <View style={styles.openPaymentHeader}>
            <Text style={[theme.typography.caption, { color: theme.colors.textPrimary }]}>
              PAGAMENTOS EM ABERTO
            </Text>
            <Text style={[theme.typography.headline, { color: theme.colors.danger }]}>
              R$ 902,80
            </Text>
          </View>
          <ScrollView
            contentContainerStyle={{ gap: theme.spacing.xs }}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: theme.sizes.touchTargetMinimum * 4 }}
          >
            {openPaymentPreview.map((item) => (
              <OpenPaymentRow item={item} key={item.client} />
            ))}
          </ScrollView>
        </PremiumCard>

        <PremiumSection title="Alertas">
          <PremiumCard
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
        </PremiumSection>
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
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  moreButton: { alignItems: 'center', justifyContent: 'center' },
  optionsMenuAnchor: { position: 'absolute', transformOrigin: 'top right', zIndex: 10 },
  optionsMenu: { minWidth: 236, overflow: 'hidden' },
  optionsMenuItem: { alignItems: 'center', flexDirection: 'row' },
  heroHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  actionsRow: { flexDirection: 'row' },
  alertRow: { alignItems: 'center', flexDirection: 'row' },
  alertContent: { flex: 1 },
  openPaymentHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  openPaymentRow: { alignItems: 'center', flexDirection: 'row' },
  openPaymentIcon: { alignItems: 'center', justifyContent: 'center' },
  openPaymentContent: { flex: 1 },
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
