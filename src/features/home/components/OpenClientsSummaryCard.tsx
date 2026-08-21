import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/premium';
import { useAppTheme } from '@/theme';
import { formatCurrency } from '@/utils/data';

export type OpenClientSummary = {
  amount: number;
  clientName: string;
  id: string;
};

type OpenClientsSummaryCardProps = {
  clients: readonly OpenClientSummary[];
  onPress?: () => void;
};

export function OpenClientsSummaryCard({ clients, onPress }: OpenClientsSummaryCardProps) {
  const { theme } = useAppTheme();

  if (clients.length === 0) return null;

  return (
    <View style={[styles.container, { gap: theme.spacing.md }]}>
      <Pressable
        accessibilityLabel="Abrir recebimentos em aberto"
        accessibilityRole="button"
        onPress={onPress}
      >
        <View style={styles.header}>
          <Text
            style={[theme.typography.headline, styles.title, { color: theme.colors.textPrimary }]}
          >
            Em aberto
          </Text>
          <Ionicons
            color={theme.colors.textSecondary}
            name="chevron-forward"
            size={theme.sizes.iconSmall - 2}
            style={{
              marginLeft: theme.spacing.xxs / 2,
              transform: [{ translateY: theme.spacing.xxs / 4 }],
            }}
          />
        </View>
      </Pressable>
      <GlassCard
        accessibilityLabel="Valores em aberto por cliente"
        style={{ borderRadius: theme.radius.xl + theme.spacing.sm }}
      >
        <View style={[styles.list, { gap: theme.spacing.md }]}>
          {clients.map((client) => (
            <View key={client.id} style={styles.row}>
              <Text
                style={[
                  theme.typography.callout,
                  { color: theme.colors.textPrimary, fontWeight: 'bold' },
                ]}
              >
                {client.clientName}
              </Text>
              <Text style={[theme.typography.callout, { color: theme.colors.textPrimary }]}>
                {formatCurrency(client.amount)}
              </Text>
            </View>
          ))}
        </View>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  list: { width: '100%' },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  title: { textAlign: 'center' },
});
