/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ComponentType, type ReactNode } from 'react';
import { Keyboard, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Delivery } from '@/types/data';

const mockUseDeliveries = jest.fn();
const mockUseClients = jest.fn();
const mockRouterPush = jest.fn();
const mockResolvedMode: { value: 'dark' | 'light' } = { value: 'light' };
const mockRegistrarDeliveryController = {
  clientItems: [] as { bucketPrice: number; id: string; systemImage: string; title: string }[],
  dismissSheet: jest.fn(),
  handleDismiss: jest.fn(),
  handlePageSettled: jest.fn(),
  handleSelect: jest.fn(),
  handleVisibleChange: jest.fn(),
  markRecentlyAddedDeliveryIds: jest.fn(),
  openSelectedClientSheet: jest.fn(),
  openSheet: jest.fn(),
  recentlyAddedDeliveryIds: [] as string[],
  selectedClient: null as { id: string } | null,
  sheetVisible: false,
};

jest.mock('expo-router', () => {
  const React = require('react') as typeof import('react');
  const Toolbar = ({ children }: { children?: ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  const ToolbarMenu = ({ children }: { children?: ReactNode }) =>
    React.createElement('toolbar-menu', null, children);
  const ToolbarMenuAction = ({ children }: { children?: ReactNode }) =>
    React.createElement('toolbar-menu-action', null, children);
  const ToolbarButton = ({
    children,
    ...props
  }: {
    children?: ReactNode;
    [key: string]: unknown;
  }) => React.createElement('toolbar-button', props, children);
  const ToolbarIcon = (props: Record<string, unknown>) =>
    React.createElement('toolbar-icon', props);
  const ToolbarLabel = ({ children }: { children?: ReactNode }) =>
    React.createElement('toolbar-label', null, children);

  return {
    Stack: {
      Toolbar: Object.assign(Toolbar, {
        Button: ToolbarButton,
        Icon: ToolbarIcon,
        Label: ToolbarLabel,
        Menu: ToolbarMenu,
        MenuAction: ToolbarMenuAction,
      }),
    },
    useFocusEffect: jest.fn(),
    useRouter: () => ({ push: mockRouterPush }),
  };
});

jest.mock('@expo/vector-icons/Ionicons', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'animated-view' },
  Easing: { out: jest.fn((value: unknown) => value), quad: 'quad' },
  FadeIn: { duration: jest.fn(() => ({ delay: jest.fn() })) },
  FadeOut: { duration: jest.fn(() => ({ delay: jest.fn() })) },
  LinearTransition: { duration: jest.fn() },
  useAnimatedStyle: jest.fn(() => ({})),
  useDerivedValue: jest.fn(() => ({ value: 0 })),
  withTiming: jest.fn((value: number) => value),
  createAnimatedComponent: (Component: unknown) => Component,
}));

jest.mock('@/components/layout', () => ({
  getNativeLargeTitleStyle: jest.fn(() => ({})),
  NativeGlassHeader: ({ rightActions, title }: { rightActions?: ReactNode; title: ReactNode }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('native-header', { title }, rightActions);
  },
}));

jest.mock('@/components/native', () => ({
  NativeCardContextMenu: ({ children }: { children?: ReactNode }) => children,
  NativeDailyDataSheet: () => null,
  NativeGlassIconButton: () => null,
}));

