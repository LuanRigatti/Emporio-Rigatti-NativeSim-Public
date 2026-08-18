import { clientDataSource } from '@/services/clients';
import { firestoreDailyMonthlyDataSource, type DailyMonthlyQuery } from '@/services/costs';
import { firestoreDeliveryDataSource } from '@/services/deliveries';
import { factoryReceiptDataSource } from '@/services/factory-purchases';
import { financialPeriodSnapshotCache } from '@/services/finance/FinancialPeriodSnapshotCache';
import { routeTrackingRepository } from '@/services/routes/RouteTrackingRepository';
import { carSettingsStorage, firestoreCarSettingsDataSource } from '@/services/car';
import type { ClientId, ClientModel, DeliveryFilters, FactoryFilters } from '@/types/data';

import { normalizeHomeSearchText } from './HomeSearchQueryParser';
import type {
  HomeSearchCoverage,
  HomeSearchDataSet,
  HomeSearchDataSource,
  HomeSearchFinancialData,
  HomeSearchParsedQuery,
  HomeSearchPeriod,
  HomeSearchSourceError,
  HomeSearchSourceName,
} from './HomeSearchTypes';

type DateBounds = Pick<DeliveryFilters, 'date' | 'startDate' | 'endDate'>;

function routeMatchesPeriod(date: string, period: HomeSearchPeriod): boolean {
  if (period.kind === 'date') return date === period.date;
  if (period.kind === 'year') return date.startsWith(`${period.year}-`);
  if (period.kind === 'dayMonth') {
    return (
      date.slice(5) ===
      `${String(period.month).padStart(2, '0')}-${String(period.day).padStart(2, '0')}`
    );
  }
  const month = String(period.month).padStart(2, '0');
  return period.year ? date.startsWith(`${period.year}-${month}-`) : date.slice(5, 7) === month;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0, 12).getDate();
}

export function dateBoundsForSearch(query: HomeSearchParsedQuery): DateBounds | undefined {
  const period = query.period;
  if (!period) return undefined;
  if (period.kind === 'date') return { date: period.date };
  if (period.kind === 'year') {
    return { startDate: `${period.year}-01-01`, endDate: `${period.year}-12-31` };
  }
  if (period.kind === 'month' && period.year) {
    const prefix = `${period.year}-${String(period.month).padStart(2, '0')}`;
    return {
      startDate: `${prefix}-01`,
      endDate: `${prefix}-${String(lastDayOfMonth(period.year, period.month)).padStart(2, '0')}`,
    };
  }
  return undefined;
}

function matchingClientIds(clients: readonly ClientModel[], text: string): ClientId[] {
  if (!text) return [];
  return clients
    .filter((client) => {
      const address = normalizeHomeSearchText(client.address ?? '');
      return client.normalizedName.includes(text) || address.includes(text);
    })
    .map((client) => client.clientId);
}

export function deliveryFiltersForSearch(
  query: HomeSearchParsedQuery,
  clients: readonly ClientModel[],
): DeliveryFilters | undefined {
  const bounds = dateBoundsForSearch(query);
  const clientIds = matchingClientIds(clients, query.text).filter((id) => id.startsWith('client:'));
  const hasClientFilter = Boolean(query.text && clientIds.length > 0);
  if (!bounds && !hasClientFilter) return undefined;

  return {
    mode: 'all',
    ...bounds,
    ...(hasClientFilter ? { clientIds } : {}),
  };
}

function sourceError(source: HomeSearchSourceName, error: unknown): HomeSearchSourceError {
  return {
    source,
    message: error instanceof Error ? error.message : 'Falha desconhecida.',
  };
}

