import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { NativeGlassHeader } from '@/components/layout';
import { NativeGlassBackButton, NativeGlassIconButton } from '@/components/native';
import { GlassCard, PremiumScreen } from '@/components/premium';
import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';

import { OpenPaymentRow } from './OpenPaymentRow';
import { openPaymentPreview, openPaymentsTotal } from '../data/openPaymentPreview';

export function OpenPaymentsScreen() {
  const router = useRouter();
  const { reduceMotionEnabled, theme } = useAppTheme();
  const entrance = useSharedValue(0);
  const [paymentItems, setPaymentItems] = useState(() => [...openPaymentPreview]);
  const [isSelectionMode, setSelectionMode] = useState(false);
  const [selectedClients, setSelectedClients] = useState<ReadonlySet<string>>(() => new Set());

  const handleCheckPress = useCallback(() => {
    triggerLightImpactHaptic();

    if (!isSelectionMode) {
      setSelectedClients(new Set());
      setSelectionMode(true);
      return;
    }

    setPaymentItems((current) => current.filter((item) => !selectedClients.has(item.client)));
    setSelectedClients(new Set());
    setSelectionMode(false);
  }, [isSelectionMode, selectedClients]);

  const toggleClientSelection = useCallback((client: string) => {
    setSelectedClients((current) => {
      const next = new Set(current);
      if (next.has(client)) {
        next.delete(client);
      } else {
        next.add(client);
      }
      return next;
    });
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
      rightActions={
        <NativeGlassIconButton
          accessibilityLabel={
            isSelectionMode ? 'Confirmar recebimentos pagos' : 'Selecionar recebimentos'
          }
          color={theme.colors.textPrimary}
          containerSize={theme.sizes.touchTargetMinimum}
          fallbackIcon="checkmark"
          interactiveGlass
          onPress={handleCheckPress}
          size={theme.sizes.iconMedium}
          systemImage="checkmark"
        />
      }
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
              {paymentItems.map((item) => (
                <View key={item.client}>
                  <OpenPaymentRow
                    item={item}
                    onPress={isSelectionMode ? () => toggleClientSelection(item.client) : undefined}
                    selected={selectedClients.has(item.client)}
                    selectionMode={isSelectionMode}
                  />
                </View>
              ))}
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
