import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/premium';
import { factoryPurchaseCalculationService } from '@/services/factory-purchases';
import { comparePurchasesDescending } from '@/services/factory-purchases/FactoryPurchaseCalculationService';
import { useAppTheme } from '@/theme';
import type { Purchase } from '@/features/factory-purchases/types';
import { formatCurrency, formatPtBrDate } from '@/utils/data';

type PurchaseStatus = 'Pago' | 'Parcial' | 'Em aberto';

type PurchaseSummary = {
  purchase: Purchase;
  status: PurchaseStatus;
};

export type FactorySummaryCardProps = {
  loading?: boolean;
  onPress?: () => void;
  purchases: readonly Purchase[];
};

function getPurchaseStatus(purchase: Purchase): PurchaseStatus {
  if (purchase.payments.length === 0) return 'Em aberto';
  return factoryPurchaseCalculationService.isPaid(purchase) ? 'Pago' : 'Parcial';
}

export function FactorySummaryCard({
  loading = false,
  onPress,
  purchases,
}: FactorySummaryCardProps) {
  const { theme } = useAppTheme();
  const recentPurchases = useMemo<PurchaseSummary[]>(
    () =>
      [...purchases]
        .sort(comparePurchasesDescending)
        .slice(0, 2)
        .map((purchase) => ({
          purchase,
          status: getPurchaseStatus(purchase),
        })),
    [purchases],
  );

  return (
    <View style={[styles.container, { gap: theme.spacing.md }]}>
      <Pressable
        accessibilityLabel="Abrir Fábrica"
        accessibilityRole="button"
        onPress={onPress}
        style={styles.header}
      >
        <Text
          style={[theme.typography.headline, styles.title, { color: theme.colors.textPrimary }]}
        >
          Fábrica
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
      </Pressable>

      <GlassCard
        style={[
          {
            borderRadius: theme.radius.xl + theme.spacing.sm,
            gap: theme.spacing.sm,
          },
        ]}
      >
        <View style={{ marginTop: theme.spacing.xs }}>
          {loading ? (
            <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
              Carregando resumo…
            </Text>
          ) : recentPurchases.length === 0 ? (
            <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
              Nenhuma compra registrada.
            </Text>
          ) : (
            <View style={{ gap: theme.spacing.md }}>
              {recentPurchases.map(({ purchase, status }) => (
                <View key={purchase.id} style={[styles.purchaseRow, { gap: theme.spacing.xs }]}>
                  <View style={styles.row}>
                    <Text style={[theme.typography.callout, { color: theme.colors.textPrimary }]}>
                      {formatPtBrDate(purchase.date)}
                    </Text>
                    <View style={[styles.amountColumn, { gap: theme.spacing.xs }]}>
                      <Text
                        style={[
                          theme.typography.callout,
                          { color: theme.colors.textPrimary, fontWeight: 'bold' },
                        ]}
                      >
                        {formatCurrency(purchase.totalAmount)}
                      </Text>
                      <Text
                        style={[
                          theme.typography.footnote,
                          {
                            color:
                              status === 'Pago' ? theme.colors.success : theme.colors.textSecondary,
                            textAlign: 'right',
                          },
                        ]}
                      >
                        {status}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
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
  amountColumn: { alignItems: 'flex-end' },
  purchaseRow: { width: '100%' },
  row: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  title: { textAlign: 'center' },
});
