import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement } from 'react';

import { useFinancialData } from '@/hooks/useFinancialData';

const mockLoadAppData = jest.fn();
const mockLoadCosts = jest.fn();

jest.mock('@/providers', () => ({
  useAuth: () => ({ user: { id: 'firebase-user' } }),
}));

jest.mock('@/services/data', () => ({
  loadAppData: (...args: unknown[]) => mockLoadAppData(...args),
}));

jest.mock('@/services/costs', () => ({
  firestoreDailyMonthlyDataSource: { load: (...args: unknown[]) => mockLoadCosts(...args) },
}));

const snapshot = {
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
    mockLoadAppData.mockClear();
    mockLoadCosts.mockClear();
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
});
