import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { NativeGlassHeader } from '@/components/layout';
import {
  NativeGlassBackButton,
  NativeSwipeActionsList,
  type NativeSwipeActionsListItem,
} from '@/components/native';
import { GlassCard, PremiumScreen } from '@/components/premium';
import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';

import { openPaymentPreview, openPaymentsTotal } from '../data/openPaymentPreview';

export function OpenPaymentsScreen() {
  const router = useRouter();
  const { reduceMotionEnabled, theme } = useAppTheme();
  const entrance = useSharedValue(0);
  const [paymentItems, setPaymentItems] = useState(() => [...openPaymentPreview]);

  const nativePaymentItems = useMemo<NativeSwipeActionsListItem[]>(
    () =>
      paymentItems.map((item) => ({
        id: item.client,
        overline: item.date,
        subtitle: `${item.quantity} ${item.quantity === 1 ? 'balde' : 'baldes'}`,
        title: item.client,
        trailingText: item.amount,
      })),
    [paymentItems],
  );

  const handlePaymentSwipe = useCallback((client: string) => {
    triggerLightImpactHaptic();
    setPaymentItems((current) => current.filter((item) => item.client !== client));
  }, []);

  useEffect(() => {
    entrance.value = withTiming(1, {
      duration: reduceMotionEnabled
        ? theme.animations.duration.instant
        : theme.animations.duration.standard,
      easing: Easing.out(Easing.cubic),
    });
  }, [entrance, reduceMotionEnabled, theme]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ translateY: interpolate(entrance.value, [0, 1], [theme.spacing.md, 0]) }],
  }));

  const header = (
    <NativeGlassHeader
      leftActions={
        <NativeGlassBackButton
          accessibilityLabel="Voltar para Home"
          color={theme.colors.textPrimary}
          containerSize={theme.sizes.touchTargetMinimum}
          onPress={() => router.back()}
          size={theme.sizes.iconMedium}
        />
      }
      mode="transparent"
      title="Recebimentos em aberto"
    />
  );

  return (
    <PremiumScreen
      contentContainerStyle={[
        styles.screenContent,
        { gap: theme.spacing.xl, paddingBottom: theme.spacing.xxxl },
      ]}
      overlayHeader={header}
      progressiveBlur
    >
      <Animated.View style={[styles.content, contentStyle, { marginTop: theme.spacing.xxl }]}>
        <View style={[styles.clientList, { gap: theme.spacing.sm }]}>
          {paymentItems.length > 0 ? (
            <GlassCard
              style={[styles.clientCard, { borderRadius: theme.radius.xl + theme.spacing.sm }]}
            >
              <NativeSwipeActionsList
                action={{
                  label: 'Pago',
                  systemImage: 'checkmark.circle.fill',
                  tint: theme.colors.success,
                }}
                colors={{
                  border: theme.colors.borderStrong,
                  selectionContent: theme.colors.selectionContent,
                  selectionSurface: theme.colors.selectionSurface,
                  textPrimary: theme.colors.textPrimary,
                  textSecondary: theme.colors.textSecondary,
                }}
                items={nativePaymentItems}
                onDelete={handlePaymentSwipe}
                trailingValueAlignment="top"
              />
            </GlassCard>
          ) : null}
          <GlassCard
            style={[styles.totalCard, { borderRadius: theme.radius.xl + theme.spacing.sm }]}
          >
            <View style={styles.totalRow}>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                TOTAL EM ABERTO
              </Text>
              <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
                {openPaymentsTotal}
              </Text>
            </View>
          </GlassCard>
        </View>
      </Animated.View>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: { flexGrow: 1 },
  content: { gap: 24 },
  clientList: { width: '100%' },
  clientCard: { padding: 16 },
  totalCard: { padding: 16 },
  totalRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
