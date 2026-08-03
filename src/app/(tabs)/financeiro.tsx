import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { NativePeriodActionGroup } from '@/components/native';
import { PremiumCard, PremiumScreen, SummaryCard } from '@/components/premium';
import { getCurrentHistoryPeriod } from '@/features/history/utils/historyDateUtils';
import {
  getHistoryYearItems,
  HISTORY_MONTH_ITEMS,
} from '@/features/history/components/periodOptions';
import { useAppTheme } from '@/theme';

function PreviewIcon({
  color,
  name,
}: {
  color: string;
  name: ComponentProps<typeof Ionicons>['name'];
}) {
  const { theme } = useAppTheme();
  return <Ionicons color={color} name={name} size={theme.sizes.iconMedium} />;
}

function monthShortLabel(month: number): string {
  return (
    ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][
      month - 1
    ] ?? String(month)
  );
}

export default function PrototypeFinanceiro() {
  const { resolvedMode, theme } = useAppTheme();
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentHistoryPeriod().month);
  const [selectedYear, setSelectedYear] = useState(() => getCurrentHistoryPeriod().year);
  const header = (
    <NativeGlassHeader
      rightActions={
        <NativePeriodActionGroup
          color={theme.colors.textPrimary}
          monthDisplayValue={monthShortLabel(selectedMonth)}
          monthItems={HISTORY_MONTH_ITEMS}
          onMonthChange={setSelectedMonth}
          onYearChange={setSelectedYear}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          showValues
          valueFontSize={17}
          yearItems={getHistoryYearItems()}
        />
      }
      mode="transparent"
      titleStyle={{ transform: [{ translateX: theme.spacing.lg + theme.spacing.xs }] }}
      title="Finanças"
    />
  );

  return (
    <PremiumScreen
      contentContainerStyle={styles.content}
      overlayHeader={header}
      overlayHeaderContentOffset={
        theme.typography.headline.lineHeight +
        theme.spacing.xl -
        theme.sizes.touchTargetMinimum +
        theme.spacing.xxs * 8
      }
      progressiveBlur
    >
      <PremiumCard
        style={{
          borderRadius: theme.radius.xl + theme.spacing.sm,
          gap: theme.spacing.sm,
          padding: theme.spacing.xl,
        }}
      >
        <View style={styles.heroHeader}>
          <Text
            style={[
              theme.typography.caption,
              {
                color:
                  resolvedMode === 'dark' ? theme.colors.textPrimary : theme.colors.contrastSurface,
              },
            ]}
          >
            FATURAMENTO MENSAL
          </Text>
          <PreviewIcon color={theme.colors.revenue} name="trending-up" />
        </View>
        <Text style={[theme.typography.metricLarge, { color: theme.colors.textPrimary }]}>
          R$ 0,00
        </Text>
      </PremiumCard>
      <PremiumCard
        style={{
          borderRadius: theme.radius.xl + theme.spacing.sm,
          gap: theme.spacing.sm,
          padding: theme.spacing.xl,
        }}
      >
        <View style={styles.heroHeader}>
          <Text
            style={[
              theme.typography.caption,
              {
                color:
                  resolvedMode === 'dark' ? theme.colors.textPrimary : theme.colors.contrastSurface,
              },
            ]}
          >
            LUCRO LÍQUIDO MENSAL
          </Text>
          <PreviewIcon color={theme.colors.profit} name="trending-up" />
        </View>
        <Text style={[theme.typography.metricLarge, { color: theme.colors.textPrimary }]}>
          R$ 0,00
        </Text>
      </PremiumCard>
      <SummaryCard
        rows={[
          { label: 'Baldes vendidos', value: '0' },
          { label: 'Lucro bruto', value: 'R$ 0,00' },
        ]}
        title="OPERAÇÃO"
      />
      <SummaryCard
        rows={[
          { label: 'Custo dos baldes', value: 'R$ 0,00' },
          { label: 'Custo combustível', value: 'R$ 0,00' },
          { label: 'Luz do período', value: 'R$ 0,00' },
          { label: 'Custo médio de entrega', value: 'R$ 0,00' },
        ]}
        title="CUSTOS"
      />
      <SummaryCard
        rows={[
          { label: 'Recebido', value: 'R$ 0,00' },
          { label: 'A receber', value: 'R$ 0,00' },
          { label: 'Margem bruta', value: '0%' },
          { label: 'Margem líquida', value: '0%' },
        ]}
        title="RECEBIDO/MARGENS"
      />
      <SummaryCard
        rows={[
          { label: 'Venda p/ balde', value: 'R$ 0,00' },
          { label: 'Lucro p/ balde', value: 'R$ 0,00' },
          { label: 'Custo p/ balde', value: 'R$ 0,00' },
        ]}
        title="POR BALDE"
      />
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 24 },
  heroHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
