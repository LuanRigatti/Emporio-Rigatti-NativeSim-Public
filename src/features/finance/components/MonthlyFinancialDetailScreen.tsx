import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import {
  NativeAnimatedNumber,
  NativeGlassBackButton,
  NativePeriodActionGroup,
} from '@/components/native';
import { FinancialSeriesChart } from '@/components/Charts';
import { EmptyState } from '@/components/feedback';
import { PremiumCard, PremiumScreen, Skeleton } from '@/components/premium';
import { useFinancialData } from '@/hooks/useFinancialData';
import { expenseQueryForFinancialSelection } from '@/services/costs';
import {
  financialDailyDetailService,
  financialMetricValue,
  type FinancialDailyDetail,
  type MonthlyFinancialDetailMetric,
} from '@/services/finance';
import { routeTrackingRepository } from '@/services/routes';
import type { RouteTrackingSession } from '@/types/routeTracking';
import { useAppTheme } from '@/theme';
import { formatCurrency, formatPtBrDate } from '@/utils/data';
import {
  HISTORY_MONTH_ITEMS,
  getHistoryYearItems,
} from '@/features/history/components/periodOptions';
import { formatMonthlyPeriodKey, parseMonthlyPeriodParam } from '../utils/monthlyPeriodUtils';

import { FinancialDayDetailCard } from './FinancialDayDetailCard';

type Props = {
  metric: MonthlyFinancialDetailMetric;
};

const metricCopy = {
  faturamento: {
    title: 'Faturamento',
    subtitle: 'Faturamento por dia',
  },
  lucroLiquido: {
    title: 'Lucro líquido',
    subtitle: 'Lucro líquido por dia',
  },
};

export function MonthlyFinancialDetailScreen({ metric }: Props) {
  const router = useRouter();
  const params = useLocalSearchParams<{ period?: string | string[] }>();
  const { theme } = useAppTheme();
  const [selectedMonth, setSelectedMonth] = useState(
    () => parseMonthlyPeriodParam(params.period).month,
  );
  const [selectedYear, setSelectedYear] = useState(
    () => parseMonthlyPeriodParam(params.period).year,
  );
  const lastParamPeriodRef = useRef(
    Array.isArray(params.period) ? params.period[0] : params.period,
  );

  useEffect(() => {
    const currentParam = Array.isArray(params.period) ? params.period[0] : params.period;
    if (currentParam !== undefined && currentParam !== lastParamPeriodRef.current) {
      lastParamPeriodRef.current = currentParam;
      const parsed = parseMonthlyPeriodParam(currentParam);
      setSelectedMonth(parsed.month);
      setSelectedYear(parsed.year);
    }
  }, [params.period]);

  const initialRouteSessions = routeTrackingRepository.getMemoryRouteHistory();
  const [routeSessions, setRouteSessions] = useState<RouteTrackingSession[]>(
    () => initialRouteSessions ?? [],
  );
  const [routesLoaded, setRoutesLoaded] = useState(() => initialRouteSessions !== null);
  const [selectedDate, setSelectedDate] = useState<string>();
  const isFirstFocus = useRef(true);
  const copy = metricCopy[metric];
  const selectedMonthKey = formatMonthlyPeriodKey(selectedYear, selectedMonth);
  const { refresh, snapshot, loading } = useFinancialData(
    expenseQueryForFinancialSelection({ kind: 'month', month: selectedMonthKey }),
    { displayMonth: selectedMonthKey },
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const isInitial = isFirstFocus.current;
      isFirstFocus.current = false;

      const refreshPromise = isInitial ? Promise.resolve() : refresh();

      void Promise.all([refreshPromise, routeTrackingRepository.getRouteHistory()])
        .then(([, sessions]) => {
          if (active) {
            setRouteSessions(sessions);
            setRoutesLoaded(true);
          }
        })
        .catch(() => {
          if (active) {
            setRouteSessions([]);
            setRoutesLoaded(true);
          }
        });

      return () => {
        active = false;
      };
    }, [refresh]),
  );

  const isDataReady = !loading && routesLoaded;

  const details = useMemo(
    () =>
      isDataReady && snapshot
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
    [isDataReady, routeSessions, selectedMonthKey, snapshot],
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
      title=""
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
        {!isDataReady ? (
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
                <View style={styles.chartHeaderRow}>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                    {copy.subtitle}
                  </Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                    {formatPtBrDate(selectedDetail.date)}
                  </Text>
                </View>
                <NativeAnimatedNumber
                  animationEnabled={isDataReady}
                  color={theme.colors.textPrimary}
                  fontSize={theme.typography.metricMedium.fontSize}
                  fontWeight="bold"
                  lineHeight={theme.typography.metricMedium.lineHeight}
                  text={formatCurrency(financialMetricValue(selectedDetail.summary, metric))}
                  value={financialMetricValue(selectedDetail.summary, metric)}
                />
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
  chartHeader: { gap: 4 },
  chartHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  loading: { gap: 16 },
});
