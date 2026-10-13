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
    children?: unknown;
    modifiers?: { args?: unknown[]; name: string }[];
    uiImage?: string;
    destination?: string;
    target?: string;
  };
};

const serializedLayout = (entregasDoDiaWidget as unknown as { layout: string }).layout;

function renderWidget(
  props: unknown,
  widgetFamily: 'systemSmall' | 'systemMedium' = 'systemMedium',
  colorScheme: 'light' | 'dark' = 'light',
  deliveryActionsAvailable = false,
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
      widgetsDirectory: 'file:///group/ExpoWidgets',
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
    lineLimit: modifier('lineLimit'),
    minimumScaleFactor: modifier('minimumScaleFactor'),
    monospacedDigit: modifier('monospacedDigit'),
    allowsTightening: modifier('allowsTightening'),
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

describe('EntregasDoDia isolated widget layout', () => {
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
      ' · ',
      '1 balde',
      'R$ 30,00',
      'Cliente B',
      ' · ',
      '2 baldes',
      'R$ 60,00',
      'Cliente C',
      ' · ',
      '3 baldes',
      'R$ 90,00',
      '+',
      '1',
      ' entregas',
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

  it('renders at most two small rows without money and links each circle by stable ID', () => {
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
      'Entregas de hoje',
      'Cliente A',
      '1 balde',
      'Cliente B',
      '2 baldes',
      '+',
      '2',
      ' entregas',
    ]);
    expect(text.some((value) => value.startsWith('R$'))).toBe(false);
    expect(collectNodes(tree, 'Link').map(({ props }) => props?.destination)).toEqual([
      'pareact://historico/entrega/delivery-a?date=2026-10-15',
      'pareact://historico/entrega/delivery-b?date=2026-10-15',
    ]);
  });

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
      const visibleCount = widgetFamily === 'systemSmall' ? 2 : 3;

      expect(buttons).toHaveLength(visibleCount);
      expect(collectNodes(tree, 'Link')).toHaveLength(0);
      expect(buttons[0]?.props?.target).toBe('rigatti-delivery-complete:2026-10-15:delivery%2Fa');
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
      lineLimit: () => ({}),
      minimumScaleFactor: () => ({}),
      monospacedDigit: () => ({}),
      allowsTightening: () => ({}),
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

  it.each([
    ['light', '#F5F3F1'],
    ['dark', '#2C2C2E'],
  ] as const)('keeps delivery card contrast in %s mode', (colorScheme, expectedBackground) => {
    const card = collectNodes(
      renderWidget(
        {
          date: '2026-10-15',
          state: 'pending',
          deliveryCount: 1,
          deliveries: deliveries.slice(0, 1),
        },
        'systemMedium',
        colorScheme,
      ),
      'VStack',
    ).find(({ props }) => props?.modifiers?.some(({ name }) => name === 'background'));

    expect(card?.props?.modifiers?.find(({ name }) => name === 'background')?.args?.[0]).toBe(
      expectedBackground,
    );
  });
});
