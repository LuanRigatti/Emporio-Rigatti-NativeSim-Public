import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement } from 'react';

import { useFinancialData } from '@/hooks/useFinancialData';
import type { UserDataSnapshot } from '@/services/data';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

const mockLoadAppData = jest.fn();
const mockLoadCosts = jest.fn();
const mockLoadDeliveries = jest.fn();

jest.mock('@/providers', () => ({
  useAuth: () => ({ user: { id: 'firebase-user' } }),
}));

jest.mock('@/services/data', () => ({
  loadAppData: (...args: unknown[]) => mockLoadAppData(...args),
}));

jest.mock('@/services/costs', () => ({
  firestoreDailyMonthlyDataSource: { load: (...args: unknown[]) => mockLoadCosts(...args) },
}));

jest.mock('@/services/deliveries', () => ({
  firestoreDeliveryDataSource: { load: (...args: unknown[]) => mockLoadDeliveries(...args) },
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
    mockLoadAppData.mockResolvedValue(snapshot);
    mockLoadCosts.mockResolvedValue({ gastosDiarios: snapshot.gastosDiarios, gastosMensais: {} });
    mockLoadDeliveries.mockResolvedValue([]);
    mockLoadAppData.mockClear();
    mockLoadCosts.mockClear();
    mockLoadDeliveries.mockClear();
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
    let resolveNovemberDeliveries: ((value: typeof novemberDelivery[]) => void) | undefined;
    let resolveNovemberCosts:
      | ((value: { gastosDiarios: Record<string, never>; gastosMensais: Record<string, never> }) => void)
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
});
