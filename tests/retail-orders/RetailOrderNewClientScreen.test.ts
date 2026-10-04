/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { RetailOrderNewClientScreen } from '@/features/retail-orders/components/RetailOrderNewClientScreen';

const mockRouter = { back: jest.fn(), push: jest.fn() };
const mockCreateClient = jest.fn<Promise<void>, [unknown]>();
const mockUseRetailClients = jest.fn();
let mockResolvedMode: 'light' | 'dark' = 'light';
const mockTheme = {
  colors: {
    background: '#F7F7F7',
    contrastContent: '#FFFFFF',
    contrastSurface: '#000000',
    danger: '#FF0000',
    surface: '#FEFFFF',
    textPrimary: '#111111',
  },
  layout: { screenHorizontalPadding: 24 },
  radius: { xl: 24 },
  spacing: { md: 16, sm: 8, xxs: 4, xl: 24, xs: 4, xxl: 32 },
  typography: { body: {}, footnote: {}, headline: {} },
};

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

jest.mock('@/components/layout', () => ({
  getNativeLargeTitleStyle: () => ({}),
  NativeGlassHeader: (props: Record<string, unknown>) =>
    require('react').createElement('native-header', props),
}));

jest.mock('@/components/native', () => ({
  NativeTextField: (props: Record<string, unknown>) =>
    require('react').createElement('native-text-field', props),
  NativeToggle: (props: Record<string, unknown>) =>
    require('react').createElement('native-toggle', props),
}));

jest.mock(
  '@/components/native/NativeRetailClientFormSheet/NativeRetailClientFormSheet.types',
  () => ({
    EMPTY_RETAIL_CLIENT_FORM_VALUES: {
      address: '',
      defaultDeliveryFee: '',
      hasReferral: false,
      name: '',
      phone: '',
      referredByName: '',
      sourceType: '',
    },
  }),
);

jest.mock('@/components/premium', () => ({
  PremiumCard: ({ children, ...props }: { children?: ReactNode }) =>
    require('react').createElement('premium-card', props, children),
  ProgressiveCollapsibleScreen: ({
    children,
    largeTitle,
    ...props
  }: {
    children?: ReactNode;
    largeTitle?: ReactNode;
  }) => require('react').createElement('premium-screen', props, largeTitle, children),
}));

jest.mock('@/components/premium/StickyActionFooter', () => ({
  StickyActionFooter: ({ children, ...props }: { children?: ReactNode }) =>
    require('react').createElement('sticky-action-footer', props, children),
}));

jest.mock('@/features/retail-orders/components/RetailOrderPrimaryButton', () => ({
  RetailOrderPrimaryButton: (props: Record<string, unknown>) =>
    require('react').createElement('native-button', props),
}));

jest.mock('@/hooks/useRetailClients', () => ({
  useRetailClients: (...args: unknown[]) => {
    mockUseRetailClients(...args);
    return { create: mockCreateClient };
  },
}));

jest.mock('@/providers', () => ({ useAppSafeAreaInsets: () => ({ bottom: 0 }) }));

jest.mock('@/theme', () => ({
  getCardSurfaceColor: (mode: 'light' | 'dark', surface: string) =>
    mode === 'dark' ? '#0C0C0E' : surface,
  useAppTheme: () => ({ resolvedMode: mockResolvedMode, theme: mockTheme }),
}));

jest.mock('@/utils/presentation/testModeValues', () => ({
  useTestModePresentation: () => ({ enabled: false }),
}));

function findNodes(renderer: ReactTestRenderer, type: string): ReactTestInstance[] {
  return renderer.root.findAll((node) => String(node.type) === type);
}

function collectText(node: ReactTestInstance): string {
  return node.children
    .map((child) => (typeof child === 'string' ? child : collectText(child)))
    .join(' ');
}

function renderScreen() {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(createElement(RetailOrderNewClientScreen));
  });
  return renderer;
}

