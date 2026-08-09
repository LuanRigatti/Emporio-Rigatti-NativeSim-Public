import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { NativeGlassBackButton, NativePeriodActionGroup } from '@/components/native';
import { FinancialSeriesChart } from '@/components/Charts';
import { EmptyState } from '@/components/feedback';
import { PremiumCard, PremiumScreen, Skeleton } from '@/components/premium';
import { useAppData } from '@/hooks/useAppData';
import {
  financialDailyDetailService,
  financialMetricValue,
  type FinancialDailyDetail,
  type MonthlyFinancialDetailMetric,
} from '@/services/finance';
import { routeTrackingRepository } from '@/services/routes';
import type { RouteTrackingSession } from '@/types/routeTracking';
import { useAppTheme } from '@/theme';
import { formatCurrency } from '@/utils/data';
import {
  HISTORY_MONTH_ITEMS,
  getHistoryYearItems,
} from '@/features/history/components/periodOptions';
import { getCurrentHistoryPeriod } from '@/features/history/utils/historyDateUtils';

import { FinancialDayDetailCard } from './FinancialDayDetailCard';

type Props = {
  metric: MonthlyFinancialDetailMetric;
};

const metricCopy = {
  faturamento: {
    title: 'Faturamento mensal',
    subtitle: 'Faturamento por dia',
  },
  lucroLiquido: {
    title: 'Lucro líquido mensal',
    subtitle: 'Lucro líquido por dia',
  },
};

export function MonthlyFinancialDetailScreen({ metric }: Props) {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { refresh, snapshot, loading } = useAppData();
  const currentPeriod = getCurrentHistoryPeriod();
  const [selectedMonth, setSelectedMonth] = useState(currentPeriod.month);
  const [selectedYear, setSelectedYear] = useState(currentPeriod.year);
  const [routeSessions, setRouteSessions] = useState<RouteTrackingSession[]>([]);
  const [routesLoading, setRoutesLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>();
  const copy = metricCopy[metric];
  const selectedMonthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setRoutesLoading(true);

      void Promise.all([refresh(), routeTrackingRepository.getRouteHistory()])
        .then(([, sessions]) => {
          if (active) setRouteSessions(sessions);
        })
        .catch(() => {
          if (active) setRouteSessions([]);
        })
        .finally(() => {
          if (active) setRoutesLoading(false);
        });

      return () => {
        active = false;
      };
    }, [refresh]),
  );

  const details = useMemo(
    () =>
      snapshot
        ? financialDailyDetailService.buildMonth(
            {
              dailyExpenses: snapshot.gastosDiarios,
              deliveries: snapshot.entregas,
              monthlyExpenses: snapshot.gastosMensais,
              routeSessions,
            },
            selectedMonthKey,
          )
        : [],
    [routeSessions, selectedMonthKey, snapshot],
  );

  const points = useMemo(() => buildDailyPoints(details, metric), [details, metric]);
  const selectedDetail =
    details.find((detail) => detail.date === selectedDate) ?? details[details.length - 1];
  const selectedIndex = selectedDetail ? details.indexOf(selectedDetail) : 0;

  const header = (
    <NativeGlassHeader
      leftActions={
        <NativeGlassBackButton
          accessibilityLabel="Voltar para Finanças"
          color={theme.colors.textPrimary}
          containerSize={theme.sizes.touchTargetMinimum}
          onPress={() => router.back()}
          size={theme.sizes.iconMedium}
        />
      }
      mode="transparent"
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
      title={copy.title}
    />
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <PremiumScreen
        contentContainerStyle={styles.content}
        overlayHeader={header}
        overlayHeaderContentOffset={
          theme.typography.headline.lineHeight +
          theme.spacing.xl -
          theme.sizes.touchTargetMinimum +
          theme.spacing.xxs * 8
        }
        overlayHeaderSpacing={theme.spacing.xxxl + theme.spacing.md}
        progressiveBlur
        scrollable
      >
        {loading || routesLoading ? (
          <View style={styles.loading}>
            <Skeleton height={220} />
            <Skeleton height={theme.sizes.loadingLineHeight * 8} />
          </View>
        ) : details.length === 0 ? (
          <EmptyState
            description="Não existem entregas ou lançamentos no mês selecionado."
            title="Sem movimento no período"
          />
        ) : selectedDetail ? (
          <>
            <PremiumCard
              style={[styles.chartCard, { borderRadius: theme.radius.xl + theme.spacing.sm }]}
            >
              <View style={styles.chartHeader}>
                <View>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                    {copy.subtitle}
                  </Text>
                  <Text
                    style={[theme.typography.metricMedium, { color: theme.colors.textPrimary }]}
                  >
                    {formatCurrency(financialMetricValue(selectedDetail.summary, metric))}
                  </Text>
                </View>
                <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
                  Toque ou arraste
                </Text>
              </View>
              <FinancialSeriesChart
                accessibilityLabel={`Gráfico de ${copy.title}`}
                color={theme.colors.textPrimary}
                lineWidth={4}
                onSelectPoint={(index) => setSelectedDate(details[index]?.date)}
                points={points}
                selectedIndex={selectedIndex}
                showAllLabels
              />
            </PremiumCard>
            <FinancialDayDetailCard detail={selectedDetail} metric={metric} />
          </>
        ) : null}
      </PremiumScreen>
    </View>
  );
}

function monthShortLabel(month: number): string {
  return (
    ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][
      month - 1
    ] ?? String(month)
  );
}

function buildDailyPoints(
  details: readonly FinancialDailyDetail[],
  metric: MonthlyFinancialDetailMetric,
) {
  return details.map((detail) => {
    return {
      key: detail.date,
      label: detail.date.slice(8, 10),
      value: financialMetricValue(detail.summary, metric),
    };
  });
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: 16, paddingBottom: 32 },
  chartCard: { gap: 16, padding: 20 },
  chartHeader: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between' },
  loading: { gap: 16 },
});