jest.mock('@/components/premium', () => ({
  AnimatedPressable: ({
    accessibilityHint,
    accessibilityLabel,
    accessibilityRole,
    children,
    containerStyle,
    disablePressAnimation,
    onPress,
  }: {
    accessibilityHint?: string;
    accessibilityLabel?: string;
    accessibilityRole?: string;
    children?: ReactNode;
    containerStyle?: unknown;
    disablePressAnimation?: boolean;
    onPress?: () => void;
  }) => {
    const React = require('react') as typeof import('react');
    return React.createElement(
      'animated-pressable',
      {
        accessibilityHint,
        accessibilityLabel,
        accessibilityRole,
        containerStyle,
        disablePressAnimation,
        onPress,
      },
      children,
    );
  },
  GlassSurface: ({ children, ...props }: { children?: ReactNode; [key: string]: unknown }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('glass-surface', props, children);
  },
  PremiumCard: ({ children, style }: { children?: ReactNode; style?: unknown }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('premium-card', { style }, children);
  },
  PremiumScreen: ({
    children,
    overlayHeader,
  }: {
    children?: ReactNode;
    overlayHeader?: ReactNode;
  }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('premium-screen', null, overlayHeader, children);
  },
  ProgressiveCollapsibleScreen: ({
    compactTitle,
    children,
    largeTitle,
    scrollViewProps,
  }: {
    children?: ReactNode;
    compactTitle?: ReactNode;
    largeTitle?: ReactNode;
    scrollViewProps?: unknown;
  }) => {
    const React = require('react') as typeof import('react');
    return React.createElement(
      'progressive-collapsible-screen',
      { compactTitle, scrollViewProps },
      largeTitle,
      children,
    );
  },
  SearchBar: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('search-bar', props);
  },
}));

jest.mock('@/components/lists', () => ({
  ListItem: ({
    disablePressedBackground,
    leading,
    onPress,
    style,
    title,
    titleColor,
  }: {
    disablePressedBackground?: boolean;
    leading?: ReactNode;
    onPress?: () => void;
    style?: unknown;
    title: string;
    titleColor?: string;
  }) => {
    const React = require('react') as typeof import('react');
    return React.createElement(
      'client-list-item',
      { disablePressedBackground, onPress, style, title, titleColor },
      leading,
    );
  },
}));

jest.mock('@/components/premium/StickyActionFooter', () => ({
  StickyActionFooter: ({
    children,
    contentContainerStyle,
    height,
    keyboardAware,
  }: {
    children?: ReactNode;
    contentContainerStyle?: unknown;
    height?: number;
    keyboardAware?: boolean;
  }) => {
    const React = require('react') as typeof import('react');
    return React.createElement(
      'sticky-action-footer',
      { contentContainerStyle, height, keyboardAware },
      children,
    );
  },
}));

jest.mock('@/features/retail-orders/components/RetailOrderPrimaryButton', () => ({
  RetailOrderPrimaryButton: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('retail-primary-button', props);
  },
}));

jest.mock('@/features/deliveries/components/RegistrarDeliverySheet', () => ({
  RegistrarDeliverySheet: () => {
    const React = require('react') as typeof import('react');
    return React.createElement('registrar-delivery-sheet');
  },
}));

jest.mock('@/features/deliveries/hooks/useRegistrarDeliverySheet', () => ({
  useRegistrarDeliverySheet: () => mockRegistrarDeliveryController,
}));

jest.mock('@/features/open-payments/components/OpenPaymentClientIcon', () => ({
  __esModule: true,
  default: ({
    backgroundColor,
    iconColor,
    iconName,
  }: {
    backgroundColor?: string;
    iconColor?: string;
    iconName?: string;
  }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('client-icon', { backgroundColor, iconColor, iconName });
  },
}));

jest.mock('@/features/retail-orders/components/RetailOrderRegistrarScreen', () => ({
  __esModule: true,
  RetailOrderRegistrarLauncher: () => null,
}));

