import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement } from 'react';

import { useFinancialData } from '@/hooks/useFinancialData';
import type { UserDataSnapshot } from '@/services/data';
import { financialPeriodSnapshotCache } from '@/services/finance/FinancialPeriodSnapshotCache';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

const mockLoadAppData = jest.fn();
const mockLoadCosts = jest.fn();
const mockLoadCostsWithMetadata = jest.fn();
const mockLoadDeliveries = jest.fn();
const mockLoadAllHistorical = jest.fn();
const mockGetHistoricalDataState = jest.fn();
let mockUserId = 'firebase-user';
let mockSessionVersion = 1;

jest.mock('@/providers', () => ({
  useAuth: () => ({ user: { id: mockUserId }, sessionVersion: mockSessionVersion }),
}));

jest.mock('@/services/data', () => ({
  loadAppData: (...args: unknown[]) => mockLoadAppData(...args),
}));

jest.mock('@/services/costs', () => ({
  firestoreDailyMonthlyDataSource: {
    load: (...args: unknown[]) => mockLoadCosts(...args),
    loadWithMetadata: (...args: unknown[]) => mockLoadCostsWithMetadata(...args),
  },
}));

jest.mock('@/services/deliveries', () => ({
  firestoreDeliveryDataSource: {
    getHistoricalDataState: (...args: unknown[]) => mockGetHistoricalDataState(...args),
    load: (...args: unknown[]) => mockLoadDeliveries(...args),
    loadAllHistorical: (...args: unknown[]) => mockLoadAllHistorical(...args),
  },
  deliveryQueryService: {
    filter: (
      deliveries: unknown[],
      filters: { date?: string; startDate?: string; endDate?: string } = {},
    ) =>
      deliveries.filter((item) => {
        const date = (item as { data: string }).data;
        return (
          (!filters.date || date === filters.date) &&
          (!filters.startDate || date >= filters.startDate) &&
          (!filters.endDate || date <= filters.endDate)
        );
      }),
  },
}));

const snapshot: UserDataSnapshot = {
  clientesCustom: {},
  entregas: [],
  gastosDiarios: { '2026-08-06': { data: '2026-08-06', estar: 10 } },
  gastosMensais: {},
  recebimentoBaldes: [],
};

