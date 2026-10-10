import { runInNewContext } from 'node:vm';

import { resumoFinanceiroWidget } from '@/features/finance/widgets/ResumoFinanceiroWidget';

jest.mock('@expo/ui/swift-ui', () => ({
  HStack: 'HStack',
  Spacer: 'Spacer',
  Text: 'Text',
  VStack: 'VStack',
}));

jest.mock('@expo/ui/swift-ui/modifiers', () => ({}));

jest.mock('expo-widgets', () => ({
  createWidget: (name: string, layout: string) => ({ name, layout }),
}));

type WidgetTreeNode = {
  type: string;
  props?: { children?: unknown };
};

type WidgetMode = 'wholesale' | 'retail';

const serializedLayout = (resumoFinanceiroWidget as unknown as { layout: string }).layout;
const fixedDate = new Date(2026, 9, 15, 12);

function renderWidget(props: unknown, mode: WidgetMode) {
  const jsx = (type: string, componentProps: Record<string, unknown>) => ({
    type,
    props: componentProps,
  });
  const modifier =
    (name: string) =>
    (...args: unknown[]) => ({ name, args });

  return runInNewContext(`(${serializedLayout})(props, environment)`, {
    props,
    environment: { configuration: { mode }, date: fixedDate },
    Date,
    _jsx: jsx,
    _jsxs: jsx,
    VStack: 'VStack',
    HStack: 'HStack',
    Spacer: 'Spacer',
    Text: 'Text',
    containerBackground: modifier('containerBackground'),
    font: modifier('font'),
    foregroundStyle: modifier('foregroundStyle'),
    kerning: modifier('kerning'),
    lineLimit: modifier('lineLimit'),
    minimumScaleFactor: modifier('minimumScaleFactor'),
    monospacedDigit: modifier('monospacedDigit'),
    allowsTightening: modifier('allowsTightening'),
  });
}

function collectText(node: unknown): string[] {
  if (Array.isArray(node)) {
    return node.flatMap(collectText);
  }

  if (!node || typeof node !== 'object') {
    return [];
  }

  const element = node as WidgetTreeNode;
  if (element.type === 'Text' && typeof element.props?.children === 'string') {
    return [element.props.children];
  }

  return collectText(element.props?.children);
}

describe('ResumoFinanceiro isolated widget layout', () => {
  it.each(['wholesale', 'retail'] as const)(
    'renders current month and unavailable values for empty props in %s mode',
    (mode) => {
      expect(collectText(renderWidget({}, mode))).toEqual([
        'OUTUBRO 2026',
        'FATURAMENTO',
        '—',
        'LUCRO LÍQUIDO',
        '—',
      ]);
    },
  );

  it('safely renders missing and invalid props in both modes', () => {
    const invalidProps = [
      undefined,
      null,
      'invalid',
      [],
      { monthLabel: {}, wholesale: 'invalid', retail: false },
      {
        monthLabel: 202610,
        wholesale: { faturamento: 0, lucroLiquido: false },
        retail: { faturamento: '', lucroLiquido: Number.NaN },
      },
    ];

    for (const mode of ['wholesale', 'retail'] as const) {
      for (const props of invalidProps) {
        expect(() => renderWidget(props, mode)).not.toThrow();
        expect(collectText(renderWidget(props, mode))).toEqual([
          'OUTUBRO 2026',
          'FATURAMENTO',
          '—',
          'LUCRO LÍQUIDO',
          '—',
        ]);
      }
    }
  });

  it.each([
    {
      mode: 'wholesale',
      props: { wholesale: { faturamento: 'R$ 1.234,56' } },
      expectedValue: 'R$ 1.234,56',
    },
    {
      mode: 'retail',
      props: { retail: { lucroLiquido: 'R$ 789,01' } },
      expectedValue: 'R$ 789,01',
    },
  ] as const)(
    'shows partial $mode data and a dash for the missing metric',
    ({ mode, props, expectedValue }) => {
      const text = collectText(renderWidget(props, mode));

      expect(text).toContain(expectedValue);
      expect(text.filter((item) => item === '—')).toHaveLength(1);
    },
  );

  it.each([
    {
      mode: 'wholesale',
      expected: ['R$ 12.345,67', 'R$ 6.789,01'],
      otherMode: ['R$ 98.765,43', 'R$ 45.678,90'],
    },
    {
      mode: 'retail',
      expected: ['R$ 98.765,43', 'R$ 45.678,90'],
      otherMode: ['R$ 12.345,67', 'R$ 6.789,01'],
    },
  ] as const)('uses only the valid snapshot for $mode', ({ mode, expected, otherMode }) => {
    const text = collectText(
      renderWidget(
        {
          monthLabel: 'OUTUBRO 2026',
          wholesale: { faturamento: 'R$ 12.345,67', lucroLiquido: 'R$ 6.789,01' },
          retail: { faturamento: 'R$ 98.765,43', lucroLiquido: 'R$ 45.678,90' },
        },
        mode,
      ),
    );

    for (const value of expected) {
      expect(text).toContain(value);
    }
    for (const value of otherMode) {
      expect(text).not.toContain(value);
    }
    expect(text).not.toContain('—');
  });
});
