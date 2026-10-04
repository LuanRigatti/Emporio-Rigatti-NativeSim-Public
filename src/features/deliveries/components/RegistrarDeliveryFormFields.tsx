import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { NativeDatePicker } from '@/components/native/NativeDatePicker';
import { useAppTheme } from '@/theme';
import { triggerNativeButtonHaptic } from '@/utils/haptics';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import type {
  RegistrarDeliveryFormFieldsProps,
  RegistrarDeliveryQuantityDirection,
} from './RegistrarDeliveryFormFields.types';

export default function RegistrarDeliveryFormFields({
  date,
  onDateChange,
  onQuantityChange,
  quantity,
  totalValue,
}: RegistrarDeliveryFormFieldsProps) {
  const { theme } = useAppTheme();
  const {
    currency: maskCurrency,
    number: maskNumber,
    enabled: testModeEnabled,
  } = useTestModePresentation();
  const formattedTotal = testModeEnabled
    ? maskCurrency(0)
    : new Intl.NumberFormat('pt-BR', { currency: 'BRL', style: 'currency' }).format(totalValue);

  const changeQuantity = (direction: RegistrarDeliveryQuantityDirection) => {
    triggerNativeButtonHaptic('light');
    onQuantityChange(direction === 'down' ? Math.max(1, quantity - 1) : quantity + 1, direction);
  };

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: theme.spacing.md }}>
        <Ionicons color={theme.colors.textSecondary} name="calendar-outline" size={24} />
        <View style={{ flex: 1 }}>
          <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>Data</Text>
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            Data da entrega
          </Text>
        </View>
        <NativeDatePicker
          accessibilityLabel="Selecionar data da entrega"
          mode="date"
          onChange={onDateChange}
          style="compact"
          value={date}
        />
      </View>

      <View style={{ alignItems: 'center', flexDirection: 'row', gap: theme.spacing.md }}>
        <Ionicons color={theme.colors.textSecondary} name="cube-outline" size={24} />
        <View style={{ flex: 1 }}>
          <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>Baldes</Text>
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            Quantidade da entrega
          </Text>
        </View>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: theme.spacing.sm }}>
          <Pressable
            accessibilityLabel="Diminuir quantidade"
            accessibilityRole="button"
            disabled={testModeEnabled}
            onPress={() => changeQuantity('down')}
            style={{
              alignItems: 'center',
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.pill,
              height: 44,
              justifyContent: 'center',
              width: 44,
            }}
          >
            <Ionicons color={theme.colors.textPrimary} name="remove" size={18} />
          </Pressable>
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
            {maskNumber(quantity)}
          </Text>
          <Pressable
            accessibilityLabel="Aumentar quantidade"
            accessibilityRole="button"
            disabled={testModeEnabled}
            onPress={() => changeQuantity('up')}
            style={{
              alignItems: 'center',
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.pill,
              height: 44,
              justifyContent: 'center',
              width: 44,
            }}
          >
            <Ionicons color={theme.colors.textPrimary} name="add" size={18} />
          </Pressable>
        </View>
      </View>

      <View style={{ alignItems: 'center', flexDirection: 'row', gap: theme.spacing.md }}>
        <Ionicons color={theme.colors.textSecondary} name="cash-outline" size={24} />
        <View style={{ flex: 1 }}>
          <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
            Valor total
          </Text>
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            Total da entrega
          </Text>
        </View>
        <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
          {formattedTotal}
        </Text>
      </View>
    </View>
  );
}

export function RegistrarDeliveryFormFieldsHost(props: RegistrarDeliveryFormFieldsProps) {
  return <RegistrarDeliveryFormFields {...props} />;
}
