import {
  AppHomeSearchDataSource,
  deliveryFiltersForSearch,
} from '@/features/home/search/HomeSearchDataSource';
import { HomeSearchQueryParser } from '@/features/home/search/HomeSearchQueryParser';
import { HomeSearchService } from '@/features/home/search/HomeSearchService';
import { clientDataSource } from '@/services/clients';
import { firestoreDeliveryDataSource } from '@/services/deliveries';
import { factoryReceiptDataSource } from '@/services/factory-purchases';
import { firestoreDailyMonthlyDataSource } from '@/services/costs';
import { financialCalculationService } from '@/services/finance/FinancialCalculationService';
import { financialFiltersForSelection } from '@/services/finance/FinancialPeriodService';
import { financialPeriodSnapshotCache } from '@/services/finance/FinancialPeriodSnapshotCache';
import { routeTrackingRepository } from '@/services/routes/RouteTrackingRepository';
import { carSettingsStorage, firestoreCarSettingsDataSource } from '@/services/car';
import type {
  HomeSearchDataSet,
  HomeSearchDataSource,
  HomeSearchFinancialMetric,
  HomeSearchParsedQuery,
} from '@/features/home/search/HomeSearchTypes';
import type { ClientModel, Delivery, FactoryReceipt } from '@/types/data';
import type { RouteTrackingSession } from '@/types/routeTracking';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(undefined),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/services/clients', () => ({
  clientDataSource: {
    getSnapshot: jest.fn(),
    list: jest.fn(),
    load: jest.fn(),
    mode: 'firebase',
  },
}));

