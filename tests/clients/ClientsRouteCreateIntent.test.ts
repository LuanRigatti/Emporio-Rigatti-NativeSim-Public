/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ComponentType, type ReactNode } from 'react';
import { Text } from 'react-native';

const mockRouterPush = jest.fn();
const mockUseClients = jest.fn();
const mockTriggerLightImpactHaptic = jest.fn();

jest.mock('expo-router', () => {
  const React = require('react') as typeof import('react');
  const Toolbar = ({ children }: { children?: ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  const ToolbarButton = ({
    children,
    ...props
  }: {
    children?: ReactNode;
    [key: string]: unknown;
  }) => React.createElement('toolbar-button', props, children);

  return {
    Stack: { Toolbar: Object.assign(Toolbar, { Button: ToolbarButton }) },
    useRouter: () => ({ push: mockRouterPush }),
  };
});

jest.mock('@expo/vector-icons/Ionicons', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/lists', () => {
  const React = require('react') as typeof import('react');
  return {
    ListItem: ({ title }: { title: string }) => React.createElement('client-list-item', { title }),
  };
});
jest.mock('@/components/layout', () => ({ NativeGlassHeader: () => null }));
jest.mock('@/components/native', () => ({
  NativeCardContextMenu: ({ children }: { children?: ReactNode }) => children,
  NativeGlassIconButton: () => null,
}));
jest.mock('@/components/overlays', () => ({ ConfirmationDialog: () => null }));
jest.mock('@/components/premium', () => {
  const React = require('react') as typeof import('react');
  const PremiumCard = ({ children }: { children?: ReactNode }) =>
    React.createElement('premium-card', null, children);
  const PremiumScreen = ({ children }: { children?: ReactNode }) =>
    React.createElement('premium-screen', null, children);
  return { PremiumCard, PremiumScreen };
});
jest.mock('@/components/feedback', () => {
  const React = require('react') as typeof import('react');
  return {
    EmptyState: (props: Record<string, unknown>) => React.createElement('empty-state', props),
  };
});
jest.mock('@/features/settings/components/SettingsSection', () => ({
  SettingsSection: ({ children }: { children?: ReactNode }) => children,
}));
jest.mock('@/features/open-payments/components/OpenPaymentClientIcon', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/hooks/useClients', () => ({ useClients: () => mockUseClients() }));
jest.mock('@/theme', () => ({
  getCardSurfaceColor: () => '#FFFFFF',
  useAppTheme: () => ({
    resolvedMode: 'light',
    theme: {
      colors: {
        background: '#FFFFFF',
        surface: '#FFFFFF',
        textPrimary: '#000000',
        textSecondary: '#666666',
        textTertiary: '#888888',
      },
      radius: { xl: 24 },
      sizes: { iconSmall: 16, iconMedium: 24, touchTargetMinimum: 44 },
      spacing: { md: 16, sm: 8, xl: 24 },
      typography: { body: {} },
    },
  }),
}));
jest.mock('@/utils/haptics', () => ({ triggerLightImpactHaptic: mockTriggerLightImpactHaptic }));
jest.mock('@/utils/presentation/testModeValues', () => ({
  useTestModePresentation: () => ({ enabled: false }),
}));

const { default: ClientsRoute } = require('@/app/clientes') as {
  default: ComponentType;
};

function renderRoute(state: Record<string, unknown> = {}): ReactTestRenderer {
  mockUseClients.mockReturnValue({
    clients: [],
    error: undefined,
    loading: true,
    reload: jest.fn(),
    removeCustomConfiguration: jest.fn(),
    ...state,
  });

  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(createElement(ClientsRoute));
  });
  return renderer;
}

describe('ClientsRoute creation navigation', () => {
  beforeEach(() => {
    mockRouterPush.mockClear();
    mockUseClients.mockReset();
    mockTriggerLightImpactHaptic.mockClear();
  });

  it('pushes directly to the new-client Native Stack page without rendering a form sheet', () => {
    const renderer = renderRoute();
    const toolbarAction = renderer.root.find((node) => String(node.type) === 'toolbar-button');

    expect(toolbarAction.props.accessibilityLabel).toBe('Adicionar cliente');
    expect(
      renderer.root.findAll((node) => String(node.type) === 'native-client-form-sheet'),
    ).toHaveLength(0);

    act(() => toolbarAction.props.onPress());

    expect(mockTriggerLightImpactHaptic).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledWith('/clientes/novo');
    expect(mockUseClients.mock.results[0]?.value.reload).not.toHaveBeenCalled();
  });

  it('shows the existing loading state without presenting an empty list', () => {
    const renderer = renderRoute({ loading: true });

    expect(renderer.root.findAllByType(Text)[0]?.props.children).toBe('Carregando clientes...');
    expect(renderer.root.findAll((node) => String(node.type) === 'empty-state')).toHaveLength(0);
  });

  it('preserves the error state instead of treating a failed load as empty', () => {
    const renderer = renderRoute({ error: 'Falha de conexão', loading: false });

    expect(
      renderer.root
        .findAllByType(Text)
        .some((node) => String(node.props.children).includes('Falha de conexão')),
    ).toBe(true);
    expect(renderer.root.findAll((node) => String(node.type) === 'empty-state')).toHaveLength(0);
  });

  it('shows the shared empty state after a successful empty load', () => {
    const renderer = renderRoute({ clients: [], loading: false });

    const emptyState = renderer.root.find((node) => String(node.type) === 'empty-state');
    expect(emptyState.props.title).toBe('Nenhum cliente cadastrado');
    expect(renderer.root.findAll((node) => String(node.type) === 'premium-card')).toHaveLength(0);
  });

  it('keeps the client list for a successful populated load', () => {
    const renderer = renderRoute({
      clients: [{ canonicalName: 'Mercado Central', clientId: 'client-1' }],
      loading: false,
    });

    const clientRow = renderer.root.find((node) => String(node.type) === 'client-list-item');
    expect(clientRow.props.title).toBe('Mercado Central');
    expect(renderer.root.findAll((node) => String(node.type) === 'empty-state')).toHaveLength(0);
  });
});
