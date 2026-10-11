import {
  extractFinanceWidgetPublishErrorMetadata,
  summarizeFinanceWidgetTimeline,
} from '@/features/finance/widgets/ResumoFinanceiroWidgetDiagnostics';

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
          wholesale: { faturamento: 'R$ 1.234,56' },
          retail: {},
        },
      },
      {
        date: new Date('2026-11-01T00:00:00.000Z'),
        props: {
          monthKey: '2026-11',
          monthLabel: 'NOVEMBRO 2026',
          wholesale: {},
          retail: {},
        },
      },
      { date: new Date('invalid'), props: {} },
      { date: new Date(), props: { monthKey: '2026-13' } },
    ]);

    expect(summary).toEqual({ entryCount: 4, validEntryCount: 2 });
  });

  it('rejects null and undefined metric values in serialized timeline props', () => {
    expect(
      summarizeFinanceWidgetTimeline([
        {
          date: new Date('2026-10-01T12:00:00.000Z'),
          props: {
            monthKey: '2026-10',
            monthLabel: 'OUTUBRO 2026',
            wholesale: { faturamento: null },
            retail: {},
          },
        },
        {
          date: new Date('2026-10-01T12:00:00.000Z'),
          props: {
            monthKey: '2026-10',
            monthLabel: 'OUTUBRO 2026',
            wholesale: { lucroLiquido: undefined },
            retail: {},
          },
        },
      ]),
    ).toEqual({ entryCount: 2, validEntryCount: 0 });
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

describe('ResumoFinanceiro widget publish error metadata', () => {
  it('classifies the known missing-layout error without adding unavailable fields', () => {
    expect(
      extractFinanceWidgetPublishErrorMetadata({
        name: 'Error',
        code: 'ERR_UPDATED_TIMELINE_WITHOUT_LAYOUT',
        message: 'must not be logged',
      }),
    ).toEqual({
      errorType: 'UpdatedTimelineWithoutLayout',
      errorDomain: null,
      errorCode: 'ERR_UPDATED_TIMELINE_WITHOUT_LAYOUT',
    });
  });

  it('keeps safe metadata from an unknown error and omits its message', () => {
    expect(
      extractFinanceWidgetPublishErrorMetadata({
        name: 'TypeError',
        domain: 'NSCocoaErrorDomain',
        code: 'ERR_UNEXPECTED_NATIVE_FAILURE',
        message: 'private details must not be logged',
      }),
    ).toEqual({
      errorType: 'TypeError',
      errorDomain: 'NSCocoaErrorDomain',
      errorCode: 'ERR_UNEXPECTED_NATIVE_FAILURE',
    });
  });

  it('omits absent, malformed, and unapproved fields', () => {
    expect(
      extractFinanceWidgetPublishErrorMetadata({
        name: 'private error details',
        domain: 'user@example.com',
        code: '12345678901234567890',
      }),
    ).toEqual({
      errorType: null,
      errorDomain: null,
      errorCode: null,
    });
    expect(extractFinanceWidgetPublishErrorMetadata(undefined)).toEqual({
      errorType: null,
      errorDomain: null,
      errorCode: null,
    });
  });
});
