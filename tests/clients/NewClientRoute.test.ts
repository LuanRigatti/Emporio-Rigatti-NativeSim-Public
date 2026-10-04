/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ComponentType, type ReactNode } from 'react';

const mockRouterBack = jest.fn();
const mockSaveCustomClient = jest.fn();
const mockReloadClients = jest.fn();
const mockUseClients = jest.fn();
let mockTestModeEnabled = false;

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockRouterBack }),
}));

jest.mock('@/components/layout', () => ({
  getNativeLargeTitleStyle: jest.fn(() => ({})),
  NativeGlassHeader: ({ title }: { title: ReactNode }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('native-header', null, title);
  },
}));

jest.mock('@/components/native', () => {
  const React = require('react') as typeof import('react');
  return {
    NativeTextField: (props: Record<string, unknown>) =>
      React.createElement('native-text-field', props),
    NativeToggle: (props: Record<string, unknown>) => React.createElement('native-toggle', props),
  };
});

jest.mock('@/components/premium', () => {
  const React = require('react') as typeof import('react');
  const PremiumCard = ({ children }: { children?: ReactNode }) =>
    React.createElement('premium-card', null, children);
  const ProgressiveCollapsibleScreen = ({ children }: { children?: ReactNode }) =>
    React.createElement('progressive-collapsible-screen', null, children);
  return { PremiumCard, ProgressiveCollapsibleScreen };
});

jest.mock('@/components/premium/StickyActionFooter', () => {
  const React = require('react') as typeof import('react');
  return {
    StickyActionFooter: ({ children }: { children?: ReactNode }) =>
      React.createElement('sticky-action-footer', null, children),
  };
});

jest.mock('@/features/retail-orders/components/RetailOrderPrimaryButton', () => {
  const React = require('react') as typeof import('react');
  return {
    RetailOrderPrimaryButton: (props: Record<string, unknown>) =>
      React.createElement('retail-primary-button', props),
  };
});

jest.mock('@/hooks/useClients', () => ({
  useClients: (...args: unknown[]) => mockUseClients(...args),
}));

jest.mock('@/providers', () => ({ useAppSafeAreaInsets: () => ({ bottom: 34 }) }));

jest.mock('@/theme', () => ({
  getCardSurfaceColor: () => '#FFFFFF',
  useAppTheme: () => ({
    resolvedMode: 'light',
    theme: {
      colors: {
        background: '#FAFAFA',
        danger: '#D00',
        surface: '#FFFFFF',
        textPrimary: '#111111',
      },
      layout: { screenHorizontalPadding: 20, tabBarHeight: 84 },
      radius: { card: 20, xl: 22 },
      sizes: { touchTargetMinimum: 44 },
      spacing: { md: 16, sm: 12, xl: 24, xxs: 4, xs: 8, xxl: 32 },
      typography: { headline: {}, footnote: {} },
    },
  }),
}));

jest.mock('@/utils/presentation/testModeValues', () => ({
  useTestModePresentation: () => ({ enabled: mockTestModeEnabled }),
}));

const { default: NewClientRoute } = require('@/app/clientes/novo') as {
  default: ComponentType;
};

function renderRoute(): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(createElement(NewClientRoute));
  });
  return renderer;
}

describe('NewClientRoute', () => {
  beforeEach(() => {
    mockRouterBack.mockClear();
    mockSaveCustomClient.mockReset().mockResolvedValue(undefined);
    mockReloadClients.mockClear();
    mockTestModeEnabled = false;
    mockUseClients.mockReset().mockReturnValue({
      saveCustomClient: mockSaveCustomClient,
      reload: mockReloadClients,
    });
  });

  it('renders the five existing fields with native controls and submits through useClients', async () => {
    const renderer = renderRoute();
    expect(mockUseClients).toHaveBeenCalledWith(undefined, { loadOnMount: false });
    const nameField = renderer.root
      .findAll((node) => String(node.type) === 'native-text-field')
      .find((node) => node.props.label === 'Nome');
    const addressField = renderer.root
      .findAll((node) => String(node.type) === 'native-text-field')
      .find((node) => node.props.label === 'Endereço');
    const priceField = renderer.root
      .findAll((node) => String(node.type) === 'native-text-field')
      .find((node) => node.props.label === 'Valor do balde');
    const invoiceToggle = renderer.root
      .findAll((node) => String(node.type) === 'native-toggle')
      .find((node) => node.props.label === 'Usa nota fiscal');
    const boletoToggle = renderer.root
      .findAll((node) => String(node.type) === 'native-toggle')
      .find((node) => node.props.label === 'Usa boleto');

    expect(nameField).toBeDefined();
    expect(addressField).toBeDefined();
    expect(priceField?.props.keyboardType).toBe('decimal-pad');
    expect(invoiceToggle?.props.disabled).toBe(false);
    expect(boletoToggle?.props.disabled).toBe(false);
    expect(renderer.root.findAll((node) => String(node.type) === 'premium-card')).toHaveLength(3);

    act(() => {
      nameField?.props.onChangeText('Cliente Novo');
      addressField?.props.onChangeText('Rua Nova, 10');
      priceField?.props.onChangeText('R$ 49,80');
      invoiceToggle?.props.onValueChange(true);
      boletoToggle?.props.onValueChange(false);
    });

    const submitButton = renderer.root.find(
      (node) => String(node.type) === 'retail-primary-button',
    );
    expect(submitButton.props.label).toBe('Adicionar');
    expect(submitButton.props.disabled).toBe(false);
    expect(
      renderer.root.findAll((node) => String(node.type) === 'sticky-action-footer'),
    ).toHaveLength(1);

    await act(async () => {
      await submitButton.props.onPress();
    });

    expect(mockSaveCustomClient).toHaveBeenCalledWith(
      'Cliente Novo',
      49.8,
      'Rua Nova, 10',
      true,
      false,
    );
    expect(mockRouterBack).toHaveBeenCalledTimes(1);
    expect(mockReloadClients).not.toHaveBeenCalled();
  });

  it('shows canonical required-field validation and does not save invalid data', async () => {
    const renderer = renderRoute();
    const submitButton = renderer.root.find(
      (node) => String(node.type) === 'retail-primary-button',
    );

    await act(async () => {
      await submitButton.props.onPress();
    });

    expect(mockSaveCustomClient).not.toHaveBeenCalled();
    expect(mockRouterBack).not.toHaveBeenCalled();
    expect(
      renderer.root
        .findAllByType(require('react-native').Text)
        .some((node) => node.props.children === 'Informe o nome do cliente.'),
    ).toBe(true);
  });

  it('preserves Test Mode by disabling every input and the primary action', () => {
    mockTestModeEnabled = true;
    const renderer = renderRoute();

    expect(
      renderer.root
        .findAll((node) => String(node.type) === 'native-text-field')
        .every((node) => node.props.disabled),
    ).toBe(true);
    expect(
      renderer.root
        .findAll((node) => String(node.type) === 'native-toggle')
        .every((node) => node.props.disabled),
    ).toBe(true);
    expect(
      renderer.root.find((node) => String(node.type) === 'retail-primary-button').props.disabled,
    ).toBe(true);
  });
});
