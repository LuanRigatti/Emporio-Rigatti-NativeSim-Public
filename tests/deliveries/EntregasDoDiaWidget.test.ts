import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

import { entregasDoDiaWidget } from '@/features/deliveries/widgets/EntregasDoDiaWidget';

jest.mock('@expo/ui/swift-ui', () => ({
  Button: 'Button',
  HStack: 'HStack',
  Image: 'Image',
  Link: 'Link',
  Spacer: 'Spacer',
  Text: 'Text',
  VStack: 'VStack',
}));

jest.mock('@expo/ui/swift-ui/modifiers', () => ({}));

jest.mock('expo-widgets', () => ({
  createWidget: (name: string, layout: string) => ({ name, layout }),
}));

type TreeNode = {
  type: string;
  props?: {
    alignment?: string;
    children?: unknown;
    modifiers?: { args?: unknown[]; name: string }[];
    minLength?: number;
    spacing?: number;
    uiImage?: string;
    systemName?: string;
    color?: string;
    destination?: string;
    target?: string;
    size?: number;
  };
};

const serializedLayout = (entregasDoDiaWidget as unknown as { layout: string }).layout;

function renderWidget(
  props: unknown,
  widgetFamily: 'systemSmall' | 'systemMedium' | 'systemLarge' = 'systemMedium',
  colorScheme: 'light' | 'dark' = 'light',
  deliveryActionsAvailable = false,
  widgetsDirectory: string | null = 'file:///group/ExpoWidgets',
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
      deliveryActionsAvailable,
      widgetFamily,
      colorScheme,
      widgetsDirectory,
    },
    _jsx: jsx,
    _jsxs: jsx,
    VStack: 'VStack',
    Button: 'Button',
    HStack: 'HStack',
    Image: 'Image',
    Link: 'Link',
    Spacer: 'Spacer',
    Text: 'Text',
    containerBackground: modifier('containerBackground'),
    background: modifier('background'),
    buttonStyle: modifier('buttonStyle'),
    frame: modifier('frame'),
    font: modifier('font'),
    foregroundStyle: modifier('foregroundStyle'),
    layoutPriority: modifier('layoutPriority'),
    lineLimit: modifier('lineLimit'),
    minimumScaleFactor: modifier('minimumScaleFactor'),
    monospacedDigit: modifier('monospacedDigit'),
    allowsTightening: modifier('allowsTightening'),
    offset: modifier('offset'),
    padding: modifier('padding'),
    resizable: modifier('resizable'),
    shapes: {
      roundedRectangle: (args: unknown) => ({ name: 'roundedRectangle', args }),
    },
    widgetURL: modifier('widgetURL'),
  });
}

function collectNodes(node: unknown, type?: string): TreeNode[] {
  if (Array.isArray(node)) return node.flatMap((child) => collectNodes(child, type));
  if (!node || typeof node !== 'object') return [];
  const element = node as TreeNode;
  return [
    ...(type === undefined || element.type === type ? [element] : []),
    ...collectNodes(element.props?.children, type),
  ];
}

function collectText(node: unknown): string[] {
  const collectStrings = (value: unknown): string[] => {
    if (typeof value === 'string') return [value];
    if (typeof value === 'number') return [String(value)];
    if (Array.isArray(value)) return value.flatMap(collectStrings);
    return [];
  };
  return collectNodes(node, 'Text').flatMap((element) => collectStrings(element.props?.children));
}

const deliveries = [
  {
    id: 'delivery-a',
    clientName: 'Cliente A',
    quantityLabel: '1 balde',
    valueLabel: 'R$ 30,00',
    completionURL: 'pareact://historico/entrega/delivery-a?date=2026-10-15',
  },
  {
    id: 'delivery-b',
    clientName: 'Cliente B',
    quantityLabel: '2 baldes',
    valueLabel: 'R$ 60,00',
    completionURL: 'pareact://historico/entrega/delivery-b?date=2026-10-15',
  },
  {
    id: 'delivery-c',
    clientName: 'Cliente C',
    quantityLabel: '3 baldes',
    valueLabel: 'R$ 90,00',
    completionURL: 'pareact://historico/entrega/delivery-c?date=2026-10-15',
  },
  {
    id: 'delivery-d',
    clientName: 'Cliente D',
    quantityLabel: '4 baldes',
    valueLabel: 'R$ 120,00',
    completionURL: 'pareact://historico/entrega/delivery-d?date=2026-10-15',
  },
];

