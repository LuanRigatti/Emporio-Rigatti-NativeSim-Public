import { Platform } from 'react-native';
import type { WidgetTimelineEntry } from 'expo-widgets';

import { getHistoryMonthRange } from '@/features/history/utils/historyPeriodUtils';
import {
  financialCalculationService,
  financialPeriodSnapshotCache,
  wholesaleFinanceFiltersForSelection,
} from '@/services/finance';
import { carSettingsStorage } from '@/services/car';
import {
  EMPTY_COST_VALUES,
  costSettingsStorage,
  type CostField,
  type CostSettings,
} from '@/services/costs';
import { calculateFinancialFuelCostsByDate, type FinancialFuelSettings } from '@/services/expenses';
import {
  RETAIL_FINANCE_GENERAL_VIEW,
  retailFinanceAggregationService,
} from '@/services/retail-finance';
import { retailFinanceDatasetService } from '@/services/retail-finance/RetailFinanceDatasetService';
import { locationTrackingService, summarizeRouteKilometersByDate } from '@/services/routes';

import {
  createFinanceWidgetTimeline,
  emptyFinanceWidgetDomain,
  formatFinanceWidgetAmount,
  getFinanceWidgetMonthKey,
  getFinanceWidgetMonthLabel,
  unavailableFinanceWidgetProps,
  type ResumoFinanceiroWidgetProps,
  type ResumoFinanceiroWidgetTimelineProps,
} from './ResumoFinanceiroSnapshot';
import {
  recordFinanceWidgetPublishResult,
  recordFinanceWidgetPublishStart,
  recordFinanceWidgetTimelineRead,
} from './ResumoFinanceiroWidgetDiagnostics';

type WholesaleFinanceSnapshot = {
  snapshotSessionScopeKey: string | undefined;
  monthKey: string;
  faturamento: number | null;
  lucroLiquido: number | null;
};

function sessionScopeKey(uid: string, sessionVersion?: number): string {
  return `${uid}:${sessionVersion ?? 'none'}`;
}

function financialFuelSettingsForCache(settings: CostSettings): FinancialFuelSettings {
  const dailyValues = settings.periods.day;
  const latestValue = (field: CostField): string => {
    const entries = Object.entries(dailyValues).sort(([left], [right]) =>
      right.localeCompare(left),
    );
    for (const [, values] of entries) {
      const value = values[field];
      if (value.trim()) return value;
    }
    return '';
  };

  return {
    getDailyValues: (date) => dailyValues[date] ?? { ...EMPTY_COST_VALUES },
    getDailyDates: () => Object.keys(dailyValues),
    getLatestFuelPrice: () => latestValue('fuelPrice'),
    getLatestFuelType: () => latestValue('fuelType'),
  };
}

class ResumoFinanceiroSnapshotCoordinator {
  private activeUid: string | null = null;
  private activeSessionVersion: number | undefined;
  private activeSessionScopeKey: string | null = null;
  private generation = 0;
  private wholesaleRevision = 0;
  private updateWidgetTimeline:
    ((entries: WidgetTimelineEntry<ResumoFinanceiroWidgetTimelineProps>[]) => void) | null = null;
  private readWidgetTimeline:
    (() => Promise<WidgetTimelineEntry<ResumoFinanceiroWidgetTimelineProps>[]>) | null = null;
  private snapshot: ResumoFinanceiroWidgetProps = unavailableFinanceWidgetProps(
    getFinanceWidgetMonthKey(new Date()),
  );

  public constructor() {
    retailFinanceDatasetService.subscribe(() => this.refreshRetailSnapshot());
  }

  public setSession(uid: string | null, sessionVersion?: number): void {
    const normalizedUid = uid?.trim() || null;
    const nextSessionScopeKey = normalizedUid
      ? sessionScopeKey(normalizedUid, sessionVersion)
      : null;

    if (
      nextSessionScopeKey === this.activeSessionScopeKey &&
      sessionVersion === this.activeSessionVersion
    ) {
      return;
    }

    this.activeUid = normalizedUid;
    this.activeSessionVersion = sessionVersion;
    this.activeSessionScopeKey = nextSessionScopeKey;
    const generation = ++this.generation;
    this.wholesaleRevision += 1;
    this.snapshot = unavailableFinanceWidgetProps(getFinanceWidgetMonthKey(new Date()));
    this.publishTimeline();
    void this.loadWidget(generation);

    if (!normalizedUid) return;

    this.refreshRetailSnapshot();
    void this.refreshWholesaleFromCache(normalizedUid, sessionVersion, generation).catch(
      () => undefined,
    );
    void retailFinanceDatasetService
      .hydrateFromCache(normalizedUid, sessionVersion)
      .then(() => {
        if (this.isCurrentSession(normalizedUid, sessionVersion, generation)) {
          this.refreshRetailSnapshot();
        }
      })
      .catch(() => undefined);
  }

  public publishWholesale(snapshot: WholesaleFinanceSnapshot): void {
    const currentMonth = this.ensureCurrentMonth();
    if (
      !this.activeSessionScopeKey ||
      snapshot.snapshotSessionScopeKey !== this.activeSessionScopeKey ||
      snapshot.monthKey !== currentMonth
    ) {
      return;
    }

    this.snapshot = {
      ...this.snapshot,
      wholesale: {
        faturamento: formatFinanceWidgetAmount(snapshot.faturamento),
        lucroLiquido: formatFinanceWidgetAmount(snapshot.lucroLiquido),
      },
    };
    this.wholesaleRevision += 1;
    this.publishTimeline();
  }

