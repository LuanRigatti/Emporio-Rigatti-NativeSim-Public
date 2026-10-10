import { summarizeFinanceWidgetTimeline } from '@/features/finance/widgets/ResumoFinanceiroWidgetDiagnostics';

jest.mock('expo-modules-core', () => ({
  requireOptionalNativeModule: () => null,
}));

describe('ResumoFinanceiro widget diagnostic timeline summary', () => {
  it('counts readable and structurally valid entries without inspecting metric values', () => {
    const summary = summarizeFinanceWidgetTimeline([
      {
        date: new Date('2026-10-01T12:00:00.000Z'),
        props: {
          monthKey: '2026-10',
          monthLabel: 'OUTUBRO 2026',
          wholesale: { faturamento: 'R$ 1.234,56', lucroLiquido: null },
          retail: { faturamento: null, lucroLiquido: null },
        },
      },
      {
        date: new Date('2026-11-01T00:00:00.000Z'),
        props: {
          monthKey: '2026-11',
          monthLabel: 'NOVEMBRO 2026',
          wholesale: { faturamento: null, lucroLiquido: null },
          retail: { faturamento: null, lucroLiquido: null },
        },
      },
      { date: new Date('invalid'), props: {} },
      { date: new Date(), props: { monthKey: '2026-13' } },
    ]);

    expect(summary).toEqual({ entryCount: 4, validEntryCount: 2 });
  });

  it('reports an empty summary for a missing or malformed timeline result', () => {
    expect(summarizeFinanceWidgetTimeline(undefined)).toEqual({
      entryCount: 0,
      validEntryCount: 0,
    });
    expect(summarizeFinanceWidgetTimeline({ entries: [] })).toEqual({
      entryCount: 0,
      validEntryCount: 0,
    });
  });
});
