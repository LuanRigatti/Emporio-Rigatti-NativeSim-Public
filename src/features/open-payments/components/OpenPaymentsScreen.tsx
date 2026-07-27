import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { GlassCard, GlassSurface, PremiumScreen } from '@/components/premium';
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
          <GlassSurface
            accessibilityLabel="Voltar"
            style={[
              styles.backButtonSurface,
              {
                borderRadius: theme.radius.pill,
                height: theme.sizes.touchTargetMinimum,
                width: theme.sizes.touchTargetMinimum,
              },
            ]}
          >
            <Pressable
              accessibilityLabel="Voltar para Home"
              accessibilityRole="button"
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.backButton,
                {
                  borderRadius: theme.radius.pill,
                  opacity: pressed ? theme.opacities.pressed : 1,
                },
              ]}
            >
              <Ionicons
                color={theme.colors.textPrimary}
                name="chevron-back"
                size={theme.sizes.iconMedium}
              />
            </Pressable>
          </GlassSurface>
          <View style={styles.headerCopy}>
            <Text style={[theme.typography.largeTitle, { color: theme.colors.textPrimary }]}>
              Pagamentos em aberto
            </Text>
          </View>
        </View>

        <GlassCard
          style={[styles.summaryCard, { borderRadius: theme.radius.xl + theme.spacing.sm }]}
        >
          <View style={styles.summaryRow}>
            <View
              style={[
                styles.summaryIcon,
                {
                  backgroundColor: theme.colors.dangerSurface,
                  borderRadius: theme.radius.md,
                  height: 42,
                  width: 42,
                },
              ]}
            >
              <Ionicons
                color={theme.colors.danger}
                name="alert-circle-outline"
                size={theme.sizes.iconMedium}
              />
            </View>
            <View style={styles.summaryCopy}>
              <Text style={[theme.typography.caption, { color: '#000000' }]}>TOTAL EM ABERTO</Text>
              <Text style={[theme.typography.metricMedium, { color: theme.colors.textPrimary }]}>
                {openPaymentsTotal}
              </Text>
            </View>
            <Text
              style={[
                theme.typography.footnote,
                { color: '#000000', fontWeight: theme.typography.fontWeight.bold },
              ]}
            >
              {openPaymentPreview.length} clientes
            </Text>
          </View>
        </GlassCard>

        <View style={[styles.clientList, { gap: theme.spacing.sm }]}>
          {openPaymentPreview.map((item) => (
            <GlassCard
              key={item.client}
              style={[styles.clientCard, { borderRadius: theme.radius.xl + theme.spacing.sm }]}
            >
              <OpenPaymentRow item={item} />
            </GlassCard>
          ))}
        </View>
      </Animated.View>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: { flexGrow: 1 },
  content: { gap: 24 },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
  backButtonSurface: { overflow: 'hidden' },
  backButton: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  headerCopy: { flex: 1, gap: 4 },
  summaryCard: { padding: 16 },
  summaryRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  summaryIcon: { alignItems: 'center', justifyContent: 'center' },
  summaryCopy: { flex: 1, gap: 2 },
  clientList: { width: '100%' },
  clientCard: { padding: 16 },
});
