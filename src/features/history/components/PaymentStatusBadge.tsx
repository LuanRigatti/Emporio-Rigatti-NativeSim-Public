import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/premium';
import { useAppTheme } from '@/theme';

type PaymentStatus = 'Pago' | 'Não Pago';

export type PaymentStatusBadgeProps = {
  disabled?: boolean;
  onPress?: () => void;
  status: PaymentStatus;
};

export function PaymentStatusBadge({ disabled = false, onPress, status }: PaymentStatusBadgeProps) {
  const { resolvedMode, theme } = useAppTheme();
  const isPaid = status === 'Pago';
  const isDisabled = disabled || !onPress;
  const color = resolvedMode === 'dark' ? theme.colors.textPrimary : theme.colors.contrastSurface;

  if (!isPaid) return null;

  return (
    <AnimatedPressable
      accessibilityHint="Toque para editar os estados de entrega e pagamento."
      accessibilityLabel="Pago. Toque para editar entrega e pagamento."
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      style={[
        styles.touchTarget,
        {
          height: theme.sizes.touchTargetMinimum,
          width: theme.sizes.touchTargetMinimum,
        },
      ]}
    >
      <View style={[styles.indicator, { gap: theme.spacing.xxs }]}>
        <Ionicons
          accessible={false}
          color={color}
          name="checkmark"
          size={theme.sizes.iconSmall - theme.spacing.xxs}
        />
        <Text style={[theme.typography.caption, { color }]}>Pago</Text>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  indicator: { alignItems: 'center', flexDirection: 'row' },
  touchTarget: { alignItems: 'flex-end', justifyContent: 'center' },
});