const largeDeliveries = [
  ...deliveries,
  { ...deliveries[0]!, id: 'delivery-e', clientName: 'Cliente E' },
  { ...deliveries[0]!, id: 'delivery-f', clientName: 'Cliente F' },
  { ...deliveries[0]!, id: 'delivery-g', clientName: 'Cliente G' },
  { ...deliveries[0]!, id: 'delivery-h', clientName: 'Cliente H' },
  { ...deliveries[0]!, id: 'delivery-i', clientName: 'Cliente I' },
  { ...deliveries[0]!, id: 'delivery-j', clientName: 'Cliente J' },
];

describe('EntregasDoDia isolated widget layout', () => {
  it('registers large only for EntregasDoDia in the active Expo widget configuration', () => {
    type ConfiguredWidget = {
      name: string;
      ios?: { supportedFamilies?: string[] };
    };
    const appConfig = createRequire(__filename)(resolve(__dirname, '../../app.config.js')) as {
      expo: { plugins: unknown[] };
    };
    const widgetsPlugin = appConfig.expo.plugins.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-widgets',
    ) as [string, { widgets: ConfiguredWidget[] }] | undefined;
    const configuredWidgets = widgetsPlugin?.[1].widgets ?? [];
    const deliveriesConfig = configuredWidgets.find(({ name }) => name === 'EntregasDoDia');
    const financeConfig = configuredWidgets.find(({ name }) => name === 'ResumoFinanceiro');

    expect(deliveriesConfig?.ios?.supportedFamilies).toEqual([
      'systemSmall',
      'systemMedium',
      'systemLarge',
    ]);
    expect(financeConfig?.ios?.supportedFamilies).toEqual(['systemSmall', 'systemMedium']);
  });

  it('renders the compact medium list with at most three deliveries and the tap destination', () => {
    const tree = renderWidget({
      date: '2026-10-15',
      state: 'pending',
      deliveryCount: 4,
      deliveries,
      deliveryRouteURL: 'pareact://historico?mode=wholesale',
    }) as TreeNode;

    expect(collectText(tree)).toEqual([
      'Empório Rigatti',
      '•',
      'Entregas',
      'Cliente A',
      '·',
      '1 balde',
      'R$ 30,00',
      'Cliente B',
      '·',
      '2 baldes',
      'R$ 60,00',
      'Cliente C',
      '·',
      '3 baldes',
      'R$ 90,00',
    ]);
    expect(collectNodes(tree, 'Image').some(({ props }) => props?.uiImage)).toBe(true);
    expect(collectNodes(tree, 'Link').map(({ props }) => props?.destination)).toEqual([
      'pareact://historico/entrega/delivery-a?date=2026-10-15',
      'pareact://historico/entrega/delivery-b?date=2026-10-15',
      'pareact://historico/entrega/delivery-c?date=2026-10-15',
    ]);
    expect(tree.props?.modifiers?.find(({ name }) => name === 'widgetURL')?.args).toEqual([
      'pareact://historico?mode=wholesale',
    ]);
    expect(
      collectNodes(tree).some(({ type }) => ['Button', 'Toggle', 'CheckBox'].includes(type)),
    ).toBe(false);
  });

  it('renders at most three small rows without money and links each circle by stable ID', () => {
    const tree = renderWidget(
      {
        date: '2026-10-15',
        state: 'pending',
        deliveryCount: 4,
        deliveries,
      },
      'systemSmall',
    );
    const text = collectText(tree);

    expect(text).toEqual([
      'Empório Rigatti',
      'Cliente A',
      '·',
      '1',
      'Cliente B',
      '·',
      '2',
      'Cliente C',
      '·',
      '3',
    ]);
    expect(text.some((value) => value.startsWith('R$'))).toBe(false);
    const smallRows = collectNodes(tree, 'HStack').filter((node) => {
      const children = node.props?.children;
      return (
        Array.isArray(children) &&
        children.some(
          (child) =>
            child &&
            typeof child === 'object' &&
            'type' in child &&
            ['Button', 'Link'].includes((child as TreeNode).type),
        )
      );
    });
    expect(smallRows).toHaveLength(3);
    const firstDeliveryText = collectNodes(smallRows[0], 'Text').find(
      ({ props }) => props?.children === 'Cliente A',
    );
    expect(
      firstDeliveryText?.props?.modifiers?.find(({ name }) => name === 'font')?.args?.[0],
    ).toEqual({ weight: 'semibold', size: 15 });
    const firstQuantity = collectNodes(smallRows[0], 'Text').find(
      ({ props }) => props?.children === '1',
    );
    const firstSeparator = collectNodes(smallRows[0], 'Text').find(
      ({ props }) => props?.children === '·',
    );
    expect(firstQuantity?.props?.modifiers?.find(({ name }) => name === 'font')?.args?.[0]).toEqual(
      { weight: 'medium', size: 14 },
    );
    expect(firstQuantity?.props?.modifiers?.find(({ name }) => name === 'lineLimit')?.args).toEqual(
      [1],
    );
    expect(
      firstQuantity?.props?.modifiers?.find(({ name }) => name === 'foregroundStyle')?.args?.[0],
    ).toEqual({ type: 'hierarchical', style: 'secondary' });
    expect(
      firstSeparator?.props?.modifiers?.find(({ name }) => name === 'foregroundStyle')?.args?.[0],
    ).toEqual({ type: 'hierarchical', style: 'secondary' });
    expect(
      firstDeliveryText?.props?.modifiers?.find(({ name }) => name === 'lineLimit')?.args,
    ).toEqual([1]);
    expect(collectNodes(tree, 'Link').map(({ props }) => props?.destination)).toEqual([
      'pareact://historico/entrega/delivery-a?date=2026-10-15',
      'pareact://historico/entrega/delivery-b?date=2026-10-15',
      'pareact://historico/entrega/delivery-c?date=2026-10-15',
    ]);
    for (const link of collectNodes(tree, 'Link')) {
      expect(link.props?.modifiers?.find(({ name }) => name === 'frame')?.args?.[0]).toEqual({
        width: 34,
        height: 34,
      });
      expect(collectNodes(link, 'Image')[0]?.props?.size).toBe(20);
    }
    expect(
      collectNodes(tree).some(({ props }) =>
        props?.modifiers?.some(({ name }) => name === 'background'),
      ),
    ).toBe(false);
  });

  it('shows compact numeric quantities with uniform typography and single-line truncation in small', () => {
    const longName = 'Cliente com um nome muito longo para o widget pequeno';
    const smallRows = [
      { ...deliveries[0]!, clientName: 'Teste', quantityLabel: '1 balde' },
      { ...deliveries[1]!, clientName: longName, quantityLabel: '12 baldes' },
      { ...deliveries[2]!, clientName: 'Cliente C', quantityLabel: '123 baldes' },
    ];
    const tree = renderWidget(
      {
        date: '2026-10-15',
        state: 'pending',
        deliveryCount: 3,
        deliveries: smallRows,
      },
      'systemSmall',
      'dark',
    ) as TreeNode;
    const children = tree.props?.children as TreeNode[];
    const header = children[0]!;
    const list = children[1]!;
    const title = collectNodes(header, 'Text')[0]!;
    const rows = collectNodes(list, 'HStack').filter((node) => {
      const rowChildren = node.props?.children as TreeNode[];
      return rowChildren?.[0]?.type === 'Link' || rowChildren?.[0]?.type === 'Button';
    });

    expect(title.props?.modifiers).toContainEqual({
      name: 'font',
      args: [{ weight: 'semibold', size: 13 }],
    });
    expect(header.props?.modifiers).toContainEqual({ name: 'offset', args: [{ y: -2 }] });
    expect(list.props?.modifiers).toContainEqual({ name: 'offset', args: [{ x: -4 }] });
    expect(list.props?.spacing).toBe(0);
    expect(rows).toHaveLength(3);
    expect(collectText(list)).toEqual([
      'Teste',
      '·',
      '1',
      longName,
      '·',
      '12',
      'Cliente C',
      '·',
      '123',
    ]);

    for (const [index, row] of rows.entries()) {
      const rowTexts = collectNodes(row, 'Text');
      const client = rowTexts.find(({ props }) => typeof props?.children === 'string')!;
      const quantity = rowTexts.find(({ props }) => props?.children === ['1', '12', '123'][index])!;

      expect(client.props?.children).toBe(smallRows[index]?.clientName);
      expect(client.props?.modifiers).toContainEqual({
        name: 'font',
        args: [{ weight: 'semibold', size: 15 }],
      });
      expect(quantity.props?.modifiers).toContainEqual({
        name: 'font',
        args: [{ weight: 'medium', size: 14 }],
      });
      for (const textNode of [client, quantity]) {
        expect(textNode.props?.modifiers).toContainEqual({ name: 'lineLimit', args: [1] });
        expect(textNode.props?.modifiers).not.toContainEqual(
          expect.objectContaining({ name: 'minimumScaleFactor' }),
        );
        expect(textNode.props?.modifiers).not.toContainEqual(
          expect.objectContaining({ name: 'allowsTightening' }),
        );
      }
      expect(quantity.props?.modifiers).toContainEqual({ name: 'layoutPriority', args: [1] });
    }
    expect(smallRows.map(({ quantityLabel }) => quantityLabel)).toEqual([
      '1 balde',
      '12 baldes',
      '123 baldes',
    ]);
  });

  it.each(['systemMedium', 'systemLarge'] as const)(
    'preserves delivery typography and scaling behavior in %s',
    (widgetFamily) => {
      const tree = renderWidget(
        {
          date: '2026-10-15',
          state: 'pending',
          deliveryCount: 1,
          deliveries: [deliveries[0]!],
        },
        widgetFamily,
      );
      const list = (tree.props?.children as TreeNode[])[1]!;
      const row = collectNodes(list, 'HStack').find((node) => {
        const rowChildren = node.props?.children as TreeNode[];
        return rowChildren?.[0]?.type === 'Link' || rowChildren?.[0]?.type === 'Button';
      })!;
      const rowTexts = collectNodes(row, 'Text');
      const client = rowTexts.find(({ props }) => props?.children === 'Cliente A')!;
      const quantity = rowTexts.find(({ props }) => props?.children === '1 balde')!;

      expect(client.props?.modifiers).toContainEqual({
        name: 'font',
        args: [{ weight: 'medium', size: 15 }],
      });
      expect(quantity.props?.modifiers).toContainEqual({
        name: 'font',
        args: [{ weight: 'medium', size: 14 }],
      });
      for (const textNode of [client, quantity]) {
        expect(textNode.props?.modifiers).toContainEqual({
          name: 'minimumScaleFactor',
          args: [0.68],
        });
        expect(textNode.props?.modifiers).toContainEqual({
          name: 'allowsTightening',
          args: [true],
        });
      }
    },
  );

  it.each(['systemSmall', 'systemMedium', 'systemLarge'] as const)(
    'uses the explicit #0A0A0A widget background in dark mode for %s',
    (widgetFamily) => {
      const tree = renderWidget(
        { date: '2026-10-15', state: 'empty', deliveryCount: 0, deliveries: [] },
        widgetFamily,
        'dark',
      ) as TreeNode;
      const background = tree.props?.modifiers?.find(({ name }) => name === 'containerBackground');

      expect(background?.args).toEqual(['#0A0A0A', 'widget']);
    },
  );

  it('moves only medium delivery details left while preserving the value trailing inset', () => {
    const tree = renderWidget(
      {
        date: '2026-10-15',
        state: 'pending',
        deliveryCount: 1,
        deliveries: deliveries.slice(0, 1),
      },
      'systemMedium',
    ) as TreeNode;
    const children = tree.props?.children as TreeNode[];
    const list = children[1];
    const row = collectNodes(list, 'HStack')[0];
    const rowChildren = row?.props?.children as TreeNode[];

    expect(list?.props?.modifiers).toContainEqual({
      name: 'padding',
      args: [{ leading: 12, trailing: 16 }],
    });
    expect(rowChildren.map(({ type }) => type)).toEqual(['Link', 'HStack', 'Spacer', 'Text']);
    expect(rowChildren[2]?.props?.minLength).toBe(4);
    expect(
      rowChildren[3]?.props?.modifiers?.find(({ name }) => name === 'font')?.args?.[0],
    ).toEqual({ weight: 'semibold', size: 12 });
    const rowTexts = collectNodes(rowChildren[1], 'Text');
    const client = rowTexts.find(({ props }) => props?.children === 'Cliente A')!;
    const quantity = rowTexts.find(({ props }) => props?.children === '1 balde')!;
    expect(client?.props?.children).toBe('Cliente A');
    expect(quantity?.props?.children).toBe('1 balde');
    expect(quantity?.props?.modifiers?.find(({ name }) => name === 'font')?.args?.[0]).toEqual({
      weight: 'medium',
      size: 14,
    });
    expect(
      quantity?.props?.modifiers?.find(({ name }) => name === 'foregroundStyle')?.args?.[0],
    ).toEqual({ type: 'hierarchical', style: 'secondary' });
  });

  it.each([
    ['systemSmall', 22],
    ['systemMedium', 32],
    ['systemLarge', 32],
  ] as const)('uses the canonical brand mark in the %s header', (widgetFamily, size) => {
    for (const [colorScheme, fileName] of [
      ['light', 'resumo-financeiro-mark-light.png'],
      ['dark', 'resumo-financeiro-mark-dark.png'],
    ] as const) {
      const logo = collectNodes(
        renderWidget(
          { date: '2026-10-15', state: 'empty', deliveries: [] },
          widgetFamily,
          colorScheme,
        ),
        'Image',
      ).find(({ props }) => props?.uiImage);

      expect(logo?.props?.uiImage).toBe(`file:///group/ExpoWidgets/${fileName}`);
      expect(logo?.props?.modifiers?.find(({ name }) => name === 'frame')?.args?.[0]).toEqual({
        width: size,
        height: size,
      });
    }
  });

  it.each([
    ['systemSmall', 22],
    ['systemMedium', 32],
    ['systemLarge', 32],
  ] as const)(
    'reserves the logo frame when the App Group directory is unavailable in %s',
    (widgetFamily, size) => {
      const tree = renderWidget(
        { date: '2026-10-15', state: 'empty', deliveries: [] },
        widgetFamily,
        'dark',
        false,
        null,
      );

      expect(collectNodes(tree, 'Image').some(({ props }) => props?.uiImage)).toBe(false);
      expect(
        collectNodes(tree, 'Spacer').some(({ props }) =>
          props?.modifiers?.some(
            ({ name, args }) =>
              name === 'frame' &&
              (args?.[0] as { width?: number; height?: number } | undefined)?.width === size &&
              (args?.[0] as { width?: number; height?: number } | undefined)?.height === size,
          ),
        ),
      ).toBe(true);
    },
  );

  it('anchors the medium header and keeps a non-overlapping first row for zero to three deliveries', () => {
    const logoHeight = 32;
    const previousHeaderTop = 6;
    const previousRootSpacing = 10;
    const proposedHeaderTop = 10;
    const proposedRootSpacing = 2;
    const previousFirstRowTop = logoHeight + previousHeaderTop + previousRootSpacing;
    const proposedFirstRowTop = logoHeight + proposedHeaderTop + proposedRootSpacing;

    expect(proposedHeaderTop - previousHeaderTop).toBe(4);
    expect(proposedFirstRowTop - previousFirstRowTop).toBe(-4);
    expect(
      logoHeight + proposedHeaderTop + proposedRootSpacing - (logoHeight + proposedHeaderTop),
    ).toBe(2);

    for (const rows of [[], [deliveries[0]!], deliveries.slice(0, 2), deliveries.slice(0, 3)]) {
      const tree = renderWidget(
        {
          date: '2026-10-15',
          state: rows.length === 0 ? 'empty' : 'pending',
          deliveryCount: rows.length,
          deliveries: rows,
        },
        'systemMedium',
      ) as TreeNode;
      const children = tree.props?.children;

      expect(Array.isArray(children)).toBe(true);
      expect((children as TreeNode[])[0]?.type).toBe('HStack');
      expect((children as TreeNode[])[1]?.type).toBe('VStack');
      expect((children as TreeNode[])[(children as TreeNode[]).length - 1]?.type).toBe('Spacer');
      expect(collectText((children as TreeNode[])[0])).toEqual([
        'Empório Rigatti',
        '•',
        'Entregas',
      ]);
      expect((children as TreeNode[])[0]?.props?.modifiers).toContainEqual({
        name: 'padding',
        args: [{ top: 10, leading: 22, trailing: 16 }],
      });
      expect(tree.props?.spacing).toBe(2);
      expect(tree.props?.modifiers).toContainEqual({
        name: 'frame',
        args: [{ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }],
      });
      expect(((children as TreeNode[])[1] as TreeNode).props?.spacing).toBe(4);
      expect(collectNodes((children as TreeNode[])[0], 'Image').length).toBe(1);
      expect(
        collectNodes((children as TreeNode[])[0], 'Image')[0]?.props?.modifiers?.find(
          ({ name }) => name === 'frame',
        )?.args?.[0],
      ).toEqual({ width: 32, height: 32 });
      const visibleRows = collectNodes((children as TreeNode[])[1], 'HStack').filter((node) => {
        const rowChildren = node.props?.children as TreeNode[];
        return rowChildren?.[0]?.type === 'Link' || rowChildren?.[0]?.type === 'Button';
      });
      expect(visibleRows).toHaveLength(rows.length);
      expect(
        collectNodes(tree).some(({ props }) =>
          props?.modifiers?.some(({ name }) => name === 'background'),
        ),
      ).toBe(false);
    }
  });

  it.each([
    ['systemSmall', 2, { horizontal: 2 }],
    ['systemLarge', 6, { top: 2, leading: 22, trailing: 16 }],
  ] as const)(
    'does not apply medium geometry changes to %s',
    (widgetFamily, spacing, headerPadding) => {
      const tree = renderWidget(
        { date: '2026-10-15', state: 'empty', deliveryCount: 0, deliveries: [] },
        widgetFamily,
      ) as TreeNode;
      const header = (tree.props?.children as TreeNode[])[0]!;

      expect(tree.props?.spacing).toBe(spacing);
      expect(tree.props?.modifiers?.some(({ name }) => name === 'frame')).toBe(false);
      expect(header.props?.modifiers).toContainEqual({ name: 'padding', args: [headerPadding] });
    },
  );

  it.each(['systemSmall', 'systemMedium'] as const)(
    'uses one native AppIntent control per visible delivery in %s without creating a Link',
    (widgetFamily) => {
      const tree = renderWidget(
        {
          date: '2026-10-15',
          state: 'pending',
          deliveryCount: 4,
          deliveries: [{ ...deliveries[0]!, id: 'delivery/a' }, ...deliveries.slice(1)],
          deliveryRouteURL: 'pareact://historico?mode=wholesale',
        },
        widgetFamily,
        'light',
        true,
      );
      const buttons = collectNodes(tree, 'Button');
      const visibleCount = 3;
      const touchTargetSize = 34;

      expect(buttons).toHaveLength(visibleCount);
      expect(collectNodes(tree, 'Link')).toHaveLength(0);
      expect(buttons[0]?.props?.target).toBe('rigatti-delivery-complete:2026-10-15:delivery%2Fa');
      for (const button of buttons) {
        expect(button.props?.modifiers?.find(({ name }) => name === 'frame')?.args?.[0]).toEqual({
          width: touchTargetSize,
          height: touchTargetSize,
        });
        expect(collectNodes(button, 'Image')[0]?.props?.size).toBe(20);
      }
      expect(
        buttons.every(({ props }) =>
          props?.modifiers?.some(
            (modifier) => modifier.name === 'buttonStyle' && modifier.args?.[0] === 'plain',
          ),
        ),
      ).toBe(true);
      expect(
        tree.props?.modifiers?.find((modifier: { name: string }) => modifier.name === 'widgetURL')
          ?.args,
      ).toEqual(['pareact://historico?mode=wholesale']);
    },
  );

  it('shows a filled check immediately and suppresses duplicate taps while an action is pending', () => {
    const tree = renderWidget(
      {
        date: '2026-10-15',
        state: 'pending',
        deliveryCount: 1,
        deliveries: [
          { ...deliveries[0]!, completionState: 'pending', completionActionId: 'action-1' },
        ],
      },
      'systemMedium',
      'light',
      true,
    );

    expect(collectNodes(tree, 'Button')).toHaveLength(0);
    expect(collectNodes(tree, 'Image').map(({ props }) => props?.systemName)).toContain(
      'checkmark.circle.fill',
    );
    const check = collectNodes(tree, 'Image').find(
      ({ props }) => props?.systemName === 'checkmark.circle.fill',
    );
    expect(check?.props?.color).toBe('#FF9F0A');
    expect(check?.props?.size).toBe(20);
    expect(check?.props?.modifiers?.find(({ name }) => name === 'frame')?.args?.[0]).toEqual({
      width: 34,
      height: 34,
    });
  });

  it('shows an error symbol and keeps a failed completion retryable', () => {
    const tree = renderWidget(
      {
        date: '2026-10-15',
        state: 'pending',
        deliveryCount: 1,
        deliveries: [{ ...deliveries[0]!, completionState: 'failed' }],
      },
      'systemMedium',
      'light',
      true,
    );

    expect(collectNodes(tree, 'Button')).toHaveLength(1);
    expect(collectNodes(tree, 'Button')[0]?.props?.target).toBe(
      'rigatti-delivery-complete:2026-10-15:delivery-a',
    );
    const errorIcon = collectNodes(tree, 'Image').find(
      ({ props }) => props?.systemName === 'exclamationmark.circle.fill',
    );
    expect(errorIcon?.props?.color).toBe('#FF3B30');
  });

  it.each(['light', 'dark'] as const)(
    'renders eight large rows in source order in %s mode and leaves later data hidden',
    (colorScheme) => {
      const tree = renderWidget(
        {
          date: '2026-10-15',
          state: 'pending',
          deliveryCount: largeDeliveries.length,
          deliveries: largeDeliveries,
        },
        'systemLarge',
        colorScheme,
        true,
      );
      const visibleClientNames = collectText(tree).filter((value) => /^Cliente [A-J]$/.test(value));

      expect(collectText(tree).slice(0, 3)).toEqual(['Empório Rigatti', '•', 'Entregas']);
      expect(visibleClientNames).toEqual([
        'Cliente A',
        'Cliente B',
        'Cliente C',
        'Cliente D',
        'Cliente E',
        'Cliente F',
        'Cliente G',
        'Cliente H',
      ]);
      expect(visibleClientNames).not.toContain('Cliente I');
      expect(visibleClientNames).not.toContain('Cliente J');
      expect(collectNodes(tree, 'Button')).toHaveLength(8);
      expect(collectNodes(tree, 'Link')).toHaveLength(0);
      expect(collectText(tree).some((value) => /^\+\d/.test(value))).toBe(false);
      const header = (tree.props?.children as TreeNode[])[0]!;
      const titleGroup = (header.props?.children as TreeNode[])[0]!;
      const logo = collectNodes(header, 'Image').find(({ props }) => props?.uiImage)!;
      expect(header.props?.modifiers).toContainEqual({
        name: 'padding',
        args: [{ top: 2, leading: 22, trailing: 16 }],
      });
      expect(titleGroup.props?.modifiers).toContainEqual({
        name: 'offset',
        args: [{ x: -4 }],
      });
      expect(logo.props?.modifiers?.some(({ name }) => name === 'offset')).toBe(false);
    },
  );

  it('shows only available large rows when fewer than eight are pending', () => {
    const visibleRows = largeDeliveries.slice(0, 5);
    const tree = renderWidget(
      {
        date: '2026-10-15',
        state: 'pending',
        deliveryCount: visibleRows.length,
        deliveries: visibleRows,
      },
      'systemLarge',
      'light',
      true,
    );

    expect(collectText(tree).filter((value) => /^Cliente [A-J]$/.test(value))).toEqual([
      'Cliente A',
      'Cliente B',
      'Cliente C',
      'Cliente D',
      'Cliente E',
    ]);
    expect(collectNodes(tree, 'Button')).toHaveLength(5);
    expect(collectText(tree).some((value) => /^\+\d/.test(value))).toBe(false);
  });

  it('compacts vertical spacing only for large without reducing text or touch target sizes', () => {
    const tree = renderWidget(
      {
        date: '2026-10-15',
        state: 'pending',
        deliveryCount: largeDeliveries.length,
        deliveries: largeDeliveries,
      },
      'systemLarge',
      'dark',
      true,
    ) as TreeNode;
    const children = tree.props?.children as TreeNode[];
    const list = children[1] as TreeNode;
    const buttons = collectNodes(tree, 'Button');
    const clientTextNodes = collectNodes(tree, 'Text').filter((node) =>
      String(node.props?.children).startsWith('Cliente '),
    );

    expect(tree.props?.spacing).toBe(6);
    expect(list.props?.spacing).toBe(2);
    expect(buttons).toHaveLength(8);
    expect(
      buttons.every((button) =>
        button.props?.modifiers?.some(
          (modifier) =>
            modifier.name === 'frame' &&
            (modifier.args?.[0] as { width?: number; height?: number } | undefined)?.width === 34 &&
            (modifier.args?.[0] as { width?: number; height?: number } | undefined)?.height === 34,
        ),
      ),
    ).toBe(true);
    expect(collectNodes(tree, 'Image').filter(({ props }) => props?.size === 20)).toHaveLength(8);
    expect(clientTextNodes).toHaveLength(8);
    expect(
      clientTextNodes.every((node) =>
        node.props?.modifiers?.some(
          (modifier) =>
            modifier.name === 'font' &&
            (modifier.args?.[0] as { size?: number } | undefined)?.size === 15,
        ),
      ),
    ).toBe(true);
    const quantityNodes = collectNodes(list, 'Text').filter(({ props }) =>
      /baldes?$/.test(String(props?.children)),
    );
    expect(quantityNodes).toHaveLength(8);
    expect(
      quantityNodes.every((node) =>
        node.props?.modifiers?.some(
          (modifier) =>
            modifier.name === 'foregroundStyle' &&
            JSON.stringify(modifier.args?.[0]) ===
              JSON.stringify({ type: 'hierarchical', style: 'secondary' }),
        ),
      ),
    ).toBe(true);
  });

  it.each([
    ['systemSmall', 3],
    ['systemMedium', 3],
    ['systemLarge', 8],
  ] as const)(
    'keeps native completion controls in %s for every visible row',
    (widgetFamily, visibleLimit) => {
      const sourceRows = widgetFamily === 'systemLarge' ? largeDeliveries : deliveries;
      const tree = renderWidget(
        {
          date: '2026-10-15',
          state: 'pending',
          deliveryCount: sourceRows.length,
          deliveries: sourceRows,
        },
        widgetFamily,
        'light',
        true,
      );

      expect(collectNodes(tree, 'Button')).toHaveLength(visibleLimit);
      expect(collectNodes(tree, 'Button').map(({ props }) => props?.target)).toEqual(
        sourceRows
          .slice(0, visibleLimit)
          .map(({ id }) => `rigatti-delivery-complete:2026-10-15:${encodeURIComponent(id)}`),
      );
      expect(collectNodes(tree, 'Link')).toHaveLength(0);
    },
  );

  it.each([
    ['all_completed', 'Todas as entregas concluídas'],
    ['empty', 'Nenhuma entrega hoje'],
    ['unavailable', 'Dados de hoje indisponíveis'],
  ] as const)('keeps the %s state in systemLarge', (state, message) => {
    expect(
      collectText(
        renderWidget(
          { date: '2026-10-15', state, deliveryCount: 0, deliveries: [] },
          'systemLarge',
        ),
      ),
    ).toContain(message);
  });

  it('does not turn an unknown iOS action environment into an app-opening link', () => {
    const layout = runInNewContext(`(${serializedLayout})(props, environment)`, {
      props: {
        date: '2026-10-15',
        state: 'pending',
        deliveryCount: 1,
        deliveries: [deliveries[0]],
        deliveryRouteURL: 'pareact://historico?mode=wholesale',
      },
      environment: { widgetFamily: 'systemMedium', widgetsDirectory: 'file:///group/ExpoWidgets' },
      _jsx: (type: string, props: Record<string, unknown>) => ({ type, props }),
      _jsxs: (type: string, props: Record<string, unknown>) => ({ type, props }),
      VStack: 'VStack',
      HStack: 'HStack',
      Image: 'Image',
      Link: 'Link',
      Button: 'Button',
      Spacer: 'Spacer',
      Text: 'Text',
      containerBackground: () => ({}),
      background: () => ({}),
      buttonStyle: () => ({}),
      frame: () => ({}),
      font: () => ({}),
      foregroundStyle: () => ({}),
      layoutPriority: () => ({}),
      lineLimit: () => ({}),
      minimumScaleFactor: () => ({}),
      monospacedDigit: () => ({}),
      allowsTightening: () => ({}),
      offset: () => ({}),
      padding: () => ({}),
      resizable: () => ({}),
      shapes: { roundedRectangle: () => ({}) },
      widgetURL: () => ({}),
    });

    expect(collectNodes(layout, 'Link')).toHaveLength(0);
    expect(collectNodes(layout, 'Button')).toHaveLength(0);
  });

  it('distinguishes an empty complete day from an unavailable snapshot', () => {
    const empty = collectText(
      renderWidget({
        date: '2026-10-15',
        state: 'empty',
        deliveryCount: 0,
        deliveries: [],
      }),
    );
    const unavailable = collectText(
      renderWidget({
        date: '2026-10-15',
        state: 'unavailable',
        deliveryCount: 0,
        deliveries: [],
      }),
    );

    expect(empty).toContain('Nenhuma entrega hoje');
    expect(unavailable).toContain('Dados de hoje indisponíveis');

    expect(
      collectText(
        renderWidget({
          date: '2026-10-15',
          state: 'all_completed',
          deliveryCount: 0,
          deliveries: [],
        }),
      ),
    ).toContain('Todas as entregas concluídas');
  });

  it('treats partial or structurally inconsistent snapshot props as unavailable', () => {
    const text = collectText(
      renderWidget({
        date: '2026-10-15',
        state: 'pending',
        deliveryCount: 2,
        deliveries: [{ id: 'delivery-a', clientName: 'Cliente A', quantityLabel: '1 balde' }],
      }),
    );

    expect(text).toContain('Dados de hoje indisponíveis');
    expect(text).not.toContain('Cliente A');
    expect(text).not.toContain('+2');
  });

  it('renders safely with missing props and uses the dark shared brand asset', () => {
    expect(() => renderWidget({}, 'systemMedium', 'dark')).not.toThrow();
    const tree = renderWidget({}, 'systemMedium', 'dark');
    expect(collectText(tree)).toContain('Dados de hoje indisponíveis');
    expect(collectNodes(tree, 'Image')[0]?.props?.uiImage).toBe(
      'file:///group/ExpoWidgets/resumo-financeiro-mark-dark.png',
    );
  });

  it.each(['light', 'dark'] as const)(
    'keeps the delivery list on the widget surface in %s mode',
    (colorScheme) => {
      const tree = renderWidget(
        {
          date: '2026-10-15',
          state: 'pending',
          deliveryCount: 1,
          deliveries: deliveries.slice(0, 1),
        },
        'systemMedium',
        colorScheme,
      );

      expect(collectText(tree)).toContain('Cliente A');
      expect(
        collectNodes(tree).some(({ props }) =>
          props?.modifiers?.some(({ name }) => name === 'background'),
        ),
      ).toBe(false);
    },
  );
});