  private async refreshWholesaleFromCache(
    uid: string,
    sessionVersion: number | undefined,
    generation: number,
  ): Promise<void> {
    const monthKey = getFinanceWidgetMonthKey(new Date());
    const publicationRevision = this.wholesaleRevision;
    const currentSessionKey = sessionScopeKey(uid, sessionVersion);
    const canRun = () => this.isCurrentSession(uid, sessionVersion, generation);
    const costSettingsSessionKey = currentSessionKey;
    const cachedCarSettings = carSettingsStorage.getCached();
    const [periodEntry, costSettings, carSettings, routeSessions] = await Promise.all([
      financialPeriodSnapshotCache.read(uid, monthKey),
      costSettingsStorage.load(uid, {
        canRun,
        sessionKey: costSettingsSessionKey,
      }),
      cachedCarSettings ? Promise.resolve(cachedCarSettings) : carSettingsStorage.load(),
      locationTrackingService.hydrateFinancialRouteSummariesFromCache(),
    ]);

    if (
      !canRun() ||
      this.wholesaleRevision !== publicationRevision ||
      getFinanceWidgetMonthKey(new Date()) !== monthKey ||
      !periodEntry ||
      periodEntry.uid !== uid ||
      periodEntry.displayMonth !== monthKey
    ) {
      return;
    }

    const automaticKilometersByDate =
      routeSessions === null ? {} : summarizeRouteKilometersByDate(routeSessions);
    const fuelCostByDate =
      routeSessions === null
        ? {}
        : calculateFinancialFuelCostsByDate(
            periodEntry.snapshot.gastosDiarios,
            routeSessions,
            financialFuelSettingsForCache(costSettings),
            carSettings,
          );
    const summary = financialCalculationService.calculateResumo({
      deliveries: periodEntry.snapshot.entregas,
      dailyExpenses: periodEntry.snapshot.gastosDiarios,
      filters: wholesaleFinanceFiltersForSelection({ kind: 'month', month: monthKey }),
      monthlyExpenses: periodEntry.snapshot.gastosMensais,
      automaticKilometersByDate,
      fuelCostByDate,
    });

    this.publishWholesale({
      snapshotSessionScopeKey: currentSessionKey,
      monthKey,
      faturamento: summary.faturamento,
      lucroLiquido: routeSessions === null ? null : summary.lucroLiquido,
    });
  }

  private refreshRetailSnapshot(): void {
    const { activeUid, activeSessionVersion } = this;
    if (!activeUid) return;

    const monthKey = this.ensureCurrentMonth();
    const datasetState = retailFinanceDatasetService.getSnapshot(activeUid, activeSessionVersion);
    let retail = emptyFinanceWidgetDomain();

    if (datasetState.dataset && datasetState.coverageComplete) {
      const summary = retailFinanceAggregationService.aggregate(
        datasetState.dataset.orders,
        datasetState.dataset.paymentsByOrderId,
        getHistoryMonthRange(`${monthKey}-01`),
        RETAIL_FINANCE_GENERAL_VIEW,
      );
      retail = {
        faturamento: formatFinanceWidgetAmount(summary.revenueReceived),
        lucroLiquido: formatFinanceWidgetAmount(summary.profit),
      };
    }

    this.snapshot = { ...this.snapshot, retail };
    this.publishTimeline();
  }

  private ensureCurrentMonth(): string {
    const currentMonth = getFinanceWidgetMonthKey(new Date());
    if (this.snapshot.monthKey !== currentMonth) {
      this.wholesaleRevision += 1;
      this.snapshot = unavailableFinanceWidgetProps(currentMonth);
    }
    return currentMonth;
  }

  private isCurrentSession(
    uid: string,
    sessionVersion: number | undefined,
    generation: number,
  ): boolean {
    return (
      this.generation === generation &&
      this.activeUid === uid &&
      this.activeSessionVersion === sessionVersion
    );
  }

  private publishTimeline(): void {
    const updateWidgetTimeline = this.updateWidgetTimeline;
    if (Platform.OS !== 'ios' || !updateWidgetTimeline) return;
    this.snapshot = {
      ...this.snapshot,
      monthLabel: getFinanceWidgetMonthLabel(this.snapshot.monthKey),
    };
    const entries = createFinanceWidgetTimeline(this.snapshot, new Date());
    recordFinanceWidgetPublishStart(entries);
    try {
      updateWidgetTimeline(entries);
      recordFinanceWidgetPublishResult(true, 'update_timeline');
    } catch (error) {
      recordFinanceWidgetPublishResult(false, 'update_timeline', error);
      throw error;
    }
    this.recordPublishedTimelineRead();
  }

  private async loadWidget(generation: number): Promise<void> {
    if (Platform.OS !== 'ios' || this.updateWidgetTimeline) return;

    try {
      const { resumoFinanceiroWidget } = await import('./ResumoFinanceiroWidget');
      if (this.generation !== generation) return;
      this.updateWidgetTimeline =
        resumoFinanceiroWidget.updateTimeline.bind(resumoFinanceiroWidget);
      this.readWidgetTimeline = resumoFinanceiroWidget.getTimeline.bind(resumoFinanceiroWidget);
      this.publishTimeline();
    } catch {
      if (!this.updateWidgetTimeline) {
        recordFinanceWidgetPublishResult(false, 'widget_module_load');
      }
      // expo-widgets is an optional native module in Expo Go.
    }
  }

  private recordPublishedTimelineRead(): void {
    const readWidgetTimeline = this.readWidgetTimeline;
    if (!readWidgetTimeline) return;

    try {
      void readWidgetTimeline()
        .then((entries) => recordFinanceWidgetTimelineRead(true, entries))
        .catch(() => recordFinanceWidgetTimelineRead(false, []));
    } catch {
      recordFinanceWidgetTimelineRead(false, []);
    }
  }
}

export const resumoFinanceiroSnapshotCoordinator = new ResumoFinanceiroSnapshotCoordinator();
