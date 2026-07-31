import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import Ionicons from '@expo/vector-icons/Ionicons';

import { AnimatedPressable } from '@/components/premium';
import { icons, useAppTheme } from '@/theme';

import type { OpenPaymentPreview } from '../data/openPaymentPreview';

export type OpenPaymentRowProps = {
  item: OpenPaymentPreview;
  showInvoiceStatusIcon?: boolean;
  selectionMode?: boolean;
  selected?: boolean;
  onPress?: () => void;
};

export function OpenPaymentRow({
  item,
  onPress,
  selected = false,
  selectionMode = false,
  showInvoiceStatusIcon = false,
}: OpenPaymentRowProps) {
  const { reduceMotionEnabled, theme } = useAppTheme();
  const selectionProgress = useSharedValue(selectionMode ? 1 : 0);

  useEffect(() => {
    selectionProgress.value = reduceMotionEnabled
      ? selectionMode
        ? 1
        : 0
      : withSpring(selectionMode ? 1 : 0, theme.animations.spring.responsive);
  }, [reduceMotionEnabled, selectionMode, selectionProgress, theme.animations.spring.responsive]);

  const selectionIndicatorAnimatedStyle = useAnimatedStyle(() => ({
    marginRight: selectionProgress.value * 12,
    opacity: selectionProgress.value,
    width: selectionProgress.value * 24,
  }));

  return (
    <AnimatedPressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.row, { minHeight: theme.sizes.touchTargetMinimum + theme.spacing.sm }]}
    >
      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
        {item.date}
      </Text>
      <View style={[styles.clientLine, { gap: theme.spacing.sm }]}>
        <View style={styles.clientLeading}>
          <Animated.View
            style={[
              styles.selectionIndicator,
              selectionIndicatorAnimatedStyle,
              {
                backgroundColor: selected ? theme.colors.selectionSurface : 'transparent',
                borderColor: selected ? theme.colors.selectionSurface : theme.colors.borderStrong,
              },
            ]}
          >
            {selected ? (
              <Ionicons color={theme.colors.selectionContent} name="checkmark" size={15} />
            ) : null}
          </Animated.View>
          <View style={styles.clientContent}>
            <View style={styles.clientNameLine}>
              <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
                {item.client}
              </Text>
              <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
                {item.quantity} baldes
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.amountLine}>
          {showInvoiceStatusIcon ? (
            <Ionicons color={theme.colors.warning} name={icons.status.toIssue} size={16} />
          ) : null}
          <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
            {item.amount}
          </Text>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: { gap: 6, paddingVertical: 12 },
  clientLine: { alignItems: 'center', flexDirection: 'row' },
  clientLeading: { alignItems: 'center', flex: 1, flexDirection: 'row' },
  clientContent: { flex: 1 },
  clientNameLine: { gap: 2 },
  amountLine: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  selectionIndicator: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    height: 24,
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