jest.mock('@/services/deliveries', () => ({
  firestoreDeliveryDataSource: {
    getCached: jest.fn(),
    load: jest.fn(),
    loadAllHistorical: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('@/services/factory-purchases', () => ({
  factoryReceiptDataSource: {
    getReceipts: jest.fn(),
    mode: 'firebase',
    restore: jest.fn(),
  },
}));

jest.mock('@/services/costs', () => ({
  firestoreDailyMonthlyDataSource: {
    load: jest.fn(),
  },
}));

jest.mock('@/services/routes/RouteTrackingRepository', () => ({
  routeTrackingRepository: {
    getRouteHistory: jest.fn(),
  },
}));

jest.mock('@/services/car', () => ({
  carSettingsStorage: { load: jest.fn() },
  firestoreCarSettingsDataSource: { load: jest.fn() },
}));

const clients: ClientModel[] = [
  {
    clientId: 'client:andre',
    canonicalName: 'Andr\u00e9',
    normalizedName: 'andre',
    sources: ['custom'],
    address: 'Rua das Flores',
    currentPrice: 50,
    hasIncompleteAddress: false,
    usesInvoice: true,
    usesBoleto: false,
  },
  {
    clientId: 'client:andressa',
    canonicalName: 'Andressa',
    normalizedName: 'andressa',
    sources: ['custom'],
    hasIncompleteAddress: true,
    usesInvoice: false,
    usesBoleto: true,
  },
  {
    clientId: 'client:luciano',
    canonicalName: 'Luciano',
    normalizedName: 'luciano',
    sources: ['custom'],
    address: 'Rua do Luciano',
    currentPrice: 49.8,
    hasIncompleteAddress: false,
    usesInvoice: false,
    usesBoleto: false,
  },
];

const deliveries: Delivery[] = [
  {
    id: 'delivery-andre-2026-08-12',
    clientId: 'client:andre',
    cliente: 'Andr\u00e9',
    quantidade: 3,
    valor: 150,
    status: 'Pago',
    entregue: true,
    data: '2026-08-12',
    invoiceStatus: 'a_emitir',
  },
  {
    id: 'delivery-andressa-2026-08-13',
    clientId: 'client:andressa',
    cliente: 'Andressa',
    quantidade: 2,
    valor: 100,
    status: 'N\u00e3o Pago',
    entregue: true,
    data: '2026-08-13',
  },
  {
    id: 'delivery-luciano-2025-08-12',
    clientId: 'client:luciano',
    cliente: 'Luciano',
    quantidade: 4,
    valor: 200,
    status: 'N\u00e3o Pago',
    entregue: true,
    data: '2025-08-12',
  },
  {
    id: 'delivery-luciano-2026-09-01',
    clientId: 'client:luciano',
    cliente: 'Luciano',
    quantidade: 1,
    valor: 50,
    status: 'Pago',
    entregue: true,
    data: '2026-09-01',
  },
];

const factoryPurchases: FactoryReceipt[] = [
  {
    id: 'factory-2026-08-12',
    quantidade: 3,
    data: '2026-08-12',
    valorTotal: 150,
    concluido: true,
    pagamentos: [{ id: 'factory-payment-paid', data: '2026-08-12', valor: 150 }],
  },
  {
    id: 'factory-2025-08-10',
    quantidade: 4,
    data: '2025-08-10',
    valorTotal: 200,
    concluido: false,
    pagamentos: [],
  },
  {
    id: 'factory-partial-2026-08-14',
    quantidade: 6,
    data: '2026-08-14',
    valorTotal: 300,
    concluido: false,
    pagamentos: [{ id: 'factory-payment-partial', data: '2026-09-02', valor: 100 }],
  },
  {
    id: 'factory-open-2026-08-15',
    quantidade: 2,
    data: '2026-08-15',
    valorTotal: 100,
    concluido: false,
    pagamentos: [],
  },
];

const financialDeliveries: Delivery[] = [
  deliveries[0],
  deliveries[1],
  {
    id: 'delivery-luciano-2026-08-14',
    clientId: 'client:luciano',
    cliente: 'Luciano',
    quantidade: 7,
    valor: 350,
    status: 'Pago',
    entregue: true,
    data: '2026-08-14',
  },
  {
    id: 'delivery-luciano-2026-08-17',
    clientId: 'client:luciano',
    cliente: 'Luciano',
    quantidade: 9,
    valor: 450,
    status: 'Não Pago',
    entregue: true,
    data: '2026-08-17',
  },
];

const financialData = {
  costsAvailable: true,
  deliveries: financialDeliveries,
  dailyExpenses: {
    '2026-08-12': {
      data: '2026-08-12',
      km: 74,
      precoGasolina: 6,
      tipoCombustivel: 'gasolina',
      estar: 10,
      outros: 18,
    },
  },
  monthlyExpenses: { '2026-08': { luz: 100 } },
};

function routeSession(id: string, date: string, distanceMeters: number): RouteTrackingSession {
  return {
    id,
    date,
    distanceMeters,
    durationSeconds: 600,
    startTimestamp: 1_000,
    endTimestamp: 601_000,
    pointsCount: 2,
    samples: [],
    status: 'finalized',
  };
}

const dataSet: HomeSearchDataSet = {
  clients,
  deliveries,
  factoryPurchases,
  financial: financialData,
  coverage: [
    { source: 'clients', mode: 'memory' },
    { source: 'deliveries', mode: 'memory' },
    { source: 'factoryPurchases', mode: 'memory' },
  ],
  errors: [],
};

class FixedDataSource implements HomeSearchDataSource {
  public calls = 0;

  public async load(): Promise<HomeSearchDataSet> {
    this.calls += 1;
    return dataSet;
  }
}

function resultIds(response: Awaited<ReturnType<HomeSearchService['search']>>): string[] {
  return response.results.map((result) => result.id);
}

const mockedClientDataSource = jest.mocked(clientDataSource);
const mockedDeliveryDataSource = jest.mocked(firestoreDeliveryDataSource);
const mockedFactoryDataSource = jest.mocked(factoryReceiptDataSource);
const mockedCostDataSource = jest.mocked(firestoreDailyMonthlyDataSource);
const mockedRouteRepository = jest.mocked(routeTrackingRepository);
const mockedCarStorage = jest.mocked(carSettingsStorage);
const mockedCarDataSource = jest.mocked(firestoreCarSettingsDataSource);

describe('HomeSearchQueryParser', () => {
  const parser = new HomeSearchQueryParser();
  const referenceDate = new Date(2026, 7, 13, 12);

  it('normalizes accents, case and repeated whitespace', () => {
    expect(parser.parse('  ANDR\u00c9   da Silva  ')).toMatchObject({
      normalized: 'andre da silva',
      text: 'andre da silva',
      detectedTypes: ['text'],
    });
  });

  it('resolves a named month without year to the current year', () => {
    expect(parser.parse('agosto', referenceDate).period).toEqual({
      kind: 'month',
      month: 8,
      year: 2026,
    });
  });

  it('resolves a numeric date without year to the current year', () => {
    expect(parser.parse('12/08', referenceDate).period).toEqual({
      kind: 'date',
      date: '2026-08-12',
    });
  });

  it('resolves hoje to the reference date', () => {
    expect(parser.parse('rotas hoje', referenceDate).period).toEqual({
      kind: 'date',
      date: '2026-08-13',
    });
  });

  it('preserves explicit month/year formats', () => {
    expect(parser.parse('08/2025', referenceDate).period).toEqual({
      kind: 'month',
      month: 8,
      year: 2025,
    });
    expect(parser.parse('2025/08', referenceDate).period).toEqual({
      kind: 'month',
      month: 8,
      year: 2025,
    });
    expect(parser.parse('2027-11', referenceDate).period).toEqual({
      kind: 'month',
      month: 11,
      year: 2027,
    });
    expect(parser.parse('agosto 2025', referenceDate).period).toEqual({
      kind: 'month',
      month: 8,
      year: 2025,
    });
  });

  it('preserves complete dates', () => {
    expect(parser.parse('12/08/2025', referenceDate).period).toEqual({
      kind: 'date',
      date: '2025-08-12',
    });
    expect(parser.parse('2026-08-12', referenceDate).period).toEqual({
      kind: 'date',
      date: '2026-08-12',
    });
  });

  it('recognizes quantity, money and payment status filters', () => {
    expect(parser.parse('3 baldes')).toMatchObject({ quantity: 3, detectedTypes: ['quantity'] });
    expect(parser.parse('R$ 150,00')).toMatchObject({ money: 150, detectedTypes: ['money'] });
    expect(parser.parse('pago').paymentStatus).toBe('paid');
    expect(parser.parse('n\u00e3o pago').paymentStatus).toBe('open');
    expect(parser.parse('em aberto').paymentStatus).toBe('open');
  });

  it('recognizes financial aliases, preserves client text and defaults to the current month', () => {
    expect(parser.parse('  FATURAMENTO   Luciano  ', referenceDate)).toMatchObject({
      financialMetric: 'revenue',
      financialMetricAlias: 'faturamento',
      text: 'luciano',
      period: { kind: 'month', month: 8, year: 2026 },
    });
    expect(parser.parse('lucro líquido agosto', referenceDate)).toMatchObject({
      financialMetric: 'netProfit',
      text: '',
    });
  });

  it('recognizes client, factory, route, car and period-summary intents deterministically', () => {
    expect(parser.parse('valor do balde Luciano', referenceDate)).toMatchObject({
      clientField: 'currentPrice',
      text: 'luciano',
    });
    expect(parser.parse('pagamentos das compras de agosto', referenceDate)).toMatchObject({
      factoryMetric: 'payments',
      period: { kind: 'month', month: 8, year: 2026 },
    });
    expect(parser.parse('km 12/08', referenceDate)).toMatchObject({
      routeMetric: 'distance',
      period: { kind: 'date', date: '2026-08-12' },
    });
    expect(parser.parse('rotas agosto', referenceDate)).toMatchObject({
      routeMetric: 'routes',
      period: { kind: 'month', month: 8, year: 2026 },
    });
    expect(parser.parse('autonomia ÁLCOOL', referenceDate).carMetric).toBe('alcoholAutonomy');
    expect(parser.parse('dados do dia 12/08', referenceDate).periodSummary).toBe(true);
  });

  it.each([
    'pagamentos realizados em agosto',
    'pagamentos pagos em agosto',
    'parcelas pagas em agosto',
  ])('marks payment-date intent as unsupported for %s', (query) => {
    expect(parser.parse(query, referenceDate)).toMatchObject({
      factoryMetric: 'payments',
      factoryPaymentDateUnsupported: true,
    });
  });
});

describe('AppHomeSearchDataSource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedClientDataSource.getSnapshot.mockReturnValue({} as never);
    mockedClientDataSource.list.mockReturnValue(clients);
    mockedDeliveryDataSource.getCached.mockReturnValue(deliveries);
    mockedFactoryDataSource.getReceipts.mockReturnValue(factoryPurchases);
    mockedFactoryDataSource.restore.mockResolvedValue(undefined);
    mockedDeliveryDataSource.load.mockResolvedValue(financialDeliveries);
    mockedCostDataSource.load.mockResolvedValue({
      gastosDiarios: financialData.dailyExpenses,
      gastosMensais: financialData.monthlyExpenses,
    });
    mockedRouteRepository.getRouteHistory.mockResolvedValue([]);
    mockedCarStorage.load.mockResolvedValue({
      gasolineAutonomy: '7,4 Km/l',
      alcoholAutonomy: '5,6 Km/l',
    });
    mockedCarDataSource.load.mockResolvedValue({
      gasolineAutonomy: '8,2 Km/l',
      alcoholAutonomy: '6,1 Km/l',
    });
  });

  it('builds the indexed client plus month query without dropping either dimension', () => {
    const query = new HomeSearchQueryParser().parse('Luciano 08/2025');

    expect(deliveryFiltersForSearch(query, clients)).toEqual({
      mode: 'all',
      startDate: '2025-08-01',
      endDate: '2025-08-31',
      clientIds: ['client:luciano'],
    });
  });

  it('returns an empty remote snapshot instead of reusing the global cache', async () => {
    mockedDeliveryDataSource.load.mockResolvedValue([]);
    mockedDeliveryDataSource.getCached.mockReturnValue([
      deliveries.find(({ id }) => id === 'delivery-luciano-2025-08-12')!,
    ]);
    mockedFactoryDataSource.getReceipts.mockReturnValue([]);
    const query = new HomeSearchQueryParser().parse('01/2099');

    const data = await new AppHomeSearchDataSource('uid').load(query);

    expect(data.deliveries).toEqual([]);
    expect(mockedDeliveryDataSource.getCached).not.toHaveBeenCalled();
  });

  it('uses the complete client, period and status scope when remote loading fails', async () => {
    mockedDeliveryDataSource.load.mockRejectedValue(new Error('The query requires an index.'));
    mockedDeliveryDataSource.getCached.mockReturnValue(deliveries);
    mockedFactoryDataSource.getReceipts.mockReturnValue([]);
    const query = new HomeSearchQueryParser().parse(
      'Andr\u00e9 agosto 2026 3 baldes R$ 150,00 pago nota fiscal',
    );

    const data = await new AppHomeSearchDataSource('uid').load(query);

    expect(mockedDeliveryDataSource.getCached).toHaveBeenCalledWith({
      mode: 'all',
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      clientIds: ['client:andre', 'client:andressa'],
    });
    expect(data.errors).toEqual([
      { source: 'deliveries', message: 'The query requires an index.' },
    ]);

    const response = await new HomeSearchService({ load: async () => data }).searchParsed(query);
    expect(resultIds(response)).toEqual(['client:andre', 'delivery-andre-2026-08-12']);
  });

  it('loads financial deliveries and costs by period without narrowing deliveries to one client', async () => {
    const query = new HomeSearchQueryParser().parse(
      'faturamento Luciano agosto',
      new Date(2026, 7, 13, 12),
    );

    const data = await new AppHomeSearchDataSource('uid', () => new Date(2026, 7, 13, 12)).load(
      query,
    );

    expect(mockedDeliveryDataSource.load).toHaveBeenCalledWith('uid', {
      mode: 'all',
      startDate: '2026-08-01',
      endDate: '2026-08-13',
    });
    expect(mockedCostDataSource.load).toHaveBeenCalledWith('uid', {
      startDate: '2026-08-01',
      endDate: '2026-08-13',
    });
    expect(data.financial).toMatchObject({ costsAvailable: true });
    expect(data.factoryPurchases).toEqual([]);
  });

  it('uses the existing financial memory cache before performing remote reads', async () => {
    const snapshot = {
      clientesCustom: {},
      entregas: financialDeliveries,
      gastosDiarios: financialData.dailyExpenses,
      gastosMensais: financialData.monthlyExpenses,
      recebimentoBaldes: [],
    };
    jest.spyOn(financialPeriodSnapshotCache, 'getMemory').mockReturnValueOnce({
      cacheVersion: 1,
      uid: 'uid',
      displayMonth: '2026-08',
      snapshot,
      comparisonSnapshot: snapshot,
      cachedAt: Date.now(),
    });
    const query = new HomeSearchQueryParser().parse(
      'faturamento agosto',
      new Date(2026, 7, 13, 12),
    );

    const data = await new AppHomeSearchDataSource('uid').load(query);

    expect(data.financial?.deliveries).toEqual(financialDeliveries);
    expect(data.coverage).toContainEqual({ source: 'financialData', mode: 'memory' });
    expect(mockedDeliveryDataSource.load).not.toHaveBeenCalled();
    expect(mockedCostDataSource.load).not.toHaveBeenCalled();
  });

  it('dispatches client field searches without loading unrelated domains', async () => {
    const query = new HomeSearchQueryParser().parse('preço Luciano');

    const data = await new AppHomeSearchDataSource('uid').load(query);

    expect(data.clients).toEqual(clients);
    expect(mockedDeliveryDataSource.load).not.toHaveBeenCalled();
    expect(mockedFactoryDataSource.restore).not.toHaveBeenCalled();
    expect(mockedRouteRepository.getRouteHistory).not.toHaveBeenCalled();
  });

  it('loads globalDeliveries through loadAllHistorical when a client is searched', async () => {
    const historicalDeliveries = [
      ...deliveries,
      {
        id: 'del-old-other-client',
        clientId: 'client:andre' as const,
        cliente: 'André',
        data: '2025-01-10',
        quantidade: 10,
        valor: 500,
        status: 'Pago' as const,
        entregue: true,
      },
    ];
    mockedDeliveryDataSource.load.mockResolvedValueOnce(
      deliveries.filter((d) => d.cliente === 'Luciano'),
    );
    mockedDeliveryDataSource.loadAllHistorical.mockResolvedValueOnce(historicalDeliveries);
    const query = new HomeSearchQueryParser().parse('Luciano');

    const data = await new AppHomeSearchDataSource('uid').load(query);

    expect(mockedDeliveryDataSource.loadAllHistorical).toHaveBeenCalledWith('uid');
    expect(data.globalDeliveries).toEqual(historicalDeliveries);
    expect(data.deliveries).toEqual(deliveries.filter((d) => d.cliente === 'Luciano'));
    expect(data.coverage).toContainEqual({
      source: 'deliveries',
      mode: 'remote',
      reason: 'historicalDeliveries',
    });
  });

  it('uses a bounded factory query and treats the period as the purchase date', async () => {
    const query = new HomeSearchQueryParser().parse(
      'pagamentos fábrica agosto',
      new Date(2026, 7, 13, 12),
    );

    await new AppHomeSearchDataSource('uid').load(query);

    expect(mockedFactoryDataSource.restore).toHaveBeenCalledWith('uid', {
      period: 'all',
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    });
    expect(mockedDeliveryDataSource.load).not.toHaveBeenCalled();
    expect(mockedRouteRepository.getRouteHistory).not.toHaveBeenCalled();
  });

  it('bounds an exact factory purchase date without scanning other receipts', async () => {
    const query = new HomeSearchQueryParser().parse(
      'compra fábrica 12/08',
      new Date(2026, 7, 13, 12),
    );

    await new AppHomeSearchDataSource('uid').load(query);

    expect(mockedFactoryDataSource.restore).toHaveBeenCalledWith('uid', {
      period: 'all',
      startDate: '2026-08-12',
      endDate: '2026-08-12',
    });
  });

  it('queries only unfinished factory receipts for an unbounded outstanding intent', async () => {
    const query = new HomeSearchQueryParser().parse('a pagar fábrica');

    await new AppHomeSearchDataSource('uid').load(query);

    expect(mockedFactoryDataSource.restore).toHaveBeenCalledWith('uid', {
      completed: false,
      period: 'all',
    });
  });

  it('performs no reads for unsupported payment-date filters', async () => {
    const query = new HomeSearchQueryParser().parse('parcelas pagas em agosto');

    await new AppHomeSearchDataSource('uid').load(query);

    expect(mockedFactoryDataSource.restore).not.toHaveBeenCalled();
    expect(mockedDeliveryDataSource.load).not.toHaveBeenCalled();
    expect(mockedRouteRepository.getRouteHistory).not.toHaveBeenCalled();
  });

  it('loads route sessions and financial data for route searches', async () => {
    mockedRouteRepository.getRouteHistory.mockResolvedValue([
      routeSession('route-12', '2026-08-12', 12_500),
    ]);
    mockedCostDataSource.load.mockResolvedValue({
      gastosDiarios: {},
      gastosMensais: {},
    });
    mockedDeliveryDataSource.load.mockResolvedValue([]);
    const query = new HomeSearchQueryParser().parse('km 12/08', new Date(2026, 7, 13, 12));

    const data = await new AppHomeSearchDataSource('uid').load(query);

    expect(data.routeSessions).toHaveLength(1);
    expect(data.coverage).toContainEqual({ source: 'routeHistory', mode: 'local' });
    expect(mockedClientDataSource.load).not.toHaveBeenCalled();
    expect(mockedFactoryDataSource.restore).not.toHaveBeenCalled();
    expect(mockedRouteRepository.getRouteHistory).toHaveBeenCalledWith('2026-08-12');
  });

  it('filters a route month inside the local repository result', async () => {
    mockedRouteRepository.getRouteHistory.mockResolvedValue([
      routeSession('route-august', '2026-08-12', 12_500),
      routeSession('route-september', '2026-09-02', 7_500),
    ]);
    const query = new HomeSearchQueryParser().parse(
      'quilometragem agosto',
      new Date(2026, 7, 13, 12),
    );

    const data = await new AppHomeSearchDataSource('uid').load(query);

    expect(data.routeSessions?.map(({ id }) => id)).toEqual(['route-august']);
    expect(mockedRouteRepository.getRouteHistory).toHaveBeenCalledWith();
  });

  it('loads the single car settings document with local fallback available', async () => {
    const query = new HomeSearchQueryParser().parse('autonomia gasolina');

    const data = await new AppHomeSearchDataSource('uid').load(query);

    expect(mockedCarStorage.load).toHaveBeenCalledTimes(1);
    expect(mockedCarDataSource.load).toHaveBeenCalledWith('uid');
    expect(data.carSettings?.gasolineAutonomy).toBe('8,2 Km/l');
  });

  it('uses local car settings when the single remote settings read fails', async () => {
    mockedCarDataSource.load.mockRejectedValue(new Error('offline'));
    const query = new HomeSearchQueryParser().parse('autonomia álcool');

    const data = await new AppHomeSearchDataSource('uid').load(query);

    expect(data.carSettings?.alcoholAutonomy).toBe('5,6 Km/l');
    expect(data.coverage).toContainEqual({
      source: 'carSettings',
      mode: 'localFallback',
      reason: 'sourceError',
    });
  });

  it('loads only bounded business sources for a period summary', async () => {
    mockedRouteRepository.getRouteHistory.mockResolvedValue([
      routeSession('route-12', '2026-08-12', 12_500),
    ]);
    const query = new HomeSearchQueryParser().parse('resumo agosto', new Date(2026, 7, 13, 12));

    await new AppHomeSearchDataSource('uid', () => new Date(2026, 7, 13, 12)).load(query);

    expect(mockedDeliveryDataSource.load).toHaveBeenCalledWith('uid', {
      mode: 'all',
      startDate: '2026-08-01',
      endDate: '2026-08-13',
    });
    expect(mockedCostDataSource.load).toHaveBeenCalledWith('uid', {
      startDate: '2026-08-01',
      endDate: '2026-08-13',
    });
    expect(mockedFactoryDataSource.restore).toHaveBeenCalledWith('uid', {
      period: 'all',
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    });
    expect(mockedRouteRepository.getRouteHistory).toHaveBeenCalledWith();
    expect(mockedClientDataSource.load).not.toHaveBeenCalled();
  });
});

describe('HomeSearchService', () => {
  it('returns no results and performs no reads for an empty query', async () => {
    const dataSource = new FixedDataSource();
    const response = await new HomeSearchService(dataSource).search('   ');

    expect(response.results).toEqual([]);
    expect(response.coverage).toEqual([]);
    expect(dataSource.calls).toBe(0);
  });

  it('ranks exact client match before prefix and related deliveries', async () => {
    const response = await new HomeSearchService(new FixedDataSource()).search('ANDR\u00c9');

    expect(response.results[0]).toMatchObject({ id: 'client:andre', type: 'client' });
    expect(response.results.find((result) => result.id === 'client:andressa')?.score).toBeLessThan(
      response.results[0].score,
    );
    expect(resultIds(response)).toContain('delivery-andre-2026-08-12');
  });

  it('supports prefix and partial client matching', async () => {
    const service = new HomeSearchService(new FixedDataSource());
    const prefix = await service.search('andr');
    const partial = await service.search('dressa');

    expect(resultIds(prefix)).toEqual(expect.arrayContaining(['client:andre', 'client:andressa']));
    expect(resultIds(partial)).toEqual(
      expect.arrayContaining(['client:andressa', 'delivery-andressa-2026-08-13']),
    );
  });

  it('returns a client with typed aggregation and related deliveries', async () => {
    const response = await new HomeSearchService(new FixedDataSource()).search('Luciano');
    const client = response.results.find((result) => result.id === 'client:luciano');

    expect(client).toMatchObject({
      type: 'client',
      data: { aggregation: { deliveryCount: 2, quantity: 5, revenue: 250 } },
    });
    expect(resultIds(response)).toEqual(
      expect.arrayContaining(['delivery-luciano-2025-08-12', 'delivery-luciano-2026-09-01']),
    );
  });

  it('searches client address while preserving ID-based delivery relations', async () => {
    const response = await new HomeSearchService(new FixedDataSource()).search('Flores');

    expect(resultIds(response)).toEqual(
      expect.arrayContaining(['client:andre', 'delivery-andre-2026-08-12']),
    );
  });

  it('filters exact date across deliveries and factory purchases', async () => {
    const response = await new HomeSearchService(new FixedDataSource()).search('12/08/2026');

    expect(resultIds(response)).toEqual(
      expect.arrayContaining(['delivery-andre-2026-08-12', 'factory-2026-08-12']),
    );
    expect(resultIds(response)).not.toContain('delivery-luciano-2025-08-12');
  });

  it('matches a named month only in the current year', async () => {
    const query = new HomeSearchQueryParser().parse('agosto', new Date(2026, 7, 13, 12));
    const response = await new HomeSearchService(new FixedDataSource()).searchParsed(query);

    expect(resultIds(response)).toEqual(
      expect.arrayContaining(['delivery-andre-2026-08-12', 'factory-2026-08-12']),
    );
    expect(resultIds(response)).not.toContain('delivery-luciano-2025-08-12');
    expect(resultIds(response)).not.toContain('factory-2025-08-10');
  });

  it('matches a date without year only in the current year', async () => {
    const query = new HomeSearchQueryParser().parse('12/08', new Date(2026, 7, 13, 12));
    const response = await new HomeSearchService(new FixedDataSource()).searchParsed(query);

    expect(resultIds(response)).toEqual(
      expect.arrayContaining(['delivery-andre-2026-08-12', 'factory-2026-08-12']),
    );
    expect(resultIds(response)).not.toContain('delivery-luciano-2025-08-12');
  });

  it('filters any explicit month/year present in data', async () => {
    const response = await new HomeSearchService(new FixedDataSource()).search('08/2025');

    expect(resultIds(response)).toEqual(
      expect.arrayContaining(['delivery-luciano-2025-08-12', 'factory-2025-08-10']),
    );
    expect(resultIds(response)).not.toContain('delivery-andre-2026-08-12');
  });

  it('returns empty for an explicit period without data', async () => {
    const response = await new HomeSearchService(new FixedDataSource()).search('01/2099');

    expect(response.results).toEqual([]);
  });

  it('replaces Luciano results with an exactly empty nonexistent period response', async () => {
    const dataSource: HomeSearchDataSource = {
      load: jest
        .fn<Promise<HomeSearchDataSet>, [HomeSearchParsedQuery]>()
        .mockResolvedValueOnce(dataSet)
        .mockResolvedValueOnce({ ...dataSet, deliveries: [], factoryPurchases: [] }),
    };
    const service = new HomeSearchService(dataSource);

    const first = await service.search('Luciano');
    const second = await service.search('01/2099');

    expect(first.results.length).toBeGreaterThan(0);
    expect(second.results).toEqual([]);
    expect(second.counts).toEqual({
      client: 0,
      delivery: 0,
      factoryPurchase: 0,
      financialMetric: 0,
      factorySummary: 0,
      routeSummary: 0,
      carSetting: 0,
      periodSummary: 0,
    });
  });

  it('keeps Luciano, empty period and M\u00e1rcia searches completely independent', async () => {
    const marcia: ClientModel = {
      clientId: 'client:marcia',
      canonicalName: 'M\u00e1rcia',
      normalizedName: 'marcia',
      sources: ['custom'],
      hasIncompleteAddress: true,
      usesInvoice: false,
      usesBoleto: false,
    };
    const marciaDelivery: Delivery = {
      id: 'delivery-marcia',
      clientId: marcia.clientId,
      cliente: marcia.canonicalName,
      quantidade: 1,
      valor: 50,
      status: 'Pago',
      entregue: true,
      data: '2026-08-14',
    };
    const service = new HomeSearchService({
      load: async () => ({
        ...dataSet,
        clients: [...clients, marcia],
        deliveries: [...deliveries, marciaDelivery],
      }),
    });

    const luciano = await service.search('Luciano');
    const nonexistent = await service.search('01/2099');
    const marciaResponse = await service.search('M\u00e1rcia');

    expect(resultIds(luciano)).toContain('client:luciano');
    expect(nonexistent.results).toEqual([]);
    expect(resultIds(marciaResponse)).toEqual(['client:marcia', 'delivery-marcia']);
  });

  it('combines client with named month, month/year and exact date', async () => {
    const service = new HomeSearchService(new FixedDataSource());
    const namedMonth = new HomeSearchQueryParser().parse(
      'Luciano agosto',
      new Date(2025, 7, 13, 12),
    );

    await expect(service.searchParsed(namedMonth)).resolves.toMatchObject({
      results: [
        expect.objectContaining({ id: 'client:luciano' }),
        expect.objectContaining({ id: 'delivery-luciano-2025-08-12' }),
      ],
    });
    expect(resultIds(await service.search('Luciano 08/2025'))).toEqual([
      'client:luciano',
      'delivery-luciano-2025-08-12',
    ]);
    expect(resultIds(await service.search('Luciano 12/08/2025'))).toEqual([
      'client:luciano',
      'delivery-luciano-2025-08-12',
    ]);
  });

  it('does not reuse old source data when the next source response contains an error', async () => {
    const dataSource: HomeSearchDataSource = {
      load: jest
        .fn<Promise<HomeSearchDataSet>, [HomeSearchParsedQuery]>()
        .mockResolvedValueOnce(dataSet)
        .mockResolvedValueOnce({
          ...dataSet,
          deliveries: [],
          factoryPurchases: [],
          errors: [{ source: 'deliveries', message: 'offline' }],
        }),
    };
    const service = new HomeSearchService(dataSource);

    expect((await service.search('Luciano')).results.length).toBeGreaterThan(0);
    const next = await service.search('01/2099');

    expect(next.results).toEqual([]);
    expect(next.errors).toEqual([{ source: 'deliveries', message: 'offline' }]);
  });

  it('returns distinct results for two consecutive successful searches', async () => {
    const service = new HomeSearchService(new FixedDataSource());

    const luciano = await service.search('Luciano');
    const andre = await service.search('Andr\u00e9');

    expect(resultIds(luciano)).toContain('client:luciano');
    expect(resultIds(luciano)).not.toContain('client:andre');
    expect(resultIds(andre)).toContain('client:andre');
    expect(resultIds(andre)).not.toContain('client:luciano');
  });

  it('filters bucket quantity and monetary value', async () => {
    const service = new HomeSearchService(new FixedDataSource());
    const quantity = await service.search('3 baldes');
    const money = await service.search('R$ 150,00');

    expect(resultIds(quantity)).toEqual(
      expect.arrayContaining(['delivery-andre-2026-08-12', 'factory-2026-08-12']),
    );
    expect(resultIds(money)).toEqual(
      expect.arrayContaining(['delivery-andre-2026-08-12', 'factory-2026-08-12']),
    );
  });

  it.each([
    ['pago', ['delivery-andre-2026-08-12', 'delivery-luciano-2026-09-01', 'factory-2026-08-12']],
    [
      'n\u00e3o pago',
      ['delivery-andressa-2026-08-13', 'delivery-luciano-2025-08-12', 'factory-2025-08-10'],
    ],
    [
      'em aberto',
      ['delivery-andressa-2026-08-13', 'delivery-luciano-2025-08-12', 'factory-2025-08-10'],
    ],
  ])('filters payment status for %s', async (query, expectedIds) => {
    const response = await new HomeSearchService(new FixedDataSource()).search(query);
    expect(resultIds(response)).toEqual(expect.arrayContaining(expectedIds));
  });

  it('combines client and period filters', async () => {
    const response = await new HomeSearchService(new FixedDataSource()).search(
      'Luciano agosto 2025',
    );

    expect(resultIds(response)).toEqual(['client:luciano', 'delivery-luciano-2025-08-12']);
  });

  it('marks an older asynchronous response as stale', async () => {
    const pending: {
      query: HomeSearchParsedQuery;
      resolve: (value: HomeSearchDataSet) => void;
    }[] = [];
    const dataSource: HomeSearchDataSource = {
      load: (query) =>
        new Promise((resolve) => {
          pending.push({ query, resolve });
        }),
    };
    const service = new HomeSearchService(dataSource);
    const firstPromise = service.search('Andr\u00e9');
    const secondPromise = service.search('Luciano');

    pending.find(({ query }) => query.text === 'luciano')?.resolve(dataSet);
    await expect(secondPromise).resolves.toMatchObject({ stale: false });
    pending.find(({ query }) => query.text === 'andre')?.resolve(dataSet);
    await expect(firstPromise).resolves.toMatchObject({ stale: true });
  });

  it.each<[string, HomeSearchFinancialMetric, keyof ReturnType<typeof financialSummary>]>([
    ['faturamento agosto', 'revenue', 'faturamento'],
    ['lucro bruto agosto', 'grossProfit', 'lucroBruto'],
    ['lucro líquido agosto', 'netProfit', 'lucroLiquido'],
    ['lucro agosto', 'netProfit', 'lucroLiquido'],
    ['recebido agosto', 'received', 'valoresPagos'],
    ['a receber agosto', 'receivable', 'valoresPendentes'],
    ['baldes vendidos agosto', 'bucketsSold', 'quantidadeBaldes'],
    ['custo dos baldes agosto', 'bucketCost', 'custoTotalBaldes'],
    ['combustível agosto', 'fuelCost', 'custoCombustivel'],
    ['outros custos agosto', 'otherCosts', 'custoOutros'],
    ['luz agosto', 'electricityCost', 'custoLuz'],
    ['custo médio de entrega agosto', 'averageDeliveryCost', 'custoMedioCombustivelPorEntrega'],
    ['margem bruta agosto', 'grossMargin', 'margemBruta'],
    ['margem líquida agosto', 'netMargin', 'margemLiquida'],
    ['venda por balde agosto', 'salePerBucket', 'precoMedioBalde'],
    ['lucro por balde agosto', 'profitPerBucket', 'lucroLiquidoPorBalde'],
    ['custo por balde agosto', 'costPerBucket', 'custoMedioBalde'],
  ])('uses the Finance summary source for %s', async (query, metric, summaryField) => {
    const parsed = new HomeSearchQueryParser().parse(query, new Date(2026, 7, 13, 12));
    const response = await new HomeSearchService(new FixedDataSource()).searchParsed(parsed);
    const result = response.results[0];

    expect(result).toMatchObject({ type: 'financialMetric', data: { available: true, metric } });
    if (result?.type !== 'financialMetric') throw new Error('Métrica financeira ausente.');
    expect(result.data.value).toBeCloseTo(financialSummary()[summaryField], 8);
    expect(response.counts.financialMetric).toBe(1);
  });

  it('includes local route kilometers in the daily net profit search result', async () => {
    const route = routeSession('route-august-12', '2026-08-12', 7_400);
    const response = await new HomeSearchService({
      load: async () => ({ ...dataSet, routeSessions: [route] }),
    }).searchParsed(
      new HomeSearchQueryParser().parse('lucro líquido 12/08', new Date(2026, 7, 13, 12)),
    );

    const result = response.results[0];
    expect(result).toMatchObject({
      type: 'financialMetric',
      data: { available: true, metric: 'netProfit', value: expect.any(Number) },
    });
    if (result?.type !== 'financialMetric') throw new Error('Métrica financeira ausente.');

    const expected = financialCalculationService.calculateResumo({
      deliveries: financialData.deliveries,
      dailyExpenses: financialData.dailyExpenses,
      monthlyExpenses: financialData.monthlyExpenses,
      filters: financialFiltersForSelection({ kind: 'day', date: '2026-08-12' }),
      automaticKilometersByDate: { '2026-08-12': 7.4 },
    });
    expect(result.data.value).toBeCloseTo(expected.lucroLiquido, 8);
  });

  it('maps generic client profit to gross profit and supports explicit gross profit', async () => {
    const service = new HomeSearchService(new FixedDataSource());
    const parser = new HomeSearchQueryParser();
    const referenceDate = new Date(2026, 7, 13, 12);
    const generic = await service.searchParsed(parser.parse('lucro Luciano agosto', referenceDate));
    const explicit = await service.searchParsed(
      parser.parse('lucro bruto Luciano agosto', referenceDate),
    );

    for (const response of [generic, explicit]) {
      expect(response.results[0]).toMatchObject({
        type: 'financialMetric',
        data: {
          available: true,
          clientId: 'client:luciano',
          clientName: 'Luciano',
          metric: 'grossProfit',
        },
      });
    }
  });

  it.each<[string, HomeSearchFinancialMetric, keyof ReturnType<typeof financialClientSummary>]>([
    ['faturamento Luciano agosto', 'revenue', 'faturamento'],
    ['recebido Luciano agosto', 'received', 'valoresPagos'],
    ['a receber Luciano agosto', 'receivable', 'valoresPendentes'],
    ['baldes vendidos Luciano agosto', 'bucketsSold', 'quantidadeBaldes'],
    ['custo dos baldes Luciano agosto', 'bucketCost', 'custoTotalBaldes'],
    ['margem bruta Luciano agosto', 'grossMargin', 'margemBruta'],
    ['venda por balde Luciano agosto', 'salePerBucket', 'precoMedioBalde'],
    ['combustível Luciano agosto', 'fuelCost', 'custoCombustivel'],
    ['luz Luciano agosto', 'electricityCost', 'custoLuz'],
  ])('uses only the selected client for %s', async (query, metric, summaryField) => {
    const parsed = new HomeSearchQueryParser().parse(query, new Date(2026, 7, 13, 12));
    const response = await new HomeSearchService(new FixedDataSource()).searchParsed(parsed);
    const result = response.results[0];

    expect(result).toMatchObject({
      type: 'financialMetric',
      data: { available: true, clientId: 'client:luciano', metric },
    });
    if (result?.type !== 'financialMetric') throw new Error('Métrica financeira ausente.');
    expect(result.data.value).toBeCloseTo(financialClientSummary()[summaryField], 8);
  });

  it('returns an explicit unavailable financial result for client net profit', async () => {
    const parsed = new HomeSearchQueryParser().parse(
      'lucro líquido Luciano agosto',
      new Date(2026, 7, 13, 12),
    );
    const response = await new HomeSearchService(new FixedDataSource()).searchParsed(parsed);

    expect(response.results).toEqual([
      expect.objectContaining({
        type: 'financialMetric',
        data: expect.objectContaining({
          available: false,
          clientId: 'client:luciano',
          metric: 'netProfit',
          unavailableReason: 'clientScopeUnsupported',
        }),
      }),
    ]);
  });

  it.each([
    ['valor do balde Luciano', 'currentPrice', 49.8],
    ['preço Luciano', 'currentPrice', 49.8],
    ['endereço Luciano', 'address', 'Rua do Luciano'],
    ['nota fiscal Luciano', 'usesInvoice', false],
    ['boleto Luciano', 'usesBoleto', false],
  ])('returns the structured client field for %s', async (query, field, value) => {
    const response = await new HomeSearchService(new FixedDataSource()).search(query);

    expect(response.results).toEqual([
      expect.objectContaining({
        type: 'client',
        id: 'client:luciano',
        data: expect.objectContaining({
          matchedField: expect.objectContaining({ field, value }),
        }),
      }),
    ]);
  });

  it.each([
    ['nota fiscal André', 'usesInvoice'],
    ['boleto Andressa', 'usesBoleto'],
  ])('preserves positive fiscal eligibility for %s', async (query, field) => {
    const response = await new HomeSearchService(new FixedDataSource()).search(query);

    expect(response.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'client',
          data: expect.objectContaining({
            matchedField: { available: true, field, unit: 'boolean', value: true },
          }),
        }),
      ]),
    );
  });

  it.each([
    ['compras fábrica agosto', 'purchases'],
    ['compras da fábrica 08/2026', 'purchases'],
    ['baldes comprados agosto', 'bucketsPurchased'],
    ['valor comprado agosto', 'purchaseValue'],
    ['pagamentos fábrica agosto', 'payments'],
    ['pagamentos das compras de agosto', 'payments'],
  ])(
    'aggregates factory purchases without choosing an arbitrary receipt for %s',
    async (query, metric) => {
      const parsed = new HomeSearchQueryParser().parse(query, new Date(2026, 7, 13, 12));
      const response = await new HomeSearchService(new FixedDataSource()).searchParsed(parsed);

      expect(response.results).toHaveLength(1);
      expect(response.results[0]).toMatchObject({
        type: 'factorySummary',
        data: {
          available: true,
          metric,
          aggregate: {
            receiptCount: 3,
            totalBuckets: 11,
            totalValue: 550,
            totalPaid: 250,
            openValue: 300,
            paymentCount: 2,
            progress: 250 / 550,
          },
          receipts: expect.arrayContaining([
            expect.objectContaining({
              receiptId: 'factory-2026-08-12',
              status: 'paid',
            }),
            expect.objectContaining({
              paymentIds: ['factory-payment-partial'],
              receiptId: 'factory-partial-2026-08-14',
              status: 'partial',
            }),
            expect.objectContaining({
              receiptId: 'factory-open-2026-08-15',
              status: 'open',
            }),
          ]),
        },
        relations: {
          receiptIds: [
            'factory-2026-08-12',
            'factory-partial-2026-08-14',
            'factory-open-2026-08-15',
          ],
        },
      });
    },
  );

  it('uses the purchase date for an exact factory query', async () => {
    const parsed = new HomeSearchQueryParser().parse(
      'compra fábrica 12/08',
      new Date(2026, 7, 13, 12),
    );
    const response = await new HomeSearchService(new FixedDataSource()).searchParsed(parsed);

    expect(response.results).toEqual([
      expect.objectContaining({
        type: 'factorySummary',
        data: expect.objectContaining({
          aggregate: expect.objectContaining({ receiptCount: 1, totalBuckets: 3 }),
        }),
        relations: expect.objectContaining({ receiptIds: ['factory-2026-08-12'] }),
      }),
    ]);
  });

  it('distinguishes partial, paid, open and outstanding factory states', async () => {
    const service = new HomeSearchService(new FixedDataSource());
    const parser = new HomeSearchQueryParser();
    const referenceDate = new Date(2026, 7, 13, 12);
    const partial = await service.searchParsed(
      parser.parse('pagamentos parciais fábrica agosto', referenceDate),
    );
    const paid = await service.searchParsed(parser.parse('pago fábrica agosto', referenceDate));
    const open = await service.searchParsed(
      parser.parse('em aberto fábrica agosto', referenceDate),
    );
    const outstanding = await service.search('a pagar fábrica');

    expect(partial.results[0]).toMatchObject({
      type: 'factorySummary',
      data: { aggregate: { totalPaid: 100, openValue: 200 }, status: 'partial' },
      relations: { receiptIds: ['factory-partial-2026-08-14'] },
    });
    expect(paid.results[0]).toMatchObject({
      type: 'factorySummary',
      relations: { receiptIds: ['factory-2026-08-12'] },
    });
    expect(open.results[0]).toMatchObject({
      type: 'factorySummary',
      relations: { receiptIds: ['factory-open-2026-08-15'] },
    });
    expect(outstanding.results[0]).toMatchObject({
      type: 'factorySummary',
      data: { aggregate: { openValue: 500 } },
    });
  });

  it('returns a typed unsupported result for payment-date queries', async () => {
    const response = await new HomeSearchService(new FixedDataSource()).search(
      'pagamentos realizados em agosto',
    );

    expect(response.results).toEqual([
      expect.objectContaining({
        type: 'factorySummary',
        data: expect.objectContaining({
          available: false,
          unsupportedReason: 'paymentDateFilter',
        }),
      }),
    ]);
  });

  it('aggregates finalized route sessions by day and month without coordinates', async () => {
    const routeData = {
      ...dataSet,
      financial: {
        ...dataSet.financial,
        dailyExpenses: {},
      },
      routeSessions: [
        routeSession('route-1', '2026-08-12', 12_500),
        routeSession('route-2', '2026-08-12', 7_500),
      ],
    };
    const service = new HomeSearchService({ load: async () => routeData });
    const parser = new HomeSearchQueryParser();
    const referenceDate = new Date(2026, 7, 13, 12);

    for (const query of ['km 12/08', 'quilometragem agosto']) {
      const response = await service.searchParsed(parser.parse(query, referenceDate));
      expect(response.results).toEqual([
        expect.objectContaining({
          type: 'routeSummary',
          data: expect.objectContaining({
            distanceKm: 20,
            routeCount: 2,
            durationSeconds: 1200,
            pointsCount: 4,
            consideredDistanceKm: 20,
            sessions: expect.arrayContaining([
              expect.objectContaining({ sessionId: 'route-1', dailyDistanceKm: 20 }),
              expect.objectContaining({ sessionId: 'route-2', dailyDistanceKm: 20 }),
            ]),
          }),
          relations: { sessionIds: ['route-1', 'route-2'] },
        }),
      ]);
      expect(response.results[0]).not.toHaveProperty('data.samples');
    }
  });

  it('filters route sessions by the requested period before aggregating', async () => {
    const service = new HomeSearchService({
      load: async () => ({
        ...dataSet,
        financial: {
          ...dataSet.financial,
          dailyExpenses: {},
        },
        routeSessions: [
          routeSession('route-today', '2026-08-13', 10_000),
          routeSession('route-other-day', '2026-08-14', 20_000),
        ],
      }),
    });

    const response = await service.searchParsed(
      new HomeSearchQueryParser().parse('rota hoje', new Date(2026, 7, 13, 12)),
    );

    expect(response.results).toEqual([
      expect.objectContaining({
        type: 'routeSummary',
        data: expect.objectContaining({ routeCount: 1, distanceKm: 10 }),
        relations: { sessionIds: ['route-today'] },
      }),
    ]);
  });

  it.each(['rota 13/08', 'quilometragem 13/08', 'km 13/08'])(
    'exposes the full structured data for one route session: %s',
    async (query) => {
      const session = routeSession('route-13', '2026-08-13', 13_250);
      const service = new HomeSearchService({
        load: async () => ({
          ...dataSet,
          financial: {
            ...dataSet.financial,
            dailyExpenses: {},
          },
          routeSessions: [session],
        }),
      });
      const response = await service.searchParsed(
        new HomeSearchQueryParser().parse(query, new Date(2026, 7, 13, 12)),
      );

      expect(response.results[0]).toMatchObject({
        type: 'routeSummary',
        data: {
          routeCount: 1,
          distanceKm: 13.25,
          durationSeconds: 600,
          pointsCount: 2,
          startTimestamp: 1_000,
          endTimestamp: 601_000,
          consideredDistanceKm: 13.25,
          sessions: [
            expect.objectContaining({
              sessionId: 'route-13',
              date: '2026-08-13',
              dailyDistanceKm: 13.25,
              distanceKm: 13.25,
              durationSeconds: 600,
              pointsCount: 2,
            }),
          ],
        },
      });
    },
  );

  it('returns empty when the selected period has no local route', async () => {
    const parsed = new HomeSearchQueryParser().parse('km 12/08', new Date(2026, 7, 13, 12));
    const response = await new HomeSearchService({
      load: async () => ({
        ...dataSet,
        financial: {
          ...dataSet.financial,
          dailyExpenses: {},
        },
        routeSessions: [],
      }),
    }).searchParsed(parsed);

    expect(response.results).toEqual([]);
  });

  it.each([
    ['autonomia gasolina', 'gasolineAutonomy'],
    ['autonomia álcool', 'alcoholAutonomy'],
    ['consumo carro', 'consumption'],
  ])('returns only real car settings for %s', async (query, metric) => {
    const response = await new HomeSearchService({
      load: async () => ({
        ...dataSet,
        carSettings: { gasolineAutonomy: '7,4 Km/l', alcoholAutonomy: '5,6 Km/l' },
      }),
    }).search(query);

    expect(response.results).toEqual([
      expect.objectContaining({
        type: 'carSetting',
        data: {
          metric,
          available: true,
          gasolineKmPerLiter: 7.4,
          alcoholKmPerLiter: 5.6,
        },
      }),
    ]);
  });

  it.each(['resumo 12/08', 'dados do dia 12/08', 'resumo agosto'])(
    'composes a typed period summary for %s',
    async (query) => {
      const parsed = new HomeSearchQueryParser().parse(query, new Date(2026, 7, 13, 12));
      const response = await new HomeSearchService({
        load: async () => ({
          ...dataSet,
          routeSessions: [routeSession('route-1', '2026-08-12', 12_500)],
        }),
      }).searchParsed(parsed);

      expect(response.results).toHaveLength(1);
      expect(response.results[0]).toMatchObject({
        type: 'periodSummary',
        data: {
          financial: expect.objectContaining({ faturamento: expect.any(Number) }),
          factory: expect.objectContaining({ totalBuckets: expect.any(Number) }),
          routes: { distanceKm: 86.5, routeCount: 1 },
        },
        relations: expect.objectContaining({ sessionIds: ['route-1'] }),
      });
    },
  );

  it('returns empty for a period summary without data', async () => {
    const parsed = new HomeSearchQueryParser().parse('resumo 01/2099');
    const response = await new HomeSearchService({
      load: async () => ({
        ...dataSet,
        deliveries: [],
        factoryPurchases: [],
        financial: {
          costsAvailable: true,
          dailyExpenses: {},
          deliveries: [],
          monthlyExpenses: {},
        },
        routeSessions: [],
      }),
    }).searchParsed(parsed);

    expect(response.results).toEqual([]);
  });

  it('returns no financial result for a period without any data', async () => {
    const parsed = new HomeSearchQueryParser().parse(
      'faturamento 01/2099',
      new Date(2026, 7, 13, 12),
    );
    const response = await new HomeSearchService(new FixedDataSource()).searchParsed(parsed);

    expect(response.results).toEqual([]);
  });

  it('enriches client result with faturamento, lucro liquido, valor do balde and global shares', async () => {
    const parsed = new HomeSearchQueryParser().parse('André', new Date(2026, 7, 13, 12));
    const response = await new HomeSearchService(new FixedDataSource()).searchParsed(parsed);

    const clientRes = response.results.find((r) => r.type === 'client');
    expect(clientRes).toBeDefined();
    if (clientRes && clientRes.type === 'client') {
      expect(clientRes.data.aggregation.deliveryCount).toBe(1);
      expect(clientRes.data.aggregation.quantity).toBe(3);
      expect(clientRes.data.aggregation.revenue).toBe(150);
      expect(clientRes.data.aggregation.currentPrice).toBe(50);
      expect(typeof clientRes.data.aggregation.netProfit).toBe('number');
      expect(clientRes.data.aggregation.revenueShare).toBeGreaterThan(0);
      expect(typeof clientRes.data.aggregation.netProfitShare).toBe('number');
    }
  });

  it('calculates mathematically exact global shares for multi-client datasets (25% and 75%)', async () => {
    const deliveryA: Delivery = {
      id: 'del-a',
      clientId: 'client:a',
      cliente: 'Cliente A',
      quantidade: 20,
      valor: 1000,
      status: 'Pago',
      entregue: true,
      data: '2026-08-10',
    };
    const deliveryB: Delivery = {
      id: 'del-b',
      clientId: 'client:b',
      cliente: 'Cliente B',
      quantidade: 60,
      valor: 3000,
      status: 'Pago',
      entregue: true,
      data: '2026-08-10',
    };
    const multiClientSource: HomeSearchDataSource = {
      load: jest.fn().mockImplementation(async (query: HomeSearchParsedQuery) => {
        const clients = [
          {
            clientId: 'client:a' as const,
            canonicalName: 'Cliente A',
            normalizedName: 'cliente a',
            sources: ['custom'] as ('custom' | 'delivery')[],
            currentPrice: 50,
            usesInvoice: false,
            usesBoleto: false,
          },
          {
            clientId: 'client:b' as const,
            canonicalName: 'Cliente B',
            normalizedName: 'cliente b',
            sources: ['custom'] as ('custom' | 'delivery')[],
            currentPrice: 50,
            usesInvoice: false,
            usesBoleto: false,
          },
        ];
        const isClientA = query.text?.includes('a');
        const deliveries = isClientA ? [deliveryA] : [deliveryB];
        return {
          clients,
          deliveries,
          globalDeliveries: [deliveryA, deliveryB],
          factoryPurchases: [],
          coverage: [],
          errors: [],
        };
      }),
    };

    const parsedA = new HomeSearchQueryParser().parse('Cliente A', new Date(2026, 7, 13, 12));
    const responseA = await new HomeSearchService(multiClientSource).searchParsed(parsedA);
    const clientA = responseA.results.find((r) => r.type === 'client' && r.clientId === 'client:a');

    expect(clientA).toBeDefined();
    if (clientA && clientA.type === 'client') {
      expect(clientA.data.aggregation.revenue).toBe(1000);
      expect(clientA.data.aggregation.revenueShare).toBe(25);
      expect(clientA.data.aggregation.netProfit).toBe(300); // 1000 - (20 * 35)
      expect(clientA.data.aggregation.netProfitShare).toBe(25); // 300 / 1200
    }

    const parsedB = new HomeSearchQueryParser().parse('Cliente B', new Date(2026, 7, 13, 12));
    const responseB = await new HomeSearchService(multiClientSource).searchParsed(parsedB);
    const clientB = responseB.results.find((r) => r.type === 'client' && r.clientId === 'client:b');

    expect(clientB).toBeDefined();
    if (clientB && clientB.type === 'client') {
      expect(clientB.data.aggregation.revenue).toBe(3000);
      expect(clientB.data.aggregation.revenueShare).toBe(75);
      expect(clientB.data.aggregation.netProfit).toBe(900); // 3000 - (60 * 35)
      expect(clientB.data.aggregation.netProfitShare).toBe(75); // 900 / 1200
    }
  });

  it('only returns 100% share when the client genuinely represents 100% of global deliveries', async () => {
    const singleDelivery: Delivery = {
      id: 'del-single',
      clientId: 'client:unico',
      cliente: 'Cliente Unico',
      quantidade: 10,
      valor: 500,
      status: 'Pago',
      entregue: true,
      data: '2026-08-10',
    };
    const singleClientSource: HomeSearchDataSource = {
      load: jest.fn().mockResolvedValue({
        clients: [
          {
            clientId: 'client:unico',
            canonicalName: 'Cliente Unico',
            normalizedName: 'cliente unico',
            sources: ['custom'],
            currentPrice: 50,
            usesInvoice: false,
            usesBoleto: false,
          },
        ],
        deliveries: [singleDelivery],
        globalDeliveries: [singleDelivery],
        factoryPurchases: [],
        coverage: [],
        errors: [],
      }),
    };

    const parsed = new HomeSearchQueryParser().parse('Cliente Unico', new Date(2026, 7, 13, 12));
    const response = await new HomeSearchService(singleClientSource).searchParsed(parsed);
    const clientRes = response.results.find((r) => r.type === 'client');

    expect(clientRes).toBeDefined();
    if (clientRes && clientRes.type === 'client') {
      expect(clientRes.data.aggregation.revenue).toBe(500);
      expect(clientRes.data.aggregation.revenueShare).toBe(100);
      expect(clientRes.data.aggregation.netProfitShare).toBe(100);
    }
  });

  it('handles client with zero deliveries and zero global denominators safely', async () => {
    const clientOnlySource: HomeSearchDataSource = {
      load: jest.fn().mockResolvedValue({
        clients: [
          {
            clientId: 'client:novo',
            canonicalName: 'Novo Cliente',
            normalizedName: 'novo cliente',
            usesInvoice: false,
            usesBoleto: false,
            sources: ['custom'],
          },
        ],
        deliveries: [],
        factoryPurchases: [],
        coverage: [],
        errors: [],
      }),
    };

    const parsed = new HomeSearchQueryParser().parse('Novo Cliente', new Date(2026, 7, 13, 12));
    const response = await new HomeSearchService(clientOnlySource).searchParsed(parsed);

    const clientRes = response.results.find((r) => r.type === 'client');
    expect(clientRes).toBeDefined();
    if (clientRes && clientRes.type === 'client') {
      expect(clientRes.data.aggregation.deliveryCount).toBe(0);
      expect(clientRes.data.aggregation.revenue).toBe(0);
      expect(clientRes.data.aggregation.netProfit).toBe(0);
      expect(clientRes.data.aggregation.revenueShare).toBe(0);
      expect(clientRes.data.aggregation.netProfitShare).toBe(0);
      expect(Number.isNaN(clientRes.data.aggregation.revenueShare)).toBe(false);
      expect(Number.isNaN(clientRes.data.aggregation.netProfitShare)).toBe(false);
    }
  });

  it('scopes both client and global metrics to the requested month (e.g. Cliente A agosto)', async () => {
    const deliveryClientAug: Delivery = {
      id: 'del-a-aug',
      clientId: 'client:a',
      cliente: 'Cliente A',
      quantidade: 10,
      valor: 500,
      status: 'Pago',
      entregue: true,
      data: '2026-08-10',
    };
    const deliveryOtherAug: Delivery = {
      id: 'del-b-aug',
      clientId: 'client:b',
      cliente: 'Cliente B',
      quantidade: 30,
      valor: 1500,
      status: 'Pago',
      entregue: true,
      data: '2026-08-12',
    };
    const deliveryOtherOld: Delivery = {
      id: 'del-b-old',
      clientId: 'client:b',
      cliente: 'Cliente B',
      quantidade: 160,
      valor: 8000,
      status: 'Pago',
      entregue: true,
      data: '2025-01-10',
    };
    const datasetWithHistory: HomeSearchDataSource = {
      load: jest.fn().mockResolvedValue({
        clients: [
          {
            clientId: 'client:a',
            canonicalName: 'Cliente A',
            normalizedName: 'cliente a',
            sources: ['custom'],
            currentPrice: 50,
            usesInvoice: false,
            usesBoleto: false,
          },
          {
            clientId: 'client:b',
            canonicalName: 'Cliente B',
            normalizedName: 'cliente b',
            sources: ['custom'],
            currentPrice: 50,
            usesInvoice: false,
            usesBoleto: false,
          },
        ],
        deliveries: [deliveryClientAug],
        globalDeliveries: [deliveryClientAug, deliveryOtherAug, deliveryOtherOld],
        factoryPurchases: [],
        coverage: [],
        errors: [],
      }),
    };

    const parsedMonth = new HomeSearchQueryParser().parse(
      'Cliente A agosto',
      new Date(2026, 7, 13, 12),
    );
    const response = await new HomeSearchService(datasetWithHistory).searchParsed(parsedMonth);
    const clientRes = response.results.find((r) => r.type === 'client');

    expect(clientRes).toBeDefined();
    if (clientRes && clientRes.type === 'client') {
      expect(clientRes.data.aggregation.deliveryCount).toBe(1);
      expect(clientRes.data.aggregation.quantity).toBe(10);
      expect(clientRes.data.aggregation.revenue).toBe(500);
      expect(clientRes.data.aggregation.netProfit).toBe(150); // 500 - (10 * 35)
      // Global August revenue = 500 + 1500 = 2000. Share = 500 / 2000 = 25% (NOT 500 / 10000 = 5%)
      expect(clientRes.data.aggregation.revenueShare).toBe(25);
      // Global August net profit = (500 - 350) + (1500 - 1050) = 150 + 450 = 600. Share = 150 / 600 = 25%
      expect(clientRes.data.aggregation.netProfitShare).toBe(25);
    }
  });

  it('scopes both client and global metrics to the requested exact day (e.g. Cliente A 14/08)', async () => {
    const deliveryClientDay: Delivery = {
      id: 'del-a-day',
      clientId: 'client:a',
      cliente: 'Cliente A',
      quantidade: 2,
      valor: 100,
      status: 'Pago',
      entregue: true,
      data: '2026-08-14',
    };
    const deliveryOtherDay: Delivery = {
      id: 'del-b-day',
      clientId: 'client:b',
      cliente: 'Cliente B',
      quantidade: 6,
      valor: 300,
      status: 'Pago',
      entregue: true,
      data: '2026-08-14',
    };
    const deliveryOtherDifferentDay: Delivery = {
      id: 'del-b-diff-day',
      clientId: 'client:b',
      cliente: 'Cliente B',
      quantidade: 100,
      valor: 5000,
      status: 'Pago',
      entregue: true,
      data: '2026-08-15',
    };
    const datasetWithDays: HomeSearchDataSource = {
      load: jest.fn().mockResolvedValue({
        clients: [
          {
            clientId: 'client:a',
            canonicalName: 'Cliente A',
            normalizedName: 'cliente a',
            sources: ['custom'],
            currentPrice: 50,
            usesInvoice: false,
            usesBoleto: false,
          },
          {
            clientId: 'client:b',
            canonicalName: 'Cliente B',
            normalizedName: 'cliente b',
            sources: ['custom'],
            currentPrice: 50,
            usesInvoice: false,
            usesBoleto: false,
          },
        ],
        deliveries: [deliveryClientDay],
        globalDeliveries: [deliveryClientDay, deliveryOtherDay, deliveryOtherDifferentDay],
        factoryPurchases: [],
        coverage: [],
        errors: [],
      }),
    };

    const parsedDay = new HomeSearchQueryParser().parse(
      'Cliente A 14/08',
      new Date(2026, 7, 13, 12),
    );
    const response = await new HomeSearchService(datasetWithDays).searchParsed(parsedDay);
    const clientRes = response.results.find((r) => r.type === 'client');

    expect(clientRes).toBeDefined();
    if (clientRes && clientRes.type === 'client') {
      expect(clientRes.data.aggregation.deliveryCount).toBe(1);
      expect(clientRes.data.aggregation.quantity).toBe(2);
      expect(clientRes.data.aggregation.revenue).toBe(100);
      expect(clientRes.data.aggregation.netProfit).toBe(30); // 100 - (2 * 35)
      // Global 14/08 revenue = 100 + 300 = 400. Share = 100 / 400 = 25% (NOT 100 / 5400)
      expect(clientRes.data.aggregation.revenueShare).toBe(25);
      // Global 14/08 net profit = 30 + 90 = 120. Share = 30 / 120 = 25%
      expect(clientRes.data.aggregation.netProfitShare).toBe(25);
    }
  });

  describe('HomeSearchParser & Service - Relative Dates & Date Ranges', () => {
    const parser = new HomeSearchQueryParser();
    const refDate = new Date(2026, 7, 18, 12); // Tuesday, August 18, 2026

    it('1. parses "ontem" as referenceDate - 1 day', () => {
      const parsed = parser.parse('ontem', refDate);
      expect(parsed.period).toEqual({ kind: 'date', date: '2026-08-17' });
      expect(parsed.detectedTypes).toContain('date');
    });

    it('2. parses "amanha" and "amanhã" as referenceDate + 1 day', () => {
      const parsed1 = parser.parse('amanha', refDate);
      expect(parsed1.period).toEqual({ kind: 'date', date: '2026-08-19' });
      const parsed2 = parser.parse('amanhã', refDate);
      expect(parsed2.period).toEqual({ kind: 'date', date: '2026-08-19' });
    });

    it('3. parses "este mês" / "mês atual" as current calendar month', () => {
      const parsed1 = parser.parse('este mês', refDate);
      expect(parsed1.period).toEqual({ kind: 'month', month: 8, year: 2026 });
      const parsed2 = parser.parse('mes atual', refDate);
      expect(parsed2.period).toEqual({ kind: 'month', month: 8, year: 2026 });
    });

    it('4. parses "mês passado" / "último mês" as previous calendar month', () => {
      const parsed1 = parser.parse('mês passado', refDate);
      expect(parsed1.period).toEqual({ kind: 'month', month: 7, year: 2026 });
      const parsed2 = parser.parse('ultimo mes', refDate);
      expect(parsed2.period).toEqual({ kind: 'month', month: 7, year: 2026 });
    });

    it('5. parses "próximo mês" as next calendar month', () => {
      const parsed = parser.parse('próximo mês', refDate);
      expect(parsed.period).toEqual({ kind: 'month', month: 9, year: 2026 });
    });

    it('6. parses "esta semana" as current week Monday to Sunday', () => {
      const parsed = parser.parse('esta semana', refDate);
      expect(parsed.period).toEqual({
        kind: 'range',
        startDate: '2026-08-17',
        endDate: '2026-08-23',
      });
      expect(parsed.detectedTypes).toContain('range');
    });

    it('7. parses "semana passada" / "última semana" as previous week Monday to Sunday', () => {
      const parsed1 = parser.parse('semana passada', refDate);
      expect(parsed1.period).toEqual({
        kind: 'range',
        startDate: '2026-08-10',
        endDate: '2026-08-16',
      });
      const parsed2 = parser.parse('ultima semana', refDate);
      expect(parsed2.period).toEqual({
        kind: 'range',
        startDate: '2026-08-10',
        endDate: '2026-08-16',
      });
    });

    it('8. parses "próxima semana" as next week Monday to Sunday', () => {
      const parsed = parser.parse('próxima semana', refDate);
      expect(parsed.period).toEqual({
        kind: 'range',
        startDate: '2026-08-24',
        endDate: '2026-08-30',
      });
    });

    it('9. parses date range "01/08 a 15/08"', () => {
      const parsed = parser.parse('01/08 a 15/08', refDate);
      expect(parsed.period).toEqual({
        kind: 'range',
        startDate: '2026-08-01',
        endDate: '2026-08-15',
      });
    });

    it('10. parses date range "01/08 até 15/08"', () => {
      const parsed = parser.parse('01/08 até 15/08', refDate);
      expect(parsed.period).toEqual({
        kind: 'range',
        startDate: '2026-08-01',
        endDate: '2026-08-15',
      });
    });

    it('11. parses date range "de 01/08 a 15/08" and "de 01/08 ate 15/08"', () => {
      const parsed1 = parser.parse('de 01/08 a 15/08', refDate);
      expect(parsed1.period).toEqual({
        kind: 'range',
        startDate: '2026-08-01',
        endDate: '2026-08-15',
      });
      expect(parsed1.text).toBe('');
      const parsed2 = parser.parse('de 01/08 ate 15/08', refDate);
      expect(parsed2.period).toEqual({
        kind: 'range',
        startDate: '2026-08-01',
        endDate: '2026-08-15',
      });
      expect(parsed2.text).toBe('');
    });

    it('12. parses date range with explicit full years "20/12/2025 a 10/01/2026"', () => {
      const parsed = parser.parse('20/12/2025 a 10/01/2026', refDate);
      expect(parsed.period).toEqual({
        kind: 'range',
        startDate: '2025-12-20',
        endDate: '2026-01-10',
      });
    });

    it('13. handles year rollover for "mês passado" when current date is in January', () => {
      const janRef = new Date(2026, 0, 15, 12); // January 15, 2026
      const parsed = parser.parse('mês passado', janRef);
      expect(parsed.period).toEqual({ kind: 'month', month: 12, year: 2025 });
    });

    it('14. handles year rollover for "próximo mês" when current date is in December', () => {
      const decRef = new Date(2026, 11, 10, 12); // December 10, 2026
      const parsed = parser.parse('próximo mês', decRef);
      expect(parsed.period).toEqual({ kind: 'month', month: 1, year: 2027 });
    });

    it('15. parses client + relative day "Luciano ontem"', async () => {
      const parsed = parser.parse('Luciano ontem', refDate);
      expect(parsed.text).toBe('luciano');
      expect(parsed.period).toEqual({ kind: 'date', date: '2026-08-17' });

      const ds: HomeSearchDataSource = {
        load: jest.fn().mockResolvedValue({
          clients: [clients[2]], // Luciano
          deliveries: [
            {
              id: 'del-1',
              cliente: 'Luciano',
              clientId: 'client:luciano',
              data: '2026-08-17',
              quantidade: 5,
              valor: 249,
              status: 'Pago',
            },
            {
              id: 'del-2',
              cliente: 'Luciano',
              clientId: 'client:luciano',
              data: '2026-08-18',
              quantidade: 5,
              valor: 249,
              status: 'Pago',
            },
          ],
          globalDeliveries: [
            {
              id: 'del-1',
              cliente: 'Luciano',
              clientId: 'client:luciano',
              data: '2026-08-17',
              quantidade: 5,
              valor: 249,
              status: 'Pago',
            },
            {
              id: 'del-global',
              cliente: 'Outro',
              clientId: 'client:outro',
              data: '2026-08-17',
              quantidade: 5,
              valor: 251,
              status: 'Pago',
            },
          ],
          factoryPurchases: [],
          coverage: [],
          errors: [],
        }),
      };

      const response = await new HomeSearchService(ds).searchParsed(parsed);
      const clientResult = response.results.find((r) => r.type === 'client');
      expect(clientResult).toBeDefined();
      if (clientResult && clientResult.type === 'client') {
        expect(clientResult.data.aggregation.deliveryCount).toBe(1);
        expect(clientResult.data.aggregation.revenue).toBe(249);
        // Total global 17/08 = 249 + 251 = 500. Share = 249 / 500 = 49.8%
        expect(clientResult.data.aggregation.revenueShare).toBeCloseTo(49.8, 1);
      }
    });

    it('16. parses client + relative week "Luciano semana passada"', async () => {
      const parsed = parser.parse('Luciano semana passada', refDate);
      expect(parsed.text).toBe('luciano');
      expect(parsed.period).toEqual({
        kind: 'range',
        startDate: '2026-08-10',
        endDate: '2026-08-16',
      });
    });

    it('17. parses client + date range "Luciano 01/08 a 15/08"', async () => {
      const parsed = parser.parse('Luciano 01/08 a 15/08', refDate);
      expect(parsed.text).toBe('luciano');
      expect(parsed.period).toEqual({
        kind: 'range',
        startDate: '2026-08-01',
        endDate: '2026-08-15',
      });
    });

    it('18. parses financial metric + relative day "faturamento ontem"', () => {
      const parsed = parser.parse('faturamento ontem', refDate);
      expect(parsed.financialMetric).toBe('revenue');
      expect(parsed.period).toEqual({ kind: 'date', date: '2026-08-17' });
      expect(parsed.text).toBe('');
    });

    it('19. parses financial metric + date range "faturamento 01/08 a 15/08"', () => {
      const parsed = parser.parse('faturamento 01/08 a 15/08', refDate);
      expect(parsed.financialMetric).toBe('revenue');
      expect(parsed.period).toEqual({
        kind: 'range',
        startDate: '2026-08-01',
        endDate: '2026-08-15',
      });
      expect(parsed.text).toBe('');
    });

    it('20. non-positional parsing handles inverted word orders correctly', () => {
      const inv1 = parser.parse('ontem faturamento', refDate);
      expect(inv1.financialMetric).toBe('revenue');
      expect(inv1.period).toEqual({ kind: 'date', date: '2026-08-17' });

      const inv2 = parser.parse('semana passada Luciano', refDate);
      expect(inv2.text).toBe('luciano');
      expect(inv2.period).toEqual({
        kind: 'range',
        startDate: '2026-08-10',
        endDate: '2026-08-16',
      });

      const inv3 = parser.parse('01/08 a 15/08 faturamento', refDate);
      expect(inv3.financialMetric).toBe('revenue');
      expect(inv3.period).toEqual({
        kind: 'range',
        startDate: '2026-08-01',
        endDate: '2026-08-15',
      });
    });

    it('21. safeguards against invalid dates and inverted yearless ranges', () => {
      // 32/08 is an invalid day
      const invalidDay = parser.parse('32/08 a 15/08', refDate);
      expect(invalidDay.period?.kind).not.toBe('range');

      // 20/12 a 10/01 without year resolves both to currentYear (2026-12-20 > 2026-01-10) and is safely rejected
      const invertedRange = parser.parse('20/12 a 10/01', refDate);
      expect(invertedRange.period?.kind).not.toBe('range');
    });

    it('22. regression preserves all existing temporal formats', () => {
      const today = parser.parse('hoje', refDate);
      expect(today.period).toEqual({ kind: 'date', date: '2026-08-18' });

      const monthNamed = parser.parse('agosto', refDate);
      expect(monthNamed.period).toEqual({ kind: 'month', month: 8, year: 2026 });

      const monthYearNamed = parser.parse('agosto 2026', refDate);
      expect(monthYearNamed.period).toEqual({ kind: 'month', month: 8, year: 2026 });

      const dayMonth = parser.parse('14/08', refDate);
      expect(dayMonth.period).toEqual({ kind: 'date', date: '2026-08-14' });

      const fullSlash = parser.parse('14/08/2026', refDate);
      expect(fullSlash.period).toEqual({ kind: 'date', date: '2026-08-14' });

      const slashMonth = parser.parse('08/2026', refDate);
      expect(slashMonth.period).toEqual({ kind: 'month', month: 8, year: 2026 });

      const yearOnly = parser.parse('2026', refDate);
      expect(yearOnly.period).toEqual({ kind: 'year', year: 2026 });
    });
  });

  describe('HomeSearch - Consolidated Kilometers (GPS + Manual)', () => {
    const refDate = new Date(2026, 7, 18, 12); // Tuesday, Aug 18, 2026

    it('1. calculates total when there is only GPS (GPS = 100, manual = 0 -> 100 km)', async () => {
      const ds: HomeSearchDataSource = {
        load: jest.fn().mockResolvedValue({
          clients: [],
          deliveries: [],
          factoryPurchases: [],
          financial: {
            costsAvailable: true,
            dailyExpenses: {},
            deliveries: [],
            monthlyExpenses: {},
          },
          routeSessions: [
            {
              id: 'sess-1',
              date: '2026-08-14',
              distanceMeters: 100_000, // 100 km
              durationSeconds: 3600,
              pointsCount: 50,
              startTimestamp: 1000,
              endTimestamp: 2000,
            },
          ],
          coverage: [],
          errors: [],
        }),
      };

      const service = new HomeSearchService(ds);
      const resSummary = await service.search('resumo 14/08', refDate);
      const summaryResult = resSummary.results.find((r) => r.type === 'periodSummary');
      expect(summaryResult).toBeDefined();
      if (summaryResult && summaryResult.type === 'periodSummary') {
        expect(summaryResult.data.routes.distanceKm).toBe(100);
        expect(summaryResult.data.routes.routeCount).toBe(1);
      }

      const resKm = await service.search('km 14/08', refDate);
      const routeResult = resKm.results.find((r) => r.type === 'routeSummary');
      expect(routeResult).toBeDefined();
      if (routeResult && routeResult.type === 'routeSummary') {
        expect(routeResult.data.distanceKm).toBe(100);
        expect(routeResult.data.routeCount).toBe(1);
      }
    });

    it('2. calculates total when there is only manual km (GPS = 0, manual = 40 -> 40 km)', async () => {
      const ds: HomeSearchDataSource = {
        load: jest.fn().mockResolvedValue({
          clients: [],
          deliveries: [],
          factoryPurchases: [],
          financial: {
            costsAvailable: true,
            dailyExpenses: {
              '2026-08-14': {
                data: '2026-08-14',
                km: 40,
              },
            },
            deliveries: [],
            monthlyExpenses: {},
          },
          routeSessions: [],
          coverage: [],
          errors: [],
        }),
      };

      const service = new HomeSearchService(ds);
      const resSummary = await service.search('resumo 14/08', refDate);
      const summaryResult = resSummary.results.find((r) => r.type === 'periodSummary');
      expect(summaryResult).toBeDefined();
      if (summaryResult && summaryResult.type === 'periodSummary') {
        expect(summaryResult.data.routes.distanceKm).toBe(40);
        expect(summaryResult.data.routes.routeCount).toBe(0); // 0 GPS sessions
      }

      const resKm = await service.search('km 14/08', refDate);
      const routeResult = resKm.results.find((r) => r.type === 'routeSummary');
      expect(routeResult).toBeDefined();
      if (routeResult && routeResult.type === 'routeSummary') {
        expect(routeResult.data.distanceKm).toBe(40);
        expect(routeResult.data.routeCount).toBe(0);
      }
    });

    it('3. calculates total when both GPS and manual km are present (GPS = 100, manual = 40 -> 140 km)', async () => {
      const ds: HomeSearchDataSource = {
        load: jest.fn().mockResolvedValue({
          clients: [],
          deliveries: [],
          factoryPurchases: [],
          financial: {
            costsAvailable: true,
            dailyExpenses: {
              '2026-08-14': {
                data: '2026-08-14',
                km: 40,
              },
            },
            deliveries: [],
            monthlyExpenses: {},
          },
          routeSessions: [
            {
              id: 'sess-1',
              date: '2026-08-14',
              distanceMeters: 100_000, // 100 km
              durationSeconds: 3600,
              pointsCount: 50,
              startTimestamp: 1000,
              endTimestamp: 2000,
            },
          ],
          coverage: [],
          errors: [],
        }),
      };

      const service = new HomeSearchService(ds);
      const resSummary = await service.search('resumo 14/08', refDate);
      const summaryResult = resSummary.results.find((r) => r.type === 'periodSummary');
      expect(summaryResult).toBeDefined();
      if (summaryResult && summaryResult.type === 'periodSummary') {
        expect(summaryResult.data.routes.distanceKm).toBe(140);
        expect(summaryResult.data.routes.routeCount).toBe(1);
      }

      const resKm = await service.search('km 14/08', refDate);
      const routeResult = resKm.results.find((r) => r.type === 'routeSummary');
      expect(routeResult).toBeDefined();
      if (routeResult && routeResult.type === 'routeSummary') {
        expect(routeResult.data.distanceKm).toBe(140);
        expect(routeResult.data.routeCount).toBe(1);
      }
    });

    it('4. ignores GPS and manual km outside of the requested period', async () => {
      const ds: HomeSearchDataSource = {
        load: jest.fn().mockResolvedValue({
          clients: [],
          deliveries: [],
          factoryPurchases: [],
          financial: {
            costsAvailable: true,
            dailyExpenses: {
              '2026-08-14': { data: '2026-08-14', km: 25 },
              '2026-08-20': { data: '2026-08-20', km: 50 }, // outside
            },
            deliveries: [],
            monthlyExpenses: {},
          },
          routeSessions: [
            {
              id: 'sess-1',
              date: '2026-08-14',
              distanceMeters: 30_000, // 30 km
              durationSeconds: 1800,
              pointsCount: 25,
              startTimestamp: 1000,
              endTimestamp: 2000,
            },
            {
              id: 'sess-outside',
              date: '2026-08-20',
              distanceMeters: 70_000, // outside
              durationSeconds: 1800,
              pointsCount: 25,
              startTimestamp: 3000,
              endTimestamp: 4000,
            },
          ],
          coverage: [],
          errors: [],
        }),
      };

      const service = new HomeSearchService(ds);
      const res = await service.search('resumo 14/08', refDate);
      const summary = res.results.find((r) => r.type === 'periodSummary');
      expect(summary).toBeDefined();
      if (summary && summary.type === 'periodSummary') {
        expect(summary.data.routes.distanceKm).toBe(55); // 30 + 25
        expect(summary.data.routes.routeCount).toBe(1);
      }
    });

    it('5. consolidates kilometers for date range 01/08 a 15/08', async () => {
      const ds: HomeSearchDataSource = {
        load: jest.fn().mockResolvedValue({
          clients: [],
          deliveries: [],
          factoryPurchases: [],
          financial: {
            costsAvailable: true,
            dailyExpenses: {
              '2026-08-05': { data: '2026-08-05', km: 15 },
              '2026-08-12': { data: '2026-08-12', km: 20 },
              '2026-08-25': { data: '2026-08-25', km: 100 }, // outside
            },
            deliveries: [],
            monthlyExpenses: {},
          },
          routeSessions: [
            {
              id: 'sess-1',
              date: '2026-08-05',
              distanceMeters: 25_000, // 25 km
              durationSeconds: 1000,
              pointsCount: 10,
              startTimestamp: 100,
              endTimestamp: 200,
            },
            {
              id: 'sess-2',
              date: '2026-08-12',
              distanceMeters: 40_000, // 40 km
              durationSeconds: 1000,
              pointsCount: 10,
              startTimestamp: 300,
              endTimestamp: 400,
            },
            {
              id: 'sess-outside',
              date: '2026-08-25',
              distanceMeters: 50_000, // outside
              durationSeconds: 1000,
              pointsCount: 10,
              startTimestamp: 500,
              endTimestamp: 600,
            },
          ],
          coverage: [],
          errors: [],
        }),
      };

      const service = new HomeSearchService(ds);
      const res = await service.search('resumo 01/08 a 15/08', refDate);
      const summary = res.results.find((r) => r.type === 'periodSummary');
      expect(summary).toBeDefined();
      if (summary && summary.type === 'periodSummary') {
        // GPS in range: 25 + 40 = 65 km. Manual in range: 15 + 20 = 35 km. Total: 100 km.
        expect(summary.data.routes.distanceKm).toBe(100);
        expect(summary.data.routes.routeCount).toBe(2);
      }
    });

    it('6. consolidates kilometers for relative week (semana passada: 10/08 a 16/08)', async () => {
      // refDate is Tuesday 2026-08-18 -> last week is Monday 2026-08-10 to Sunday 2026-08-16
      const ds: HomeSearchDataSource = {
        load: jest.fn().mockResolvedValue({
          clients: [],
          deliveries: [],
          factoryPurchases: [],
          financial: {
            costsAvailable: true,
            dailyExpenses: {
              '2026-08-10': { data: '2026-08-10', km: 10 },
              '2026-08-12': { data: '2026-08-12', km: 15 },
              '2026-08-14': { data: '2026-08-14', km: 10 },
              '2026-08-18': { data: '2026-08-18', km: 50 }, // this week (outside)
            },
            deliveries: [],
            monthlyExpenses: {},
          },
          routeSessions: [
            {
              id: 'sess-1',
              date: '2026-08-10',
              distanceMeters: 30_000,
              durationSeconds: 1000,
              pointsCount: 10,
              startTimestamp: 100,
              endTimestamp: 200,
            },
            {
              id: 'sess-2',
              date: '2026-08-12',
              distanceMeters: 31_850,
              durationSeconds: 1000,
              pointsCount: 10,
              startTimestamp: 300,
              endTimestamp: 400,
            },
            {
              id: 'sess-3',
              date: '2026-08-14',
              distanceMeters: 30_000,
              durationSeconds: 1000,
              pointsCount: 10,
              startTimestamp: 500,
              endTimestamp: 600,
            },
          ],
          coverage: [],
          errors: [],
        }),
      };

      const service = new HomeSearchService(ds);
      const res = await service.search('resumo semana passada', refDate);
      const summary = res.results.find((r) => r.type === 'periodSummary');
      expect(summary).toBeDefined();
      if (summary && summary.type === 'periodSummary') {
        // GPS: 30 + 31.85 + 30 = 91.85 km. Manual: 10 + 15 + 10 = 35 km. Total: 126.85 km.
        expect(summary.data.routes.distanceKm).toBeCloseTo(126.85, 2);
        expect(summary.data.routes.routeCount).toBe(3);
      }
    });

    it('7. verifies km agosto and resumo agosto produce identical consolidated kilometers', async () => {
      const ds: HomeSearchDataSource = {
        load: jest.fn().mockResolvedValue({
          clients: [],
          deliveries: [],
          factoryPurchases: [],
          financial: {
            costsAvailable: true,
            dailyExpenses: {
              '2026-08-10': { data: '2026-08-10', km: 20 },
              '2026-08-14': { data: '2026-08-14', km: 30 },
            },
            deliveries: [],
            monthlyExpenses: {},
          },
          routeSessions: [
            {
              id: 'sess-1',
              date: '2026-08-10',
              distanceMeters: 45_000,
              durationSeconds: 1000,
              pointsCount: 10,
              startTimestamp: 100,
              endTimestamp: 200,
            },
            {
              id: 'sess-2',
              date: '2026-08-14',
              distanceMeters: 55_000,
              durationSeconds: 1000,
              pointsCount: 10,
              startTimestamp: 300,
              endTimestamp: 400,
            },
          ],
          coverage: [],
          errors: [],
        }),
      };

      const service = new HomeSearchService(ds);
      const summaryRes = await service.search('resumo agosto', refDate);
      const summary = summaryRes.results.find((r) => r.type === 'periodSummary');

      const kmRes = await service.search('km agosto', refDate);
      const kmRoute = kmRes.results.find((r) => r.type === 'routeSummary');

      expect(summary && summary.type === 'periodSummary').toBe(true);
      expect(kmRoute && kmRoute.type === 'routeSummary').toBe(true);

      if (
        summary &&
        summary.type === 'periodSummary' &&
        kmRoute &&
        kmRoute.type === 'routeSummary'
      ) {
        // GPS: 45 + 55 = 100 km. Manual: 20 + 30 = 50 km. Total: 150 km.
        expect(summary.data.routes.distanceKm).toBe(150);
        expect(kmRoute.data.distanceKm).toBe(150);
        expect(summary.data.routes.routeCount).toBe(2);
        expect(kmRoute.data.routeCount).toBe(2);
      }
    });
  });
});

function financialSummary() {
  return financialCalculationService.calculateResumo({
    deliveries: financialDeliveries,
    dailyExpenses: financialData.dailyExpenses,
    monthlyExpenses: financialData.monthlyExpenses,
    filters: financialFiltersForSelection({ kind: 'month', month: '2026-08' }),
    today: new Date(2026, 7, 13, 12),
  });
}

function financialClientSummary() {
  return financialCalculationService.calculateResumo({
    deliveries: financialDeliveries,
    dailyExpenses: financialData.dailyExpenses,
    monthlyExpenses: financialData.monthlyExpenses,
    filters: {
      ...financialFiltersForSelection({ kind: 'month', month: '2026-08' }),
      buscaCliente: 'Luciano',
      clientId: 'client:luciano',
    },
    today: new Date(2026, 7, 13, 12),
  });
}