describe('useFinancialData hydration', () => {
  beforeEach(() => {
    mockUserId = 'firebase-user';
    mockSessionVersion += 1;
    mockLoadAppData.mockResolvedValue(snapshot);
    mockLoadCosts.mockResolvedValue({ gastosDiarios: snapshot.gastosDiarios, gastosMensais: {} });
    mockLoadCostsWithMetadata.mockReset();
    mockLoadCostsWithMetadata.mockResolvedValue({
      remoteComplete: true,
      snapshot: { gastosDiarios: snapshot.gastosDiarios, gastosMensais: {} },
      source: 'network',
    });
    mockLoadDeliveries.mockResolvedValue([]);
    mockLoadAllHistorical.mockReset();
    mockLoadAllHistorical.mockResolvedValue([]);
    mockGetHistoricalDataState.mockReset();
    mockGetHistoricalDataState.mockReturnValue('remote');
    mockLoadAppData.mockClear();
    mockLoadCosts.mockClear();
    mockLoadCostsWithMetadata.mockClear();
    mockLoadDeliveries.mockClear();
    mockLoadAllHistorical.mockClear();
    mockGetHistoricalDataState.mockClear();
  });

  it('keeps refresh stable and does not publish an equivalent snapshot repeatedly', async () => {
    let current: ReturnType<typeof useFinancialData> | undefined;
    let renders = 0;

    function Harness() {
      current = useFinancialData({ date: '2026-08-06' });
      renders += 1;
      return null;
    }

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const first = current;
    expect(first).toBeDefined();
    if (!first) throw new Error('Resultado ausente.');

    await act(async () => {
      renderer?.update(createElement(Harness));
    });
    expect(current?.refresh).toBe(first.refresh);
    expect(current?.reload).toBe(first.reload);
    expect(mockLoadAppData).toHaveBeenCalledTimes(1);
    expect(mockLoadCosts).toHaveBeenCalledTimes(1);
    expect(renders).toBeLessThan(6);

    await act(async () => {
      renderer?.unmount();
    });
  });

  it('does not hydrate when the owning tab is not focused', async () => {
    function Harness() {
      useFinancialData({ date: '2026-08-06' }, { enabled: false });
      return null;
    }

    await act(async () => {
      const renderer = create(createElement(Harness));
      await new Promise((resolve) => setTimeout(resolve, 20));
      renderer.unmount();
    });

    expect(mockLoadAppData).not.toHaveBeenCalled();
    expect(mockLoadCosts).not.toHaveBeenCalled();
  });

  it('uses a bounded Firestore delivery query and keeps an empty month empty', async () => {
    const historicalDelivery = {
      cliente: 'Ana Costa',
      data: '2026-07-20',
      entregue: true,
      id: 'delivery-july',
      quantidade: 2,
      status: 'NÃ£o Pago',
      valor: 100,
    };
    mockLoadAppData.mockResolvedValue({ ...snapshot, entregas: [historicalDelivery] });

    let current: ReturnType<typeof useFinancialData> | undefined;
    function Harness() {
      current = useFinancialData({ startDate: '2026-08-01', endDate: '2026-08-31' });
      return null;
    }

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(mockLoadDeliveries).toHaveBeenCalledWith('firebase-user', {
      mode: 'all',
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    });
    expect(current?.snapshot?.entregas).toEqual([]);

    await act(async () => {
      renderer?.unmount();
    });
  });

  it('publishes deliveries and costs from the same selected period', async () => {
    const augustDelivery = {
      cliente: 'Ana Costa',
      data: '2026-08-20',
      entregue: true,
      id: 'delivery-august',
      quantidade: 3,
      status: 'NÃ£o Pago',
      valor: 150,
    };
    mockLoadAppData.mockResolvedValue({
      ...snapshot,
      entregas: [
        {
          ...augustDelivery,
          data: '2026-07-20',
          id: 'delivery-july',
        },
      ],
    });
    mockLoadDeliveries.mockResolvedValue([augustDelivery]);
    mockLoadCosts.mockResolvedValue({
      gastosDiarios: { '2026-08-05': { data: '2026-08-05', estar: 20 } },
      gastosMensais: { '2026-08': { luz: 40 } },
    });

    let current: ReturnType<typeof useFinancialData> | undefined;
    function Harness() {
      current = useFinancialData({ month: '2026-08' });
      return null;
    }

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(current?.snapshot?.entregas).toEqual([augustDelivery]);
    expect(current?.snapshot?.gastosDiarios).toEqual({
      '2026-08-05': { data: '2026-08-05', estar: 20 },
    });
    expect(current?.snapshot?.gastosMensais).toEqual({ '2026-08': { luz: 40 } });

    await act(async () => {
      renderer?.unmount();
    });
  });

  it('keeps comparison intervals out of the visible month snapshot', async () => {
    const julyDelivery = {
      cliente: 'Ana Costa',
      data: '2026-07-20',
      entregue: true,
      id: 'delivery-july',
      quantidade: 2,
      status: 'NÃ£o Pago',
      valor: 100,
    };
    mockLoadAppData.mockResolvedValue({ ...snapshot, entregas: [julyDelivery] });
    mockLoadDeliveries.mockResolvedValue([julyDelivery]);

    let current: ReturnType<typeof useFinancialData> | undefined;
    function Harness() {
      current = useFinancialData(
        { startDate: '2026-07-01', endDate: '2026-08-10' },
        { displayMonth: '2026-08' },
      );
      return null;
    }

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(current?.snapshot?.entregas).toEqual([]);
    expect(current?.comparisonSnapshot?.entregas).toEqual([julyDelivery]);

    await act(async () => {
      renderer?.unmount();
    });
  });

  it('keeps the previous complete snapshot until the next period is complete', async () => {
    const octoberDelivery = {
      cliente: 'Ana Costa',
      data: '2027-10-20',
      entregue: true,
      id: 'delivery-october',
      quantidade: 2,
      status: 'NÃ£o Pago',
      valor: 100,
    };
    const novemberDelivery = {
      ...octoberDelivery,
      data: '2027-11-20',
      id: 'delivery-november',
      valor: 200,
    };
    let resolveNovemberDeliveries: ((value: (typeof novemberDelivery)[]) => void) | undefined;
    let resolveNovemberCosts:
      | ((value: {
          gastosDiarios: Record<string, never>;
          gastosMensais: Record<string, never>;
        }) => void)
      | undefined;
    mockLoadAppData.mockResolvedValue({ ...snapshot, entregas: [] });
    mockLoadDeliveries.mockImplementation((_, filters: { startDate: string }) => {
      if (filters.startDate === '2027-10-01') return Promise.resolve([octoberDelivery]);
      return new Promise((resolve) => {
        resolveNovemberDeliveries = resolve;
      });
    });
    mockLoadCosts.mockImplementation((_, query: { month: string }) => {
      if (query.month === '2027-10') {
        return Promise.resolve({ gastosDiarios: {}, gastosMensais: {} });
      }
      return new Promise((resolve) => {
        resolveNovemberCosts = resolve;
      });
    });

    let query = { month: '2027-10' };
    let displayMonth = '2027-10';
    let current: ReturnType<typeof useFinancialData> | undefined;
    function Harness() {
      current = useFinancialData(query, { displayMonth });
      return null;
    }

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(current?.snapshot?.entregas).toEqual([octoberDelivery]);
    expect(current?.snapshotScopeKey).toBe('2027-10');
    expect(current?.loading).toBe(false);

    query = { month: '2027-11' };
    displayMonth = '2027-11';
    await act(async () => {
      renderer?.update(createElement(Harness));
      await Promise.resolve();
    });

    expect(current?.snapshot?.entregas).toEqual([octoberDelivery]);
    expect(current?.snapshotScopeKey).toBe('2027-10');
    expect(current?.loading).toBe(true);

    resolveNovemberDeliveries?.([novemberDelivery]);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(current?.snapshot?.entregas).toEqual([octoberDelivery]);
    expect(current?.snapshotScopeKey).toBe('2027-10');
    expect(current?.loading).toBe(true);

    resolveNovemberCosts?.({ gastosDiarios: {}, gastosMensais: {} });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(current?.snapshot?.entregas).toEqual([novemberDelivery]);
    expect(current?.snapshotScopeKey).toBe('2027-11');
    expect(current?.loading).toBe(false);

    await act(async () => {
      renderer?.unmount();
    });
  });

  it('derives day and week immediately from a covered base snapshot', async () => {
    const augustDelivery = {
      cliente: 'Ana Costa',
      data: '2026-08-06',
      entregue: true,
      id: 'delivery-august',
      quantidade: 2,
      status: 'Não Pago',
      valor: 100,
    };
    const otherAugustDelivery = {
      ...augustDelivery,
      data: '2026-08-20',
      id: 'delivery-august-20',
      valor: 200,
    };
    const baseSnapshot = {
      ...snapshot,
      entregas: [augustDelivery, otherAugustDelivery],
      gastosDiarios: {
        '2026-08-06': { data: '2026-08-06', estar: 10 },
        '2026-08-20': { data: '2026-08-20', estar: 20 },
      },
    };
    mockLoadAppData.mockResolvedValue(baseSnapshot);
    mockLoadDeliveries.mockResolvedValue(baseSnapshot.entregas);
    mockLoadCosts.mockResolvedValue({
      gastosDiarios: baseSnapshot.gastosDiarios,
      gastosMensais: {},
    });

    let query: { date: string } | { endDate: string; startDate: string } = {
      endDate: '2026-08-31',
      startDate: '2026-08-01',
    };
    let current: ReturnType<typeof useFinancialData> | undefined;
    function Harness() {
      current = useFinancialData(query);
      return null;
    }

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(current?.snapshot?.entregas).toEqual(baseSnapshot.entregas);

    mockLoadAppData.mockImplementation(() => new Promise(() => {}));
    query = { date: '2026-08-06' };
    await act(async () => {
      renderer?.update(createElement(Harness));
    });

    expect(current?.snapshot?.entregas).toEqual([augustDelivery]);
    expect(current?.snapshotScopeKey).toBe(JSON.stringify(query));
    expect(current?.loading).toBe(false);
    expect(current?.remoteComplete).toBe(false);

    query = { startDate: '2026-08-16', endDate: '2026-08-22' };
    await act(async () => {
      renderer?.update(createElement(Harness));
    });

    expect(current?.snapshot?.entregas).toEqual([otherAugustDelivery]);
    expect(current?.snapshotScopeKey).toBe(JSON.stringify(query));
    expect(current?.loading).toBe(false);
    expect(mockLoadAppData).toHaveBeenCalledTimes(3);

    await act(async () => {
      renderer?.unmount();
    });
  });

  it('does not derive a period from an incomplete cached all-time base', async () => {
    const incompleteBaseSnapshot = {
      ...snapshot,
      entregas: [],
      gastosDiarios: {
        '2026-09-16': { data: '2026-09-16', estar: 10 },
        '2026-09-17': { data: '2026-09-17', estar: 20 },
        '2026-09-18': { data: '2026-09-18', estar: 30 },
      },
    };
    mockLoadAllHistorical.mockResolvedValue(incompleteBaseSnapshot.entregas);
    mockGetHistoricalDataState.mockReturnValue('partial');
    mockLoadCostsWithMetadata.mockResolvedValue({
      remoteComplete: false,
      snapshot: {
        gastosDiarios: incompleteBaseSnapshot.gastosDiarios,
        gastosMensais: {},
      },
      source: 'cache',
    });

    let query: { loadAll: boolean } | { endDate: string; startDate: string } = { loadAll: true };
    let current: ReturnType<typeof useFinancialData> | undefined;
    function Harness() {
      current = useFinancialData(query);
      return null;
    }

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(current?.coverage).toMatchObject({ remoteComplete: false, source: 'cache' });

    mockLoadAppData.mockImplementation(() => new Promise(() => {}));
    query = { endDate: '2026-09-18', startDate: '2026-09-16' };
    await act(async () => {
      renderer?.update(createElement(Harness));
    });

    expect(current?.snapshot?.entregas).toEqual([]);
    expect(current?.snapshotScopeKey).toBe('all');
    expect(current?.loading).toBe(true);

    await act(async () => {
      renderer?.unmount();
    });
  });

  it('derives a week immediately only from a complete all-time base', async () => {
    const weekDeliveries = [
      {
        cliente: 'Ana Costa',
        data: '2026-09-17',
        entregue: true,
        id: 'delivery-week',
        quantidade: 2,
        status: 'Não Pago',
        valor: 200,
      },
    ];
    mockLoadAllHistorical.mockResolvedValue(weekDeliveries);
    mockGetHistoricalDataState.mockReturnValue('remote');
    mockLoadCostsWithMetadata.mockResolvedValue({
      remoteComplete: true,
      snapshot: { gastosDiarios: {}, gastosMensais: {} },
      source: 'network',
    });

    let query: { loadAll: boolean } | { endDate: string; startDate: string } = { loadAll: true };
    let current: ReturnType<typeof useFinancialData> | undefined;
    function Harness() {
      current = useFinancialData(query);
      return null;
    }

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(current?.remoteComplete).toBe(true);

    mockLoadAppData.mockImplementation(() => new Promise(() => {}));
    query = { endDate: '2026-09-18', startDate: '2026-09-16' };
    await act(async () => {
      renderer?.update(createElement(Harness));
    });

    expect(current?.snapshot?.entregas).toEqual(weekDeliveries);
    expect(current?.snapshotScopeKey).toBe(JSON.stringify(query));
    expect(current?.loading).toBe(false);
    expect(current?.remoteComplete).toBe(false);

    await act(async () => {
      renderer?.unmount();
    });
  });

  it('preserves a stronger base when a later all-time fallback is local', async () => {
    const weekDelivery = {
      cliente: 'Ana Costa',
      data: '2026-09-17',
      entregue: true,
      id: 'delivery-week',
      quantidade: 2,
      status: 'Não Pago',
      valor: 200,
    };
    mockLoadAllHistorical.mockResolvedValueOnce([weekDelivery]).mockResolvedValue([]);
    mockGetHistoricalDataState.mockReturnValueOnce('remote').mockReturnValue('partial');
    mockLoadCostsWithMetadata
      .mockResolvedValueOnce({
        remoteComplete: true,
        snapshot: { gastosDiarios: {}, gastosMensais: {} },
        source: 'network',
      })
      .mockResolvedValue({
        remoteComplete: false,
        snapshot: { gastosDiarios: {}, gastosMensais: {} },
        source: 'cache',
      });

    let query: { loadAll: boolean } | { endDate: string; startDate: string } = { loadAll: true };
    let current: ReturnType<typeof useFinancialData> | undefined;
    function Harness() {
      current = useFinancialData(query);
      return null;
    }

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    await act(async () => {
      await current?.reload();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    mockLoadAppData.mockImplementation(() => new Promise(() => {}));
    query = { endDate: '2026-09-18', startDate: '2026-09-16' };
    await act(async () => {
      renderer?.update(createElement(Harness));
    });

    expect(current?.snapshot?.entregas).toEqual([weekDelivery]);
    expect(current?.snapshotScopeKey).toBe(JSON.stringify(query));
    expect(current?.loading).toBe(false);

    await act(async () => {
      renderer?.unmount();
    });
  });

  it('allows a confirmed empty day to derive zero from covered delivery data', async () => {
    mockLoadAppData.mockResolvedValue(snapshot);
    mockLoadDeliveries.mockResolvedValue([]);
    mockLoadCosts.mockResolvedValue({
      gastosDiarios: { '2026-09-17': { data: '2026-09-17', estar: 20 } },
      gastosMensais: {},
    });

    let query: { date: string } | { endDate: string; startDate: string } = {
      endDate: '2026-09-18',
      startDate: '2026-09-16',
    };
    let current: ReturnType<typeof useFinancialData> | undefined;
    function Harness() {
      current = useFinancialData(query);
      return null;
    }

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    mockLoadAppData.mockImplementation(() => new Promise(() => {}));
    query = { date: '2026-09-17' };
    await act(async () => {
      renderer?.update(createElement(Harness));
    });

    expect(current?.snapshot?.entregas).toEqual([]);
    expect(current?.snapshotScopeKey).toBe(JSON.stringify(query));
    expect(current?.loading).toBe(false);

    await act(async () => {
      renderer?.unmount();
    });
  });

  it('derives the monthly value immediately and keeps comparison independent', async () => {
    const julyDelivery = {
      cliente: 'Ana Costa',
      data: '2037-07-20',
      entregue: true,
      id: 'delivery-july',
      quantidade: 1,
      status: 'Não Pago',
      valor: 80,
    };
    const augustDelivery = {
      ...julyDelivery,
      data: '2037-08-06',
      id: 'delivery-august',
      valor: 120,
    };
    const baseSnapshot = {
      ...snapshot,
      entregas: [julyDelivery, augustDelivery],
      gastosDiarios: {
        '2037-07-20': { data: '2037-07-20', estar: 10 },
        '2037-08-06': { data: '2037-08-06', estar: 20 },
      },
    };
    mockLoadAllHistorical.mockResolvedValue(baseSnapshot.entregas);
    mockGetHistoricalDataState.mockReturnValue('remote');
    mockLoadCostsWithMetadata.mockResolvedValue({
      remoteComplete: true,
      snapshot: {
        gastosDiarios: baseSnapshot.gastosDiarios,
        gastosMensais: {},
      },
      source: 'network',
    });

    let query: { loadAll: boolean } | { endDate: string; startDate: string } = { loadAll: true };
    let displayMonth: string | undefined;
    let current: ReturnType<typeof useFinancialData> | undefined;
    function Harness() {
      current = useFinancialData(query, { displayMonth });
      return null;
    }

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(current?.snapshot).toEqual(baseSnapshot);

    mockLoadAppData.mockImplementation(() => new Promise(() => {}));
    query = { endDate: '2037-08-31', startDate: '2037-07-01' };
    displayMonth = '2037-08';
    await act(async () => {
      renderer?.update(createElement(Harness));
    });

    expect(current?.snapshot?.entregas).toEqual([augustDelivery]);
    expect(current?.comparisonSnapshot?.entregas).toEqual(baseSnapshot.entregas);
    expect(current?.snapshotScopeKey).toBe('2037-08');
    expect(current?.loading).toBe(false);
    expect(current?.remoteComplete).toBe(false);

    await act(async () => {
      renderer?.unmount();
    });
  });

  it('does not retain the previous period after switching to an empty period', async () => {
    const julyDelivery = {
      cliente: 'Ana Costa',
      data: '2026-07-20',
      entregue: true,
      id: 'delivery-july',
      quantidade: 2,
      status: 'NÃ£o Pago',
      valor: 100,
    };
    mockLoadDeliveries
      .mockResolvedValueOnce([julyDelivery])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([julyDelivery]);
    let query = { startDate: '2026-07-01', endDate: '2026-07-31' };
    let current: ReturnType<typeof useFinancialData> | undefined;

    function Harness() {
      current = useFinancialData(query);
      return null;
    }

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(current?.snapshot?.entregas).toEqual([julyDelivery]);

    query = { startDate: '2026-08-01', endDate: '2026-08-31' };
    await act(async () => {
      renderer?.update(createElement(Harness));
    });
    expect(current?.snapshot?.entregas).toEqual([]);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(current?.snapshot?.entregas).toEqual([]);
    expect(mockLoadDeliveries).toHaveBeenCalledTimes(2);

    query = { startDate: '2026-07-01', endDate: '2026-07-31' };
    await act(async () => {
      renderer?.update(createElement(Harness));
    });
    expect(current?.snapshot?.entregas).toEqual([julyDelivery]);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      renderer?.unmount();
    });
  });

  it('keeps the known snapshot while revalidating the same period', async () => {
    const augustDelivery = {
      cliente: 'Ana Costa',
      data: '2026-08-06',
      entregue: true,
      id: 'delivery-august',
      quantidade: 1,
      status: 'NÃƒÂ£o Pago',
      valor: 55,
    };
    mockLoadAppData.mockResolvedValue(snapshot);
    mockLoadDeliveries.mockResolvedValue([augustDelivery]);

    let enabled = true;
    let current: ReturnType<typeof useFinancialData> | undefined;
    const deliveryCounts: number[] = [];
    function Harness() {
      current = useFinancialData(
        { startDate: '2026-08-01', endDate: '2026-08-31' },
        { enabled, displayMonth: '2026-08' },
      );
      deliveryCounts.push(current.snapshot?.entregas.length ?? 0);
      return null;
    }

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(current?.snapshot?.entregas).toEqual([augustDelivery]);
    const countBeforeRevalidation = deliveryCounts.length;

    enabled = false;
    await act(async () => {
      renderer?.update(createElement(Harness));
    });
    enabled = true;
    await act(async () => {
      renderer?.update(createElement(Harness));
    });

    expect(current?.snapshot?.entregas).toEqual([augustDelivery]);
    expect(deliveryCounts.slice(countBeforeRevalidation)).not.toContain(0);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      renderer?.unmount();
    });
  });

  it('ignores a late response from a previous period', async () => {
    const julyDelivery = {
      cliente: 'Ana Costa',
      data: '2026-07-20',
      entregue: true,
      id: 'delivery-july',
      quantidade: 2,
      status: 'NÃ£o Pago',
      valor: 100,
    };
    let resolveJuly: ((value: typeof snapshot) => void) | undefined;
    let resolveAugust: ((value: typeof snapshot) => void) | undefined;
    const julyPromise = new Promise<typeof snapshot>((resolve) => {
      resolveJuly = resolve;
    });
    const augustPromise = new Promise<typeof snapshot>((resolve) => {
      resolveAugust = resolve;
    });
    mockLoadAppData
      .mockReset()
      .mockImplementationOnce(() => julyPromise)
      .mockImplementationOnce(() => augustPromise);
    mockLoadDeliveries.mockImplementation((_, filters: { startDate: string }) =>
      Promise.resolve(filters.startDate === '2026-07-01' ? [julyDelivery] : []),
    );

    let query = { startDate: '2026-07-01', endDate: '2026-07-31' };
    let current: ReturnType<typeof useFinancialData> | undefined;
    function Harness() {
      current = useFinancialData(query);
      return null;
    }

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness));
      await Promise.resolve();
    });

    query = { startDate: '2026-08-01', endDate: '2026-08-31' };
    await act(async () => {
      renderer?.update(createElement(Harness));
      await Promise.resolve();
    });
    resolveAugust?.(snapshot);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(current?.snapshot?.entregas).toEqual([]);

    await act(async () => {
      resolveJuly?.({ ...snapshot, entregas: [julyDelivery] });
      await Promise.resolve();
    });
    expect(current?.snapshot?.entregas).toEqual([]);

    await act(async () => {
      renderer?.unmount();
    });
  });

  it('loads Total from the canonical Firestore history and costs sources', async () => {
    const allTimeDeliveries = [
      {
        cliente: 'Ana Costa',
        data: '2026-08-06',
        entregue: true,
        id: 'delivery-all-time',
        quantidade: 2,
        status: 'Não Pago',
        valor: 100,
      },
    ];
    const allTimeCosts = {
      gastosDiarios: { '2026-08-06': { data: '2026-08-06', estar: 20 } },
      gastosMensais: { '2026-08': { luz: 40 } },
    };
    let resolveDeliveries: ((value: typeof allTimeDeliveries) => void) | undefined;
    let resolveCosts:
      | ((value: {
          remoteComplete: true;
          snapshot: typeof allTimeCosts;
          source: 'network';
        }) => void)
      | undefined;
    mockLoadAllHistorical.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDeliveries = resolve;
        }),
    );
    mockLoadCostsWithMetadata.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCosts = resolve;
        }),
    );

    let current: ReturnType<typeof useFinancialData> | undefined;
    function Harness() {
      current = useFinancialData({ loadAll: true });
      return null;
    }

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness));
    });
    expect(current?.loading).toBe(true);

    resolveDeliveries?.(allTimeDeliveries);
    resolveCosts?.({ remoteComplete: true, snapshot: allTimeCosts, source: 'network' });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(current?.snapshot).toEqual({
      ...snapshot,
      entregas: allTimeDeliveries,
      gastosDiarios: allTimeCosts.gastosDiarios,
      gastosMensais: allTimeCosts.gastosMensais,
    });
    expect(current?.remoteComplete).toBe(true);
    expect(current?.coverage).toMatchObject({
      routesCoverage: 'local-only',
      source: 'remote',
    });
    expect(mockLoadAppData).not.toHaveBeenCalled();
    expect(mockLoadAllHistorical).toHaveBeenCalledWith('firebase-user', mockSessionVersion, {
      revalidate: true,
    });
    expect(mockLoadCostsWithMetadata).toHaveBeenCalledWith('firebase-user', { loadAll: true });

    await act(async () => {
      renderer?.unmount();
    });
  });

  it('shows the all-time cache immediately without treating it as remotely complete', async () => {
    await financialPeriodSnapshotCache.writeAllTime(mockUserId, mockSessionVersion, snapshot);
    mockLoadAllHistorical.mockImplementation(() => new Promise(() => {}));
    mockLoadCostsWithMetadata.mockImplementation(() => new Promise(() => {}));

    let current: ReturnType<typeof useFinancialData> | undefined;
    function Harness() {
      current = useFinancialData({ loadAll: true });
      return null;
    }

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness));
    });

    expect(current?.snapshot).toEqual(snapshot);
    expect(current?.loading).toBe(false);
    expect(current?.remoteComplete).toBe(false);
    expect(current?.coverage.source).toBe('cache');
    expect(current?.error).toBeUndefined();

    await act(async () => {
      renderer?.unmount();
    });
  });

  it('keeps the all-time cache when canonical revalidation fails', async () => {
    await financialPeriodSnapshotCache.writeAllTime(mockUserId, mockSessionVersion, snapshot);
    mockLoadAllHistorical.mockRejectedValue(new Error('Firestore unavailable'));
    mockLoadCostsWithMetadata.mockResolvedValue({
      remoteComplete: true,
      snapshot: { gastosDiarios: snapshot.gastosDiarios, gastosMensais: {} },
      source: 'network',
    });

    let current: ReturnType<typeof useFinancialData> | undefined;
    function Harness() {
      current = useFinancialData({ loadAll: true });
      return null;
    }

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(current?.snapshot).toEqual(snapshot);
    expect(current?.remoteComplete).toBe(false);
    expect(current?.error).toBe('Firestore unavailable');

    await act(async () => {
      renderer?.unmount();
    });
  });

  it('coalesces equivalent Total loads for the same uid and session', async () => {
    let resolveDeliveries: ((value: UserDataSnapshot['entregas']) => void) | undefined;
    let resolveCosts:
      | ((value: {
          remoteComplete: true;
          snapshot: {
            gastosDiarios: UserDataSnapshot['gastosDiarios'];
            gastosMensais: Record<string, never>;
          };
          source: 'network';
        }) => void)
      | undefined;
    mockLoadAllHistorical.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDeliveries = resolve;
        }),
    );
    mockLoadCostsWithMetadata.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCosts = resolve;
        }),
    );

    let first: ReturnType<typeof useFinancialData> | undefined;
    let second: ReturnType<typeof useFinancialData> | undefined;
    function Harness() {
      first = useFinancialData({ loadAll: true });
      second = useFinancialData({ loadAll: true });
      return null;
    }

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness));
      await Promise.resolve();
    });
    expect(mockLoadAllHistorical).toHaveBeenCalledTimes(1);
    expect(mockLoadCostsWithMetadata).toHaveBeenCalledTimes(1);

    resolveDeliveries?.([]);
    resolveCosts?.({
      remoteComplete: true,
      snapshot: { gastosDiarios: snapshot.gastosDiarios, gastosMensais: {} },
      source: 'network',
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(first?.snapshot).toEqual(snapshot);
    expect(second?.snapshot).toEqual(snapshot);
    await act(async () => {
      renderer?.unmount();
    });
  });

  it('discards an all-time response after the session changes', async () => {
    let resolveFirstDeliveries: ((value: UserDataSnapshot['entregas']) => void) | undefined;
    let resolveSecondDeliveries: ((value: UserDataSnapshot['entregas']) => void) | undefined;
    let resolveFirstCosts:
      | ((value: {
          remoteComplete: true;
          snapshot: {
            gastosDiarios: UserDataSnapshot['gastosDiarios'];
            gastosMensais: UserDataSnapshot['gastosMensais'];
          };
          source: 'network';
        }) => void)
      | undefined;
    let resolveSecondCosts:
      | ((value: {
          remoteComplete: true;
          snapshot: {
            gastosDiarios: UserDataSnapshot['gastosDiarios'];
            gastosMensais: UserDataSnapshot['gastosMensais'];
          };
          source: 'network';
        }) => void)
      | undefined;
    mockLoadAllHistorical
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstDeliveries = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecondDeliveries = resolve;
          }),
      );
    mockLoadCostsWithMetadata
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstCosts = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecondCosts = resolve;
          }),
      );

    const secondSnapshot = {
      ...snapshot,
      entregas: [{ ...snapshot.entregas[0], id: 'session-b' }],
    };
    let current: ReturnType<typeof useFinancialData> | undefined;
    function Harness() {
      current = useFinancialData({ loadAll: true });
      return null;
    }

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness));
      await Promise.resolve();
    });

    mockUserId = 'user-b';
    mockSessionVersion += 1;
    await act(async () => {
      renderer?.update(createElement(Harness));
      await Promise.resolve();
    });

    resolveSecondDeliveries?.(secondSnapshot.entregas);
    resolveSecondCosts?.({
      remoteComplete: true,
      snapshot: { gastosDiarios: snapshot.gastosDiarios, gastosMensais: {} },
      source: 'network',
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(current?.snapshot).toEqual(secondSnapshot);

    resolveFirstDeliveries?.(snapshot.entregas);
    resolveFirstCosts?.({
      remoteComplete: true,
      snapshot: { gastosDiarios: snapshot.gastosDiarios, gastosMensais: {} },
      source: 'network',
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(current?.snapshot).toEqual(secondSnapshot);

    await act(async () => {
      renderer?.unmount();
    });
  });
});