jest.mock('@/hooks/useClients', () => ({ useClients: () => mockUseClients() }));
jest.mock('@/hooks/useDeliveries', () => ({ useDeliveries: mockUseDeliveries }));
jest.mock('@/hooks/useCostSettings', () => ({ useCostSettings: jest.fn() }));
jest.mock('@/providers', () => ({
  useAppMode: () => ({ mode: 'wholesale' }),
  useAppSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));
jest.mock('@/theme', () => ({
  getCardSurfaceColor: () => '#FFFFFF',
  getLiquidGlassTint: () => undefined,
  registrarDeliveryDarkLiquidGlassTint: '#000000',
  useAppTheme: () => ({
    reduceMotionEnabled: false,
    resolvedMode: mockResolvedMode.value,
    theme: {
      animations: { duration: { standard: 200 } },
      colors: {
        background: '#FFFFFF',
        backgroundSecondary: '#F2F2F7',
        borderStrong: '#D1D5DB',
        contrastContent: '#FFFFFF',
        contrastSurface: '#000000',
        selectionContent: '#FFFFFF',
        selectionSurface: '#000000',
        danger: '#FF0000',
        surface: '#FFFFFF',
        textPrimary: '#000000',
        textSecondary: '#666666',
        textInverse: '#FFFFFF',
      },
      layout: { screenHorizontalPadding: 24, tabBarHeight: 0 },
      radius: { card: 20, lg: 16, pill: 999, xl: 24 },
      sizes: { iconMedium: 24, touchTargetMinimum: 44 },
      spacing: { lg: 20, md: 16, sm: 8, xl: 24, xs: 4, xxl: 32, xxs: 2 },
      typography: {
        body: { lineHeight: 20 },
        callout: { lineHeight: 18 },
        footnote: { lineHeight: 14 },
        headline: { fontWeight: '600', lineHeight: 22 },
      },
    },
  }),
}));

jest.mock('@/utils/data', () => ({
  formatCurrency: (value: number) => String(value),
  normalizeMoney: jest.fn(),
  todayIso: () => '2026-09-23',
}));

jest.mock('@/services/data', () => ({
  toHistoryDelivery: (delivery: Delivery) => ({
    ...delivery,
    quantidadeBaldes: delivery.quantidade,
  }),
}));

jest.mock('@/utils/haptics', () => ({
  triggerLightImpactHaptic: jest.fn(),
  triggerSelectionHaptic: jest.fn(),
}));

jest.mock('@/utils/presentation/testModeValues', () => ({
  useTestModePresentation: () => ({
    enabled: false,
    quantity: (value: number, singular = 'balde', plural = 'baldes') =>
      `${value} ${value === 1 ? singular : plural}`,
    text: (value: string) => value,
  }),
}));

const { RegistrarDeliveryScreen } = require('@/app/(tabs)/registrar/index') as {
  RegistrarDeliveryScreen: ComponentType<{
    inlineClientSelection?: boolean;
    showLargeTitle?: boolean;
  }>;
};

function delivery(id: string, quantidade: number): Delivery {
  return {
    cliente: `Cliente ${id}`,
    data: '2026-09-23',
    entregue: false,
    id,
    quantidade,
    status: 'Não Pago',
    valor: 0,
  };
}

function renderScreen(deliveries: Delivery[]): ReactTestRenderer {
  mockUseDeliveries.mockReturnValue({
    allDeliveries: deliveries,
    create: jest.fn(),
    remove: jest.fn(),
  });
  mockUseClients.mockReturnValue({ clients: [] });

  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(createElement(RegistrarDeliveryScreen, { showLargeTitle: true }));
  });
  return renderer;
}

function deliveryTitleHeader(renderer: ReactTestRenderer, title = 'Entregas'): ReactTestInstance {
  const header = renderer.root
    .findAll((node) => String(node.type) === 'native-header')
    .find((node) => node.props.title === title);
  if (!header) throw new Error(`O título ${title} não foi renderizado.`);
  return header;
}

function totalLabel(renderer: ReactTestRenderer, title?: string): string | undefined {
  const label = deliveryTitleHeader(renderer, title).findAllByType(Text)[0];
  return label?.props.children;
}

function clientPressTargets(renderer: ReactTestRenderer): ReactTestInstance[] {
  return renderer.root.findAll(
    (node) =>
      String(node.type) === 'animated-pressable' &&
      node.findAll((child) => String(child.type) === 'client-list-item').length === 1,
  );
}

