import { runInNewContext } from 'node:vm';

import { resumoFinanceiroWidget } from '@/features/finance/widgets/ResumoFinanceiroWidget';

jest.mock('@expo/ui/swift-ui', () => ({
  HStack: 'HStack',
  Image: 'Image',
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
  props?: {
    children?: unknown;
    modifiers?: { args?: unknown[]; name: string }[];
    uiImage?: string;
  };
};

type WidgetMode = 'wholesale' | 'retail';

const serializedLayout = (resumoFinanceiroWidget as unknown as { layout: string }).layout;
const fixedDate = new Date(2026, 9, 15, 12);

function renderWidget(
  props: unknown,
  mode: WidgetMode,
  colorScheme: 'light' | 'dark' = 'light',
  widgetsDirectory: string | null = 'file:///group/ExpoWidgets',
  diagnosticVariant:
    | 'full'
    | 'without_image'
    | 'static_test'
    | 'previous_layout'
    | 'redaction'
    | 'redaction_unredacted' = 'full',
) {
  const jsx = (type: string, componentProps: Record<string, unknown>) => ({
    type,
    props: componentProps,
  });
  const modifier =
    (name: string) =>
    (...args: unknown[]) => ({ name, args });

  return runInNewContext(`(${serializedLayout})(props, environment)`, {
    props,
    environment: {
      configuration: { mode, diagnosticVariant },
      date: fixedDate,
      colorScheme,
      widgetsDirectory,
    },
    Date,
    _jsx: jsx,
    _jsxs: jsx,
    VStack: 'VStack',
    HStack: 'HStack',
    Image: 'Image',
    Spacer: 'Spacer',
    Text: 'Text',
    containerBackground: modifier('containerBackground'),
    background: modifier('background'),
    clipped: modifier('clipped'),
    containerRelativeFrame: modifier('containerRelativeFrame'),
    frame: modifier('frame'),
    font: modifier('font'),
    foregroundStyle: modifier('foregroundStyle'),
    kerning: modifier('kerning'),
    lineLimit: modifier('lineLimit'),
    minimumScaleFactor: modifier('minimumScaleFactor'),
    monospacedDigit: modifier('monospacedDigit'),
    allowsTightening: modifier('allowsTightening'),
    resizable: modifier('resizable'),
    scaleEffect: modifier('scaleEffect'),
    padding: modifier('padding'),
    shapes: {
      roundedRectangle: (args: unknown) => ({ name: 'roundedRectangle', args }),
    },
    unredacted: modifier('unredacted'),
    widgetURL: modifier('widgetURL'),
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

function collectNodes(node: unknown, type: string): WidgetTreeNode[] {
  if (Array.isArray(node)) {
    return node.flatMap((child) => collectNodes(child, type));
  }

  if (!node || typeof node !== 'object') {
    return [];
  }

  const element = node as WidgetTreeNode;
  return [
    ...(element.type === type ? [element] : []),
    ...collectNodes(element.props?.children, type),
  ];
}

describe('ResumoFinanceiro isolated widget layout', () => {
  it.each(['wholesale', 'retail'] as const)(
    'renders the brand and unavailable values for empty props in %s mode',
    (mode) => {
      expect(collectText(renderWidget({}, mode))).toEqual([
        'Empório Rigatti',
        'Faturamento',
        '—',
        'Lucro líquido',
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
          'Empório Rigatti',
          'Faturamento',
          '—',
          'Lucro líquido',
          '—',
        ]);
      }
    }
  });

  it('renders two equal rounded metric cards and omits the month label', () => {
    const tree = renderWidget(
      {
        monthKey: '2026-10',
        monthLabel: 'OUTUBRO 2026',
        wholesale: { faturamento: 'R$ 150,00', lucroLiquido: 'R$ 45,00' },
      },
      'wholesale',
    );

    expect(collectText(tree)).toEqual([
      'Empório Rigatti',
      'Faturamento',
      'R$ 150,00',
      'Lucro líquido',
      'R$ 45,00',
    ]);

    const cards = collectNodes(tree, 'VStack').filter(({ props }) =>
      props?.modifiers?.some(({ name }) => name === 'containerRelativeFrame'),
    );
    expect(cards).toHaveLength(2);
    for (const card of cards) {
      const cardFrame = card.props?.modifiers?.find(
        ({ name }) => name === 'containerRelativeFrame',
      );
      expect(cardFrame?.args?.[0]).toEqual({
        axes: 'horizontal',
        count: 2,
        span: 1,
        spacing: 12,
      });
      const cardBackground = card.props?.modifiers?.find(({ name }) => name === 'background');
      expect(cardBackground?.args?.[1]).toMatchObject({
        name: 'roundedRectangle',
        args: { cornerRadius: 18, roundedCornerStyle: 'continuous' },
      });
    }
    expect(collectNodes(tree, 'Divider')).toHaveLength(0);
  });

  it.each([
    ['light', 'resumo-financeiro-splash-light.png'],
    ['dark', 'resumo-financeiro-splash-dark.png'],
  ] as const)('uses the canonical splash logo for %s appearance', (colorScheme, fileName) => {
    const image = collectNodes(renderWidget({}, 'wholesale', colorScheme), 'Image')[0];

    expect(image?.props?.uiImage).toBe(`file:///group/ExpoWidgets/${fileName}`);
    expect(image?.props?.modifiers?.map(({ name }) => name)).toEqual([
      'resizable',
      'frame',
      'scaleEffect',
      'clipped',
    ]);
  });

  it('keeps the values and placeholders when the shared logo directory is unavailable', () => {
    const tree = renderWidget({}, 'wholesale', 'light', null);

    expect(collectNodes(tree, 'Image')).toHaveLength(0);
    expect(collectText(tree)).toEqual([
      'Empório Rigatti',
      'Faturamento',
      '—',
      'Lucro líquido',
      '—',
    ]);
  });

  it.each(['wholesale', 'retail'] as const)(
    'sets the native widget URL for the configured %s mode',
    (mode) => {
      const tree = renderWidget(
        { financeRouteURL: 'pareact://financeiro' },
        mode,
      ) as WidgetTreeNode;
      const routeModifier = tree.props?.modifiers?.find(({ name }) => name === 'widgetURL');

      expect(routeModifier?.args).toEqual([`pareact://financeiro?mode=${mode}`]);
    },
  );

  it('appends the configured mode when the app URL already contains query parameters', () => {
    const tree = renderWidget(
      { financeRouteURL: 'pareact://financeiro?channel=development' },
      'retail',
    ) as WidgetTreeNode;
    const routeModifier = tree.props?.modifiers?.find(({ name }) => name === 'widgetURL');

    expect(routeModifier?.args).toEqual(['pareact://financeiro?channel=development&mode=retail']);
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

  it.each(['wholesale', 'retail'] as const)(
    'variant B preserves the new card layout and removes only the splash image in %s mode',
    (mode) => {
      const tree = renderWidget(
        { financeRouteURL: 'pareact://financeiro' },
        mode,
        'light',
        'file:///group/ExpoWidgets',
        'without_image',
      ) as WidgetTreeNode;

      expect(collectText(tree)).toEqual([
        'Empório Rigatti',
        'Faturamento',
        '—',
        'Lucro líquido',
        '—',
      ]);
      expect(collectNodes(tree, 'Image')).toHaveLength(0);
      expect(tree.props?.modifiers?.find(({ name }) => name === 'widgetURL')?.args).toEqual([
        `pareact://financeiro?mode=${mode}`,
      ]);
      expect(
        collectNodes(tree, 'VStack').filter(({ props }) =>
          props?.modifiers?.some(({ name }) => name === 'containerRelativeFrame'),
        ),
      ).toHaveLength(2);
      expect(
        collectNodes(tree, 'Spacer').some(({ props }) =>
          props?.modifiers?.some(
            ({ name, args }) =>
              name === 'frame' &&
              (args?.[0] as { width?: number; height?: number } | undefined)?.width === 32 &&
              (args?.[0] as { width?: number; height?: number } | undefined)?.height === 32,
          ),
        ),
      ).toBe(true);
    },
  );

  it('variant C shows only clearly marked fictitious static content', () => {
    const tree = renderWidget(
      { wholesale: { faturamento: 'R$ 999.999,99', lucroLiquido: 'R$ 888.888,88' } },
      'wholesale',
      'light',
      'file:///group/ExpoWidgets',
      'static_test',
    );
    const text = collectText(tree);

    expect(text).toContain('DIAGNÓSTICO C · TESTE');
    expect(text).toContain('FATURAMENTO FICTÍCIO · R$ 123,45');
    expect(text).toContain('LUCRO FICTÍCIO · R$ 67,89');
    expect(text).toContain('DADOS INVENTADOS PARA TESTE');
    expect(text).not.toContain('R$ 999.999,99');
    expect(text).not.toContain('R$ 888.888,88');
    expect(collectNodes(tree, 'Image')).toHaveLength(0);
  });

  it.each(['wholesale', 'retail'] as const)(
    'variant D reproduces the previous vertical visual using the current %s snapshot',
    (mode) => {
      const tree = renderWidget(
        {
          monthKey: '2026-10',
          wholesale: { faturamento: 'R$ 150,00', lucroLiquido: 'R$ 45,00' },
          retail: { faturamento: 'R$ 50,00', lucroLiquido: 'R$ 15,00' },
        },
        mode,
        'light',
        'file:///group/ExpoWidgets',
        'previous_layout',
      );

      expect(collectText(tree)).toEqual([
        'OUTUBRO 2026',
        'FATURAMENTO',
        mode === 'wholesale' ? 'R$ 150,00' : 'R$ 50,00',
        'LUCRO LÍQUIDO',
        mode === 'wholesale' ? 'R$ 45,00' : 'R$ 15,00',
      ]);
      expect(collectNodes(tree, 'Image')).toHaveLength(0);
      expect(
        collectNodes(tree, 'VStack').filter(({ props }) =>
          props?.modifiers?.some(({ name }) => name === 'containerRelativeFrame'),
        ),
      ).toHaveLength(0);
      expect(JSON.stringify(tree)).toContain('"name":"kerning"');
      expect(serializedLayout).not.toContain('toLocaleDateString');
    },
  );

  it.each([
    ['redaction', false],
    ['redaction_unredacted', true],
  ] as const)(
    'variant E uses only static non-sensitive content; unredacted=%s',
    (variant, unredactedExpected) => {
      const tree = renderWidget(
        { retail: { faturamento: 'R$ 999.999,99', lucroLiquido: 'R$ 888.888,88' } },
        'retail',
        'light',
        'file:///group/ExpoWidgets',
        variant,
      );
      const text = collectText(tree);
      const rootModifiers = (tree as WidgetTreeNode).props?.modifiers ?? [];

      expect(text).toContain('DIAGNÓSTICO E · REDACTION');
      expect(text).toContain('TEXTO ESTÁTICO NÃO SENSÍVEL');
      expect(text).toContain('SEM DADOS FINANCEIROS');
      expect(text).not.toContain('R$ 999.999,99');
      expect(text).not.toContain('R$ 888.888,88');
      expect(rootModifiers.some(({ name }) => name === 'unredacted')).toBe(unredactedExpected);
      expect(collectNodes(tree, 'Image')).toHaveLength(0);
    },
  );
});
