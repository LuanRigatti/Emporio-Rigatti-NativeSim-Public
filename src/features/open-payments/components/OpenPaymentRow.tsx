import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

import type { OpenPaymentPreview } from '../data/openPaymentPreview';

export type OpenPaymentRowProps = {
  item: OpenPaymentPreview;
};

export function OpenPaymentRow({ item }: OpenPaymentRowProps) {
  const { theme } = useAppTheme();

  return (
    <View
      style={[
        styles.row,
        {
          gap: theme.spacing.sm,
          minHeight: theme.sizes.touchTargetMinimum + theme.spacing.sm,
        },
      ]}
    >
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: theme.colors.dangerSurface,
            borderRadius: theme.radius.md,
            height: theme.sizes.touchTargetMinimum,
            width: theme.sizes.touchTargetMinimum,
          },
        ]}
      >
        <Ionicons color={theme.colors.danger} name="alert-outline" size={theme.sizes.iconMedium} />
      </View>
      <View style={[styles.content, { gap: theme.spacing.xxs }]}>
        <Text
          style={[
            theme.typography.headline,
            { color: theme.colors.textPrimary, fontSize: 15, lineHeight: 20 },
          ]}
        >
          {item.client}
        </Text>
        <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
          {item.quantity} ·{' '}
          <Text style={{ color: theme.colors.danger }}>{item.pendingDeliveries}</Text>
        </Text>
      </View>
      <Text
        style={[
          theme.typography.headline,
          { color: theme.colors.textPrimary, fontSize: 15, lineHeight: 20 },
        ]}
      >
        {item.amount}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', paddingVertical: 10 },
  iconContainer: { alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },
});