describe('Registrar Atacado delivery bucket total', () => {
  beforeEach(() => {
    mockResolvedMode.value = 'light';
    jest.requireMock('@/utils/haptics').triggerLightImpactHaptic.mockClear();
    mockUseDeliveries.mockClear();
    mockUseClients.mockReset();
    mockUseClients.mockReturnValue({ clients: [] });
    mockRegistrarDeliveryController.clientItems = [];
    mockRegistrarDeliveryController.selectedClient = null;
    mockRegistrarDeliveryController.handleSelect.mockClear();
    mockRegistrarDeliveryController.openSelectedClientSheet.mockClear();
    mockRouterPush.mockClear();
  });

  it('keeps the title and omits the total when no deliveries are visible', () => {
    const renderer = renderScreen([]);
    const header = deliveryTitleHeader(renderer);

    expect(header.props.title).toBe('Entregas');
    expect(header.findAllByType(Text)).toHaveLength(0);
  });

  it('shows the singular label for a single visible bucket', () => {
    const renderer = renderScreen([delivery('one', 1)]);

    expect(totalLabel(renderer)).toBe('1 balde');
  });

  it('sums quantities from the currently visible deliveries and updates with the list', () => {
    const renderer = renderScreen([
      delivery('first', 2),
      delivery('second', 3),
      delivery('third', 6),
    ]);

    expect(totalLabel(renderer)).toBe('11 baldes');
    expect(mockUseDeliveries).toHaveBeenCalledWith({ mode: 'today', date: '2026-09-23' });

    mockUseDeliveries.mockReturnValue({
      allDeliveries: [delivery('updated', 4)],
      create: jest.fn(),
      remove: jest.fn(),
    });
    act(() => {
      renderer.update(createElement(RegistrarDeliveryScreen, { showLargeTitle: true }));
    });

    expect(totalLabel(renderer)).toBe('4 baldes');
  });

  it('opens client detail directly without a selected row, Add CTA, or sheet on the inline route', () => {
    const client = {
      clientId: 'client:selection-test',
      canonicalName: 'Mercado Central',
      currentPrice: 49.8,
      hasIncompleteAddress: false,
      normalizedName: 'mercado central',
      sources: ['delivery'],
      usesBoleto: false,
      usesInvoice: false,
    };
    const item = {
      bucketPrice: 49.8,
      id: client.clientId,
      systemImage: 'person.crop.circle.fill',
      title: client.canonicalName,
    };
    const secondClient = {
      ...client,
      clientId: 'client:selection-test-2',
      canonicalName: 'Café Portugal',
      normalizedName: 'cafe portugal',
    };
    const secondItem = {
      ...item,
      id: secondClient.clientId,
      title: secondClient.canonicalName,
    };
    mockUseClients.mockReturnValue({ clients: [client, secondClient] });
    mockRegistrarDeliveryController.clientItems = [item, secondItem];
    mockUseDeliveries.mockReturnValue({
      allDeliveries: [delivery('today', 7)],
      create: jest.fn(),
      remove: jest.fn(),
    });

    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(RegistrarDeliveryScreen, {
          inlineClientSelection: true,
          showLargeTitle: true,
        }),
      );
    });

    expect(renderer.root.findAll((node) => String(node.type) === 'client-list-item')).toHaveLength(
      2,
    );
    expect(renderer.root.findAll((node) => String(node.type) === 'native-header')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ props: expect.objectContaining({ title: 'Clientes' }) }),
      ]),
    );
    expect(
      renderer.root.find((node) => String(node.type) === 'progressive-collapsible-screen').props
        .compactTitle,
    ).toBe('Clientes');
    expect(renderer.root.findAll((node) => String(node.type) === 'client-icon')[0].props).toEqual({
      backgroundColor: '#FFFFFF',
      iconColor: '#000000',
      iconName: 'person',
    });
    expect(totalLabel(renderer, 'Clientes')).toBeUndefined();
    expect(renderer.root.findAll((node) => String(node.type) === 'premium-card')).toHaveLength(0);
    expect(
      renderer.root
        .findAllByType(Text)
        .some((node) => node.props.children === 'Selecionar cliente'),
    ).toBe(false);
    const searchField = renderer.root.find((node) => String(node.type) === 'search-bar');
    expect(searchField.props.placeholder).toBe('Buscar cliente');
    expect(searchField.props.accessibilityLabel).toBe('Buscar cliente');
    expect(
      renderer.root
        .findAllByType(Text)
        .some((node) => node.props.children === 'Nenhuma entrega hoje'),
    ).toBe(false);

    expect(
      renderer.root.findAll((node) => String(node.type) === 'retail-primary-button'),
    ).toHaveLength(0);
    expect(
      renderer.root.findAll((node) => String(node.type) === 'registrar-delivery-sheet'),
    ).toHaveLength(0);
    expect(
      renderer.root.findAll((node) => String(node.type) === 'sticky-action-footer'),
    ).toHaveLength(1);

    const rows = renderer.root.findAll((node) => String(node.type) === 'client-list-item');
    expect(clientPressTargets(renderer)).toHaveLength(2);
    expect(clientPressTargets(renderer)[0].props).toMatchObject({
      accessibilityHint: 'Abrir registro de entrega para este cliente',
      accessibilityLabel: 'Mercado Central',
      accessibilityRole: 'button',
      containerStyle: { width: '100%' },
      disablePressAnimation: false,
    });
    expect(rows[0].props.onPress).toBeUndefined();
    expect(StyleSheet.flatten(rows[0].props.style)).toMatchObject({
      backgroundColor: '#FFFFFF',
      borderRadius: 999,
      borderCurve: 'continuous',
      overflow: 'hidden',
      paddingHorizontal: 16,
      width: '100%',
    });
    expect(rows[0].props.titleColor).toBeUndefined();
    const unselectedIcon = rows[0].find((node) => String(node.type) === 'client-icon');
    expect(unselectedIcon.props).toEqual({
      backgroundColor: '#FFFFFF',
      iconColor: '#000000',
      iconName: 'person',
    });
    mockResolvedMode.value = 'dark';
    let darkRenderer!: ReactTestRenderer;
    act(() => {
      darkRenderer = create(
        createElement(RegistrarDeliveryScreen, {
          inlineClientSelection: true,
          showLargeTitle: true,
        }),
      );
    });
    expect(
      darkRenderer.root.findAll((node) => String(node.type) === 'client-icon')[0].props,
    ).toEqual({
      backgroundColor: '#000000',
      iconColor: '#FFFFFF',
      iconName: 'person',
    });
    const progressiveScreen = renderer.root.find(
      (node) => String(node.type) === 'progressive-collapsible-screen',
    );
    expect(progressiveScreen.props.scrollViewProps).toEqual({
      automaticallyAdjustKeyboardInsets: true,
      keyboardShouldPersistTaps: 'handled',
    });
    expect(
      progressiveScreen.findAll((node) => String(node.type) === 'client-list-item'),
    ).toHaveLength(2);
    expect(
      progressiveScreen.findAll((node) => String(node.type) === 'native-search-field'),
    ).toHaveLength(0);
    expect(
      renderer.root.findAll((node) => String(node.type) === 'native-search-field'),
    ).toHaveLength(0);
    expect(progressiveScreen.findAllByType(ScrollView)).toHaveLength(0);
    const footer = renderer.root.find((node) => String(node.type) === 'sticky-action-footer');
    expect(footer.props.keyboardAware).toBe(true);
    expect(StyleSheet.flatten(footer.props.contentContainerStyle)).toEqual({
      paddingHorizontal: '8%',
    });
    expect(footer.findAll((node) => String(node.type) === 'glass-surface')).toHaveLength(1);
    const searchSurface = footer.find((node) => String(node.type) === 'glass-surface');
    expect(searchSurface.props).toMatchObject({
      glassEffectStyle: 'clear',
      interactive: true,
      style: { width: '100%' },
    });
    expect(searchSurface.findAll((node) => String(node.type) === 'search-bar')).toHaveLength(1);
    const cardsWithClientRows = renderer.root
      .findAll((node) => String(node.type) === 'premium-card')
      .filter(
        (card) => card.findAll((node) => String(node.type) === 'client-list-item').length > 0,
      );
    expect(cardsWithClientRows).toHaveLength(0);
    const listContainer = renderer.root.findAllByType(View).find((node) => {
      const style = StyleSheet.flatten(node.props.style);
      return style?.gap === 8 && style.width === '100%';
    });
    expect(StyleSheet.flatten(listContainer?.props.style)).toMatchObject({ gap: 8, width: '100%' });

    act(() => {
      searchField.props.onChangeText('cafe');
    });
    let visibleRows = renderer.root.findAll((node) => String(node.type) === 'client-list-item');
    expect(visibleRows).toHaveLength(1);
    expect(visibleRows[0].props.title).toBe('Café Portugal');

    act(() => {
      renderer.root
        .find((node) => String(node.type) === 'search-bar')
        .props.onChangeText('cliente inexistente');
    });
    expect(
      renderer.root
        .findAllByType(Text)
        .some((node) => node.props.children === 'Nenhum cliente encontrado'),
    ).toBe(true);
    expect(
      progressiveScreen
        .findAllByType(Text)
        .some((node) => node.props.children === 'Nenhum cliente encontrado'),
    ).toBe(true);
    expect(renderer.root.findAll((node) => String(node.type) === 'client-list-item')).toHaveLength(
      0,
    );

    act(() => {
      renderer.root.find((node) => String(node.type) === 'search-bar').props.onClear();
    });
    visibleRows = renderer.root.findAll((node) => String(node.type) === 'client-list-item');
    expect(visibleRows).toHaveLength(2);

    act(() => clientPressTargets(renderer)[0].props.onPress());
    expect(jest.requireMock('@/utils/haptics').triggerLightImpactHaptic).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledWith({
      params: { clientId: item.id },
      pathname: '/registrar-entrega/[clientId]',
    });
    expect(mockRegistrarDeliveryController.handleSelect).not.toHaveBeenCalled();
    expect(mockRegistrarDeliveryController.openSelectedClientSheet).not.toHaveBeenCalled();

    mockRegistrarDeliveryController.selectedClient = { id: item.id };
    act(() => {
      renderer.update(
        createElement(RegistrarDeliveryScreen, {
          inlineClientSelection: true,
          showLargeTitle: true,
        }),
      );
    });
    const [firstRow, secondRow] = renderer.root.findAll(
      (node) => String(node.type) === 'client-list-item',
    );
    for (const row of [firstRow, secondRow]) {
      expect(StyleSheet.flatten(row.props.style)).toMatchObject({
        backgroundColor: '#FFFFFF',
        borderRadius: 999,
        borderCurve: 'continuous',
        overflow: 'hidden',
        paddingHorizontal: 16,
        width: '100%',
      });
      expect(row.props.titleColor).toBeUndefined();
    }
  });

  it('keeps the legacy Registrar sheet available outside inline client selection', () => {
    const renderer = renderScreen([]);

    expect(
      renderer.root.findAll((node) => String(node.type) === 'registrar-delivery-sheet'),
    ).toHaveLength(1);
    expect(renderer.root.findAll((node) => String(node.type) === 'toolbar-menu')).toHaveLength(1);
  });

  it('opens the existing client creation route from the inline native toolbar action', () => {
    mockUseClients.mockReturnValue({ clients: [] });
    mockRegistrarDeliveryController.clientItems = [];

    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(RegistrarDeliveryScreen, {
          inlineClientSelection: true,
          showLargeTitle: true,
        }),
      );
    });

    expect(renderer.root.findAll((node) => String(node.type) === 'toolbar-menu')).toHaveLength(0);
    const toolbarAction = renderer.root.find((node) => String(node.type) === 'toolbar-button');
    expect(toolbarAction.props.accessibilityLabel).toBe('Novo cliente');
    expect(toolbarAction.find((node) => String(node.type) === 'toolbar-icon').props.sf).toBe(
      'person.badge.plus',
    );
    expect(toolbarAction.find((node) => String(node.type) === 'toolbar-label').props.children).toBe(
      'Novo cliente',
    );

    act(() => toolbarAction.props.onPress());

    expect(mockRouterPush).toHaveBeenCalledWith('/clientes/novo');
  });

  it('uses the first client tap only to blur a focused search and keeps the query', () => {
    const client = {
      clientId: 'client:focused-search',
      canonicalName: 'Café Portugal',
      currentPrice: 49.8,
      hasIncompleteAddress: false,
      normalizedName: 'cafe portugal',
      sources: ['delivery'],
      usesBoleto: false,
      usesInvoice: false,
    };
    const item = {
      bucketPrice: 49.8,
      id: client.clientId,
      systemImage: 'person.crop.circle.fill',
      title: client.canonicalName,
    };
    mockUseClients.mockReturnValue({ clients: [client] });
    mockRegistrarDeliveryController.clientItems = [item];

    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(RegistrarDeliveryScreen, {
          inlineClientSelection: true,
          showLargeTitle: true,
        }),
      );
    });
    const keyboardDismissSpy = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});

    try {
      act(() => {
        renderer.root.find((node) => String(node.type) === 'search-bar').props.onChangeText('cafe');
      });
      act(() => {
        renderer.root.find((node) => String(node.type) === 'search-bar').props.onFocus();
      });
      const filteredRow = renderer.root.find((node) => String(node.type) === 'client-list-item');
      const focusedSearch = renderer.root.find((node) => String(node.type) === 'search-bar');
      expect(clientPressTargets(renderer)[0].props.disablePressAnimation).toBe(true);
      expect(filteredRow.props.title).toBe('Café Portugal');
      expect(focusedSearch.props.value).toBe('cafe');
      expect(focusedSearch.props.blurRequestKey).toBe(0);
      jest.requireMock('@/utils/haptics').triggerLightImpactHaptic.mockClear();

      act(() => {
        clientPressTargets(renderer)[0].props.onPress();
      });
      const blurredSearch = renderer.root.find((node) => String(node.type) === 'search-bar');
      expect(keyboardDismissSpy).toHaveBeenCalledTimes(1);
      expect(blurredSearch.props.blurRequestKey).toBe(1);
      expect(blurredSearch.props.value).toBe('cafe');
      expect(mockRouterPush).not.toHaveBeenCalled();
      expect(jest.requireMock('@/utils/haptics').triggerLightImpactHaptic).not.toHaveBeenCalled();
      expect(mockRegistrarDeliveryController.handleSelect).not.toHaveBeenCalled();
      expect(mockRegistrarDeliveryController.selectedClient).toBeNull();

      act(() => {
        blurredSearch.props.onBlur();
      });
      expect(clientPressTargets(renderer)[0].props.disablePressAnimation).toBe(false);
      act(() => {
        clientPressTargets(renderer)[0].props.onPress();
      });
      expect(jest.requireMock('@/utils/haptics').triggerLightImpactHaptic).toHaveBeenCalledTimes(1);
      expect(mockRouterPush).toHaveBeenCalledWith({
        params: { clientId: item.id },
        pathname: '/registrar-entrega/[clientId]',
      });
    } finally {
      keyboardDismissSpy.mockRestore();
    }
  });
});
