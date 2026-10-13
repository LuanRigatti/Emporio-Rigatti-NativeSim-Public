/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ReactElement, type ReactNode } from 'react';
import { Text } from 'react-native';

const mockUseLocalSearchParams = jest.fn();
const mockUseDeliveries = jest.fn();
const mockSetDelivered = jest.fn();
const mockRefreshAvailableSnapshot = jest.fn();
const mockSession: {
  value: { user: { id: string } | null; sessionVersion: number; status: string };
} = {
  value: { user: { id: 'user-a' }, sessionVersion: 7, status: 'authenticated' },
};
const mockRouterBack = jest.fn();
const mockRouterReplace = jest.fn();
const mockCanGoBack = jest.fn(() => true);
const mockDelivery = {
  cliente: 'Cliente A',
  data: '2026-10-15',
  entregue: false,
  id: 'delivery-target',
  quantidade: 2,
  status: 'Não Pago',
  valor: 60,
};

jest.mock('expo-router', () => ({
  router: {
    back: () => mockRouterBack(),
    canGoBack: () => mockCanGoBack(),
    replace: (...args: unknown[]) => mockRouterReplace(...args),
  },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock('@/components', () => {
  const React = require('react') as typeof import('react');
  return {
    EmptyState: (props: Record<string, unknown>) => React.createElement('empty-state', props),
    ErrorState: (props: Record<string, unknown>) => React.createElement('error-state', props),
    LargeTitleHeader: (props: Record<string, unknown>) =>
      React.createElement('large-title-header', props),
    PrimaryButton: (props: Record<string, unknown>) => React.createElement('primary-button', props),
  };
});

jest.mock('@/components/layout', () => {
  const React = require('react') as typeof import('react');
  return {
    Screen: ({ children }: { children?: ReactNode }) =>
      React.createElement('screen', null, children),
  };
});

jest.mock('@/hooks/useDeliveries', () => ({
  useDeliveries: (...args: unknown[]) => mockUseDeliveries(...args),
}));

jest.mock('@/providers', () => ({ useAuth: () => mockSession.value }));

jest.mock('@/utils/data', () => ({ todayIso: () => '2026-10-15' }));

jest.mock('@/features/deliveries/widgets/EntregasDoDiaSnapshotCoordinator', () => ({
  entregasDoDiaSnapshotCoordinator: {
    refreshAvailableSnapshot: (...args: unknown[]) => mockRefreshAvailableSnapshot(...args),
  },
}));

jest.mock('@/theme', () => ({
  useAppTheme: () => ({
    theme: {
      colors: { danger: '#B00020', textPrimary: '#111111', textSecondary: '#666666' },
      spacing: { lg: 24, md: 16, xs: 4 },
      typography: {
        body: { fontSize: 16 },
        footnote: { fontSize: 12 },
        title2: { fontSize: 22 },
      },
    },
  }),
}));

const { default: WidgetDeliveryConfirmationRoute } =
  require('@/app/(tabs)/historico/entrega/[deliveryId]') as { default: () => ReactElement };

function makeDeliveriesResult(overrides: Record<string, unknown> = {}) {
  return {
    allDeliveries: [mockDelivery],
    error: undefined,
    loading: false,
    reload: jest.fn(),
    setDelivered: mockSetDelivered,
    ...overrides,
  };
}

describe('Widget delivery confirmation route', () => {
  let renderer: ReactTestRenderer;

  beforeEach(() => {
    mockUseLocalSearchParams.mockReturnValue({ deliveryId: 'delivery-target', date: '2026-10-15' });
    mockSession.value = {
      user: { id: 'user-a' },
      sessionVersion: 7,
      status: 'authenticated',
    };
    mockSetDelivered.mockReset().mockResolvedValue(undefined);
    mockRefreshAvailableSnapshot.mockReset();
    mockRouterBack.mockReset();
    mockRouterReplace.mockReset();
    mockCanGoBack.mockReset().mockReturnValue(true);
    mockUseDeliveries.mockReset().mockReturnValue(makeDeliveriesResult());
  });

  it('loads the exact stable delivery ID and refreshes widgets only after confirmed persistence', async () => {
    await act(async () => {
      renderer = create(createElement(WidgetDeliveryConfirmationRoute));
    });

    expect(mockUseDeliveries).toHaveBeenCalledWith({ mode: 'all', deliveryId: 'delivery-target' });
    expect(mockSetDelivered).not.toHaveBeenCalled();
    const button = renderer.root.find((node) => String(node.type) === 'primary-button');

    await act(async () => {
      button.props.onPress();
      await Promise.resolve();
    });

    expect(mockSetDelivered).toHaveBeenCalledWith('delivery-target', true);
    expect(mockRefreshAvailableSnapshot).toHaveBeenCalledWith('user-a', 7);
    expect(renderer.root.find((node) => String(node.type) === 'empty-state').props.title).toBe(
      'Entrega concluída',
    );
  });

  it('does not publish an optimistic completion when Firestore rejects the mutation', async () => {
    mockSetDelivered.mockRejectedValue(new Error('Falha de rede'));
    await act(async () => {
      renderer = create(createElement(WidgetDeliveryConfirmationRoute));
    });

    await act(async () => {
      renderer.root.find((node) => String(node.type) === 'primary-button').props.onPress();
      await Promise.resolve();
    });

    expect(mockSetDelivered).toHaveBeenCalledTimes(1);
    expect(mockRefreshAvailableSnapshot).not.toHaveBeenCalled();
    expect(renderer.root.findAll((node) => String(node.type) === 'primary-button')).toHaveLength(1);
    expect(
      renderer.root.findAllByType(Text).some((node) => node.props.children === 'Falha de rede'),
    ).toBe(true);
  });

  it('ignores repeated taps while a persistence request is in flight', async () => {
    let resolveMutation: (() => void) | undefined;
    const mutation = new Promise<void>((resolve) => {
      resolveMutation = resolve;
    });
    mockSetDelivered.mockReturnValue(mutation);
    await act(async () => {
      renderer = create(createElement(WidgetDeliveryConfirmationRoute));
    });

    const button = renderer.root.find((node) => String(node.type) === 'primary-button');
    await act(async () => {
      button.props.onPress();
      button.props.onPress();
      await Promise.resolve();
    });
    expect(mockSetDelivered).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveMutation?.();
      await mutation;
    });
    expect(mockRefreshAvailableSnapshot).toHaveBeenCalledTimes(1);
  });

  it('does not publish a completed snapshot into a different UID/session', async () => {
    let resolveMutation: (() => void) | undefined;
    const mutation = new Promise<void>((resolve) => {
      resolveMutation = resolve;
    });
    mockSetDelivered.mockReturnValue(mutation);
    await act(async () => {
      renderer = create(createElement(WidgetDeliveryConfirmationRoute));
    });

    await act(async () => {
      renderer.root.find((node) => String(node.type) === 'primary-button').props.onPress();
      await Promise.resolve();
    });
    mockSession.value = {
      user: { id: 'user-b' },
      sessionVersion: 8,
      status: 'authenticated',
    };
    await act(async () => {
      renderer.update(createElement(WidgetDeliveryConfirmationRoute));
    });
    await act(async () => {
      resolveMutation?.();
      await mutation;
    });

    expect(mockRefreshAvailableSnapshot).not.toHaveBeenCalled();
  });

  it('refuses to complete a malformed or date-mismatched deep link', async () => {
    mockUseLocalSearchParams.mockReturnValue({ deliveryId: 'delivery-target', date: '2026-02-30' });
    await act(async () => {
      renderer = create(createElement(WidgetDeliveryConfirmationRoute));
    });

    expect(mockUseDeliveries).toHaveBeenCalledWith({ mode: 'all', deliveryId: '' });
    expect(renderer.root.find((node) => String(node.type) === 'empty-state').props.title).toBe(
      'Entrega indisponível',
    );
    expect(mockSetDelivered).not.toHaveBeenCalled();
  });

  it('refuses a stale widget link from a previous day', async () => {
    mockUseLocalSearchParams.mockReturnValue({ deliveryId: 'delivery-target', date: '2026-10-14' });
    await act(async () => {
      renderer = create(createElement(WidgetDeliveryConfirmationRoute));
    });

    expect(mockUseDeliveries).toHaveBeenCalledWith({ mode: 'all', deliveryId: '' });
    expect(renderer.root.find((node) => String(node.type) === 'empty-state').props.title).toBe(
      'Entrega indisponível',
    );
    expect(mockSetDelivered).not.toHaveBeenCalled();
  });
});