export class AppHomeSearchDataSource implements HomeSearchDataSource {
  public constructor(
    private readonly userId: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async load(query: HomeSearchParsedQuery): Promise<HomeSearchDataSet> {
    const coverage: HomeSearchCoverage[] = [];
    const errors: HomeSearchSourceError[] = [];
    if (query.factoryPaymentDateUnsupported) {
      coverage.push({
        source: 'factoryPurchases',
        mode: 'skipped',
        reason: 'unsupportedPaymentDate',
      });
      return { clients: [], deliveries: [], factoryPurchases: [], coverage, errors };
    }
    if (query.routeMetric) {
      const routeSessions = await this.loadRoutes(query, coverage, errors);
      return { clients: [], deliveries: [], factoryPurchases: [], routeSessions, coverage, errors };
    }
    if (query.carMetric) {
      const carSettings = await this.loadCarSettings(coverage, errors);
      return { clients: [], deliveries: [], factoryPurchases: [], carSettings, coverage, errors };
    }
    if (query.factoryMetric) {
      const factoryPurchases = await this.loadFactoryIntent(query, coverage, errors);
      return { clients: [], deliveries: [], factoryPurchases, coverage, errors };
    }
    if (query.periodSummary) {
      const [financial, factoryPurchases, routeSessions] = await Promise.all([
        this.loadFinancialData(query, coverage, errors),
        this.loadFactoryIntent(query, coverage, errors),
        this.loadRoutes(query, coverage, errors),
      ]);
      return {
        clients: [],
        deliveries: financial.deliveries,
        factoryPurchases,
        financial,
        routeSessions,
        coverage,
        errors,
      };
    }
    const clients = await this.loadClients(coverage, errors);
    if (query.clientField) {
      return { clients, deliveries: [], factoryPurchases: [], coverage, errors };
    }
    if (query.financialMetric) {
      const [financial, routeSessions] = await Promise.all([
        this.loadFinancialData(query, coverage, errors),
        this.loadRoutes(query, coverage, errors),
      ]);
      return {
        clients,
        deliveries: financial.deliveries,
        factoryPurchases: [],
        financial,
        routeSessions,
        coverage,
        errors,
      };
    }
    const filters = deliveryFiltersForSearch(query, clients);
    const hasClientFilter = Boolean(filters?.clientIds && filters.clientIds.length > 0);
    const deliveries = await this.loadDeliveries(query, clients, coverage, errors);
    const globalDeliveries = hasClientFilter
      ? firestoreDeliveryDataSource.getCached({ mode: 'all' })
      : deliveries;
    const factoryPurchases = await this.loadFactoryPurchases(query, coverage, errors);

    return { clients, deliveries, globalDeliveries, factoryPurchases, coverage, errors };
  }

  private async loadFactoryIntent(
    query: HomeSearchParsedQuery,
    coverage: HomeSearchCoverage[],
    errors: HomeSearchSourceError[],
  ) {
    const bounds = dateBoundsForSearch(query);
    const completed = !bounds
      ? query.factoryStatus === 'paid'
        ? true
        : query.factoryStatus
          ? false
          : undefined
      : undefined;
    const filters: FactoryFilters = {
      period: 'all',
      ...(completed === undefined ? {} : { completed }),
      ...(bounds?.date ? { startDate: bounds.date, endDate: bounds.date } : {}),
      ...(bounds?.startDate ? { startDate: bounds.startDate } : {}),
      ...(bounds?.endDate ? { endDate: bounds.endDate } : {}),
    };
    if (!bounds && completed === undefined) {
      coverage.push({ source: 'factoryPurchases', mode: 'skipped', reason: 'unboundedQuery' });
      return [];
    }
    try {
      await factoryReceiptDataSource.restore(this.userId, filters);
      coverage.push({
        source: 'factoryPurchases',
        mode:
          'isUsingLocalFallback' in factoryReceiptDataSource &&
          factoryReceiptDataSource.isUsingLocalFallback
            ? 'localFallback'
            : 'remote',
      });
    } catch (error) {
      errors.push(sourceError('factoryPurchases', error));
      coverage.push({ source: 'factoryPurchases', mode: 'localFallback', reason: 'sourceError' });
    }
    return factoryReceiptDataSource.getReceipts();
  }

  private async loadRoutes(
    query: HomeSearchParsedQuery,
    coverage: HomeSearchCoverage[],
    errors: HomeSearchSourceError[],
  ) {
    try {
      const period = query.period;
      const sessions =
        period?.kind === 'date'
          ? await routeTrackingRepository.getRouteHistory(period.date)
          : await routeTrackingRepository.getRouteHistory();
      coverage.push({ source: 'routeHistory', mode: 'local' });
      return period ? sessions.filter((session) => routeMatchesPeriod(session.date, period)) : [];
    } catch (error) {
      errors.push(sourceError('routeHistory', error));
      coverage.push({ source: 'routeHistory', mode: 'localFallback', reason: 'sourceError' });
      return [];
    }
  }

  private async loadCarSettings(coverage: HomeSearchCoverage[], errors: HomeSearchSourceError[]) {
    const local = await carSettingsStorage.load();
    try {
      const remote = await firestoreCarSettingsDataSource.load(this.userId);
      coverage.push({ source: 'carSettings', mode: remote ? 'remote' : 'cache' });
      return remote ?? local;
    } catch (error) {
      errors.push(sourceError('carSettings', error));
      coverage.push({ source: 'carSettings', mode: 'localFallback', reason: 'sourceError' });
      return local;
    }
  }

  private async loadFinancialData(
    query: HomeSearchParsedQuery,
    coverage: HomeSearchCoverage[],
    errors: HomeSearchSourceError[],
  ): Promise<HomeSearchFinancialData> {
    const cacheMonth = financialCacheMonth(query);
    if (cacheMonth) {
      const memoryEntry = financialPeriodSnapshotCache.getMemory(this.userId, cacheMonth);
      if (memoryEntry) {
        coverage.push({ source: 'financialData', mode: 'memory' });
        return financialDataFromSnapshot(memoryEntry.snapshot, true);
      }

      const cachedEntry = await financialPeriodSnapshotCache.read(this.userId, cacheMonth);
      if (cachedEntry) {
        coverage.push({ source: 'financialData', mode: 'cache' });
        return financialDataFromSnapshot(cachedEntry.snapshot, true);
      }
    }

    const bounds = financialDateBoundsForSearch(query, this.now());
    if (!bounds) {
      coverage.push({ source: 'financialData', mode: 'skipped', reason: 'missingPeriod' });
      return { costsAvailable: false, dailyExpenses: {}, deliveries: [], monthlyExpenses: {} };
    }

    const deliveryFilters: DeliveryFilters = { mode: 'all', ...bounds };
    let deliveryFallback = false;
    let deliveries;
    try {
      deliveries = await firestoreDeliveryDataSource.load(this.userId, deliveryFilters);
    } catch (error) {
      deliveryFallback = true;
      errors.push(sourceError('financialData', error));
      deliveries = firestoreDeliveryDataSource.getCached(deliveryFilters);
    }

    let costsAvailable = true;
    let dailyExpenses = {};
    let monthlyExpenses = {};
    try {
      const costs = await firestoreDailyMonthlyDataSource.load(
        this.userId,
        financialCostQuery(query, bounds),
      );
      dailyExpenses = costs.gastosDiarios;
      monthlyExpenses = costs.gastosMensais;
    } catch (error) {
      costsAvailable = false;
      errors.push(sourceError('financialData', error));
    }

    coverage.push({
      source: 'financialData',
      mode: deliveryFallback || !costsAvailable ? 'localFallback' : 'remote',
      ...(deliveryFallback || !costsAvailable ? { reason: 'partialRemoteFallback' } : {}),
    });
    return { costsAvailable, dailyExpenses, deliveries, monthlyExpenses };
  }

  private async loadClients(
    coverage: HomeSearchCoverage[],
    errors: HomeSearchSourceError[],
  ): Promise<ClientModel[]> {
    try {
      if (clientDataSource.getSnapshot() === null) {
        await clientDataSource.load(this.userId);
        coverage.push({
          source: 'clients',
          mode:
            'isUsingLocalFallback' in clientDataSource && clientDataSource.isUsingLocalFallback
              ? 'localFallback'
              : 'remote',
        });
      } else {
        coverage.push({ source: 'clients', mode: 'memory' });
      }
      return clientDataSource.list({}, this.userId);
    } catch (error) {
      errors.push(sourceError('clients', error));
      coverage.push({ source: 'clients', mode: 'localFallback', reason: 'sourceError' });
      return clientDataSource.list({}, this.userId);
    }
  }

  private async loadDeliveries(
    query: HomeSearchParsedQuery,
    clients: readonly ClientModel[],
    coverage: HomeSearchCoverage[],
    errors: HomeSearchSourceError[],
  ) {
    const filters = deliveryFiltersForSearch(query, clients);

    if (filters) {
      try {
        const deliveries = await firestoreDeliveryDataSource.load(this.userId, filters);
        coverage.push({ source: 'deliveries', mode: 'remote' });
        return deliveries;
      } catch (error) {
        errors.push(sourceError('deliveries', error));
        coverage.push({ source: 'deliveries', mode: 'memory', reason: 'remoteFallback' });
        return firestoreDeliveryDataSource.getCached(filters);
      }
    }

    coverage.push({ source: 'deliveries', mode: 'memory', reason: 'unboundedQuery' });
    return firestoreDeliveryDataSource.getCached({ mode: 'all' });
  }

  private async loadFactoryPurchases(
    query: HomeSearchParsedQuery,
    coverage: HomeSearchCoverage[],
    errors: HomeSearchSourceError[],
  ) {
    const bounds = dateBoundsForSearch(query);
    const shouldLoadRemote = Boolean(bounds && !query.text && !query.documentType);
    if (shouldLoadRemote && bounds) {
      const filters: FactoryFilters = {
        period: 'all',
        ...(bounds.date ? { startDate: bounds.date, endDate: bounds.date } : {}),
        ...(bounds.startDate ? { startDate: bounds.startDate } : {}),
        ...(bounds.endDate ? { endDate: bounds.endDate } : {}),
      };
      try {
        await factoryReceiptDataSource.restore(this.userId, filters);
        coverage.push({
          source: 'factoryPurchases',
          mode:
            'isUsingLocalFallback' in factoryReceiptDataSource &&
            factoryReceiptDataSource.isUsingLocalFallback
              ? 'localFallback'
              : 'remote',
        });
      } catch (error) {
        errors.push(sourceError('factoryPurchases', error));
        coverage.push({ source: 'factoryPurchases', mode: 'memory', reason: 'remoteFallback' });
      }
    } else {
      coverage.push({
        source: 'factoryPurchases',
        mode: 'memory',
        reason: query.text ? 'unrelatedText' : bounds ? 'documentQuery' : 'unboundedQuery',
      });
    }
    return factoryReceiptDataSource.getReceipts();
  }
}

function financialCacheMonth(query: HomeSearchParsedQuery): string | undefined {
  const period = query.period;
  if (!period) return undefined;
  if (period.kind === 'date') return period.date.slice(0, 7);
  if (period.kind === 'month' && period.year) {
    return `${period.year}-${String(period.month).padStart(2, '0')}`;
  }
  return undefined;
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function financialDateBoundsForSearch(
  query: HomeSearchParsedQuery,
  today = new Date(),
): DateBounds | undefined {
  const bounds = dateBoundsForSearch(query);
  const period = query.period;
  if (
    bounds?.endDate &&
    period?.kind === 'month' &&
    period.year === today.getFullYear() &&
    period.month === today.getMonth() + 1
  ) {
    return { ...bounds, endDate: localDateKey(today) };
  }
  return bounds;
}

function financialDataFromSnapshot(
  snapshot: {
    entregas: HomeSearchFinancialData['deliveries'];
    gastosDiarios: HomeSearchFinancialData['dailyExpenses'];
    gastosMensais: HomeSearchFinancialData['monthlyExpenses'];
  },
  costsAvailable: boolean,
): HomeSearchFinancialData {
  return {
    costsAvailable,
    dailyExpenses: snapshot.gastosDiarios,
    deliveries: snapshot.entregas,
    monthlyExpenses: snapshot.gastosMensais,
  };
}

function financialCostQuery(query: HomeSearchParsedQuery, bounds: DateBounds): DailyMonthlyQuery {
  const cacheMonth = financialCacheMonth(query);
  if (
    query.period?.kind === 'month' &&
    query.period.year &&
    cacheMonth &&
    bounds.endDate ===
      `${cacheMonth}-${String(lastDayOfMonth(query.period.year, query.period.month)).padStart(2, '0')}`
  ) {
    return { month: cacheMonth };
  }
  if (bounds.date) return { date: bounds.date };
  return {
    ...(bounds.startDate ? { startDate: bounds.startDate } : {}),
    ...(bounds.endDate ? { endDate: bounds.endDate } : {}),
  };
}