describe('RetailOrderNewClientScreen', () => {
  beforeEach(() => {
    mockRouter.back.mockClear();
    mockRouter.push.mockClear();
    mockCreateClient.mockReset().mockResolvedValue(undefined);
    mockUseRetailClients.mockClear();
    mockResolvedMode = 'light';
  });

  it.each([
    ['light', '#FEFFFF'],
    ['dark', '#0C0C0E'],
  ] as const)('uses the semantic card surface in %s mode', (mode, surface) => {
    mockResolvedMode = mode;
    const renderer = renderScreen();

    expect(
      findNodes(renderer, 'premium-card').map(
        (card) => StyleSheet.flatten(card.props.style)?.backgroundColor,
      ),
    ).toEqual([surface, surface, surface]);
  });

  it('uses the Retail client form fields and avoids loading a second client collection', () => {
    const renderer = renderScreen();

    expect(findNodes(renderer, 'native-header')[0].props.title).toBe('Novo cliente');
    expect(findNodes(renderer, 'premium-card')).toHaveLength(3);
    expect(
      findNodes(renderer, 'native-text-field').map((field) => field.props.accessibilityLabel),
    ).toEqual(['Nome', 'Telefone', 'Endereço', 'Taxa padrão de entrega']);
    expect(mockUseRetailClients).toHaveBeenCalledWith({}, { loadOnMount: false });
  });

  it('preserves the Native Stack title inset and applies card spacing inside the content wrapper', () => {
    const renderer = renderScreen();
    const screen = findNodes(renderer, 'premium-screen')[0];
    const contentContainerStyle = StyleSheet.flatten(screen.props.scrollContentContainerStyle);
    const contentWrapper = renderer.root
      .findAllByType(View)
      .map((view) => StyleSheet.flatten(view.props.style))
      .find((style) => style?.paddingTop === mockTheme.spacing.md);

    expect(screen.props.nativeHeader).toBe(true);
    expect(screen.props.contentTopInset).toBe(66);
    expect(contentContainerStyle).toMatchObject({ paddingHorizontal: 0 });
    expect(contentContainerStyle).not.toHaveProperty('paddingTop');
    expect(contentWrapper).toMatchObject({
      gap: mockTheme.spacing.md,
      paddingHorizontal: mockTheme.layout.screenHorizontalPadding,
      paddingTop: mockTheme.spacing.md,
    });
  });

  it('creates through the Retail hook and returns to the order without selecting the new client', async () => {
    const renderer = renderScreen();
    const fields = findNodes(renderer, 'native-text-field');
    const fieldsByLabel = Object.fromEntries(
      fields.map((field) => [field.props.accessibilityLabel, field]),
    );

    act(() => {
      fieldsByLabel.Nome.props.onChangeText('Novo cliente Retail');
      fieldsByLabel.Endereço.props.onChangeText('Rua Nova, 20');
      fieldsByLabel['Taxa padrão de entrega'].props.onChangeText('18,50');
      findNodes(renderer, 'native-toggle')[0].props.onValueChange(true);
    });
    const updatedFields = findNodes(renderer, 'native-text-field');
    const sourceType = updatedFields.find(
      (field) => field.props.accessibilityLabel === 'Tipo ou origem da indicação',
    );
    expect(sourceType).toBeDefined();
    act(() => sourceType?.props.onChangeText('Instagram'));

    await act(async () => {
      findNodes(renderer, 'native-button')[0].props.onPress();
      await Promise.resolve();
    });

    expect(mockCreateClient).toHaveBeenCalledWith({
      address: 'Rua Nova, 20',
      defaultDeliveryFee: 18.5,
      name: 'Novo cliente Retail',
      phone: '',
      referral: {
        hasReferral: true,
        referredByName: '',
        sourceType: 'Instagram',
      },
    });
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('keeps the form and draft context on creation error', async () => {
    mockCreateClient.mockRejectedValueOnce(new Error('Nome duplicado.'));
    const renderer = renderScreen();
    const nameField = findNodes(renderer, 'native-text-field')[0];

    act(() => nameField.props.onChangeText('Cliente Existente'));
    await act(async () => {
      findNodes(renderer, 'native-button')[0].props.onPress();
      await Promise.resolve();
    });

    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(findNodes(renderer, 'native-text-field')[0].props.value).toBe('Cliente Existente');
    const alert = renderer.root.findAll((node) => node.props.accessibilityRole === 'alert')[0];
    expect(collectText(alert)).toContain('Nome duplicado.');
  });
});
