import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { NativeGlassBackButton } from '@/components/native';
import { GlassCard, PremiumScreen } from '@/components/premium';
import { useAppTheme } from '@/theme';

import { OpenPaymentRow } from './OpenPaymentRow';
import { openPaymentPreview, openPaymentsTotal } from '../data/openPaymentPreview';

export function OpenPaymentsScreen() {
  const router = useRouter();
  const { reduceMotionEnabled, theme } = useAppTheme();
  const entrance = useSharedValue(0);

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

  return (
    <PremiumScreen
      contentContainerStyle={[
        styles.screenContent,
        { gap: theme.spacing.xl, paddingBottom: theme.spacing.xxxl },
      ]}
    >
      <Animated.View style={[styles.content, contentStyle]}>
        <View style={styles.header}>
          <NativeGlassBackButton
            accessibilityLabel="Voltar para Home"
            color={theme.colors.textPrimary}
            containerSize={theme.sizes.touchTargetMinimum}
            onPress={() => router.back()}
            size={theme.sizes.iconMedium}
          />
          <View pointerEvents="none" style={styles.headerCopy}>
            <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
              Recebimentos em aberto
            </Text>
          </View>
        </View>

        <GlassCard
          style={[styles.summaryCard, { borderRadius: theme.radius.xl + theme.spacing.sm }]}
        >
          <View style={styles.summaryRow}>
            <View style={styles.summaryCopy}>
              <Text style={[theme.typography.caption, { color: theme.colors.textPrimary }]}>
                TOTAL EM ABERTO
              </Text>
            </View>
            <Text
              style={[
                theme.typography.metricMedium,
                { color: theme.colors.textPrimary, fontSize: 22, lineHeight: 28 },
              ]}
            >
              {openPaymentsTotal}
            </Text>
          </View>
        </GlassCard>

        <View style={[styles.clientList, { gap: theme.spacing.sm }]}>
          <GlassCard
            style={[styles.clientCard, { borderRadius: theme.radius.xl + theme.spacing.sm }]}
          >
            {openPaymentPreview.map((item, index) => (
              <View key={item.client}>
                <OpenPaymentRow item={item} />
                {index < openPaymentPreview.length - 1 ? (
                  <View style={[styles.divider, { backgroundColor: theme.colors.separator }]} />
                ) : null}
              </View>
            ))}
          </GlassCard>
        </View>
      </Animated.View>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: { flexGrow: 1 },
  content: { gap: 24 },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, position: 'relative' },
  headerCopy: { alignItems: 'center', gap: 4, left: 0, position: 'absolute', right: 0 },
  summaryCard: { padding: 16 },
  summaryRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  summaryCopy: { flex: 1 },
  clientList: { width: '100%' },
  clientCard: { padding: 16 },
  divider: { height: StyleSheet.hairlineWidth },
});
