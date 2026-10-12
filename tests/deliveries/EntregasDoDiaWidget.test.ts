import { runInNewContext } from 'node:vm';

import { entregasDoDiaWidget } from '@/features/deliveries/widgets/EntregasDoDiaWidget';

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

type TreeNode = {
  type: string;
  props?: {
    children?: unknown;
    modifiers?: { args?: unknown[]; name: string }[];
    uiImage?: string;
  };
};

const serializedLayout = (entregasDoDiaWidget as unknown as { layout: string }).layout;

function renderWidget(
  props: unknown,
  widgetFamily: 'systemSmall' | 'systemMedium' = 'systemMedium',
  colorScheme: 'light' | 'dark' = 'light',
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
      widgetFamily,
      colorScheme,
      widgetsDirectory: 'file:///group/ExpoWidgets',
    },
    _jsx: jsx,
    _jsxs: jsx,
    VStack: 'VStack',
    HStack: 'HStack',
    Image: 'Image',
    Spacer: 'Spacer',
    Text: 'Text',
    containerBackground: modifier('containerBackground'),
    background: modifier('background'),
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
  { clientName: 'Cliente A', quantityLabel: '1 balde', valueLabel: 'R$ 30,00' },
  { clientName: 'Cliente B', quantityLabel: '2 baldes', valueLabel: 'R$ 60,00' },
  { clientName: 'Cliente C', quantityLabel: '3 baldes', valueLabel: 'R$ 90,00' },
  { clientName: 'Cliente D', quantityLabel: '4 baldes', valueLabel: 'R$ 120,00' },
];

describe('EntregasDoDia isolated widget layout', () => {
  it('renders the compact medium list with at most three deliveries and the tap destination', () => {
    const tree = renderWidget({
      date: '2026-10-15',
      availability: 'available',
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
    expect(tree.props?.modifiers?.find(({ name }) => name === 'widgetURL')?.args).toEqual([
      'pareact://historico?mode=wholesale',
    ]);
    expect(
      collectNodes(tree).some(({ type }) => ['Button', 'Toggle', 'CheckBox'].includes(type)),
    ).toBe(false);
  });

  it('renders the small family with at most two rows', () => {
    const text = collectText(
      renderWidget(
        {
          date: '2026-10-15',
          availability: 'available',
          deliveryCount: 4,
          deliveries,
        },
        'systemSmall',
      ),
    );

    expect(text).toEqual([
      'Empório Rigatti',
      'Entregas de hoje',
      'Cliente A',
      '1 balde',
      'R$ 30,00',
      'Cliente B',
      '2 baldes',
      'R$ 60,00',
      '+',
      '2',
      ' entregas',
    ]);
  });

  it('distinguishes an empty complete day from an unavailable snapshot', () => {
    const empty = collectText(
      renderWidget({
        date: '2026-10-15',
        availability: 'available',
        deliveryCount: 0,
        deliveries: [],
      }),
    );
    const unavailable = collectText(
      renderWidget({
        date: '2026-10-15',
        availability: 'unavailable',
        deliveryCount: 0,
        deliveries: [],
      }),
    );

    expect(empty).toContain('Nenhuma entrega hoje');
    expect(unavailable).toContain('Dados de hoje indisponíveis');
  });

  it('treats partial or structurally inconsistent snapshot props as unavailable', () => {
    const text = collectText(
      renderWidget({
        date: '2026-10-15',
        availability: 'available',
        deliveryCount: 2,
        deliveries: [{ clientName: 'Cliente A', quantityLabel: '1 balde' }],
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
});
