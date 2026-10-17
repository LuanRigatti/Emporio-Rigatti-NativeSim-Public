/* eslint-disable @typescript-eslint/no-require-imports */

import { createElement, type ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

let mockAlert = jest.fn();
let mockCardsProps: Record<string, unknown> | null = null;
let mockPreviewAll = jest.fn();
let mockCommitAll = jest.fn();
let mockReadPending = jest.fn();
let mockSavePending = jest.fn();
let mockClearPending = jest.fn();
let mockCreateKey = jest.fn();
let mockGetStatus = jest.fn();
let mockTriggerHaptic = jest.fn();
let mockBulkEnabled = true;
let mockPreview: Record<string, unknown>;

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native') as typeof import('react-native');
  return {
    Alert: { alert: (...args: unknown[]) => mockAlert(...args) },
    StyleSheet: actual.StyleSheet,
    Text: actual.Text,
    View: actual.View,
  };
});

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));

jest.mock('@/providers', () => ({
  useAppSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
  useAuth: () => ({ sessionVersion: 3, user: { id: 'uid-a' } }),
}));

jest.mock('@/theme', () => ({
  useAppTheme: () => ({
    theme: {
      colors: { textPrimary: '#111', textSecondary: '#666' },
      radius: { lg: 20 },
      sizes: { touchTargetMinimum: 44, iconMedium: 24 },
      spacing: { lg: 24, md: 16, sm: 12, xl: 32, xxl: 40, xxxl: 48, xxs: 4 },
      typography: { body: {}, headline: {} },
    },
  }),
}));

jest.mock('@/utils/presentation/testModeValues', () => ({
  useTestModePresentation: () => ({ currency: (value: number) => `masked:${value}` }),
}));

jest.mock('@/utils/data', () => ({
  formatCurrency: (value: number) => `R$ ${value.toFixed(2)}`,
}));

jest.mock('@/utils/haptics', () => ({ triggerLightImpactHaptic: () => mockTriggerHaptic() }));

jest.mock('@/features/open-payments/hooks/useOpenPaymentClients', () => ({
  useOpenPaymentClients: () => ({
    bulkPaymentsEnabled: mockBulkEnabled,
    clientCards: [
      {
        deliveries: [],
        entregas: 1,
        nome: 'Cliente',
        percentual: 100,
        quantidade: 1,
        recentPayments: [],
        valor: 50,
      },
    ],
    commitAllClientPayments: (...args: unknown[]) => mockCommitAll(...args),
    markDeliveryPaid: jest.fn(),
    paymentHistoryError: undefined,
    paymentHistoryLoading: false,
    previewAllClientPayments: (...args: unknown[]) => mockPreviewAll(...args),
    testModeEnabled: false,
    totalOpenAmount: 0,
  }),
}));

jest.mock('@/features/open-payments/services/OpenPaymentBulkPaymentService', () => ({
  clearPendingOpenPaymentBulkOperation: (...args: unknown[]) => mockClearPending(...args),
  createOpenPaymentBulkIdempotencyKey: () => mockCreateKey(),
  getOpenPaymentBulkErrorMessage: () => 'Erro controlado',
  getOpenPaymentBulkOperationStatus: (...args: unknown[]) => mockGetStatus(...args),
  isDefinitiveOpenPaymentBulkError: () => false,
  readPendingOpenPaymentBulkOperation: (...args: unknown[]) => mockReadPending(...args),
  savePendingOpenPaymentBulkOperation: (...args: unknown[]) => mockSavePending(...args),
}));

jest.mock('@/components/layout', () => {
  const React = require('react') as typeof import('react');
  return { NativeGlassHeader: () => React.createElement('native-glass-header') };
});

jest.mock('@/components/native', () => {
  const React = require('react') as typeof import('react');
  return { NativeGlassBackButton: () => React.createElement('native-back-button') };
});

jest.mock('@/components/premium', () => {
  const React = require('react') as typeof import('react');
  const RN = require('react-native') as typeof import('react-native');
  return {
    GlassCard: ({ children }: { children?: ReactNode }) =>
      React.createElement(RN.View, null, children),
    PremiumScreen: ({ children }: { children?: ReactNode }) =>
      React.createElement(RN.View, null, children),
    ProgressiveCollapsibleScreen: ({ children }: { children?: ReactNode }) =>
      React.createElement(RN.View, null, children),
  };
});

jest.mock('@/features/open-payments/components/OpenPaymentClientCards', () => {
  const React = require('react') as typeof import('react');
  return {
    OpenPaymentClientCards: (props: Record<string, unknown>) => {
      mockCardsProps = props;
      return React.createElement('open-payment-client-cards');
    },
  };
});

const { OpenPaymentClientsScreen } =
  require('@/features/open-payments/components/OpenPaymentClientsScreen') as {
    OpenPaymentClientsScreen: () => ReactNode;
  };

describe('OpenPaymentClientsScreen bulk payment confirmation', () => {
  let renderer: ReactTestRenderer;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCardsProps = null;
    mockBulkEnabled = true;
    mockReadPending.mockResolvedValue(null);
    mockSavePending.mockResolvedValue(undefined);
    mockClearPending.mockResolvedValue(undefined);
    mockCreateKey.mockReturnValue('8fd21a08-353c-4f51-849b-b435b7f6e813');
    mockGetStatus.mockResolvedValue({ status: 'not-found' });
    mockPreview = {
      status: 'ready',
      clientName: 'Nome canônico do servidor',
      eligibleCount: 2,
      totalCents: 12500,
      snapshotFingerprint: 'a'.repeat(64),
    };
    mockPreviewAll.mockImplementation(async () => mockPreview);
    mockCommitAll.mockResolvedValue({
      cacheSynchronized: true,
      result: {
        status: 'committed',
        operationId: '8fd21a08-353c-4f51-849b-b435b7f6e813',
        clientId: 'client:a',
        clientName: 'Nome canônico do servidor',
        eligibleCount: 2,
        totalCents: 12500,
        updatedDeliveries: [
          { id: 'd1', date: '2026-10-10' },
          { id: 'd2', date: '2026-10-11' },
        ],
        replayed: false,
      },
    });
    act(() => {
      renderer = create(createElement(OpenPaymentClientsScreen));
    });
  });

  afterEach(() => {
    act(() => renderer.unmount());
  });

  it('uses authoritative server values and confirms once before committing the full visible set', async () => {
    const action = mockCardsProps?.onMarkAllAsPaid as (
      clientId: string,
      visibleIds: readonly string[],
    ) => Promise<void>;
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = action('client:a', ['d1', 'd2']);
      void action('client:a', ['d1', 'd2']);
    });
    await act(async () => pending);

    expect(mockPreviewAll).toHaveBeenCalledTimes(1);
    expect(mockPreviewAll).toHaveBeenCalledWith('client:a', ['d1', 'd2']);
    expect(mockAlert).toHaveBeenCalledTimes(1);
    const confirmation = mockAlert.mock.calls[0] as [
      string,
      string,
      { text: string; onPress?: () => void }[],
    ];
    expect(confirmation[1]).toContain('Nome canônico do servidor');
    expect(confirmation[1]).toContain('2 entregas pendentes');
    expect(confirmation[1]).toContain('R$ 125.00');
    await act(async () => {
      confirmation[2][1]?.onPress?.();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockSavePending).toHaveBeenCalledWith(
      'uid-a',
      expect.objectContaining({
        commitAttempted: true,
        idempotencyKey: '8fd21a08-353c-4f51-849b-b435b7f6e813',
      }),
    );
    expect(mockCommitAll).toHaveBeenCalledWith({
      clientId: 'client:a',
      idempotencyKey: '8fd21a08-353c-4f51-849b-b435b7f6e813',
      snapshotFingerprint: 'a'.repeat(64),
      visibleDeliveryIds: ['d1', 'd2'],
    });
    expect(mockClearPending).toHaveBeenCalledWith('uid-a', 'client:a');
    expect(mockAlert.mock.calls.at(-1)?.[0]).toBe('Quitação confirmada');
  });

  it('blocks a server presentation mismatch and explains deliveries absent from the visible card', async () => {
    mockPreview = {
      status: 'presentation-mismatch',
      clientName: 'Nome canônico do servidor',
      eligibleCount: 3,
      totalCents: 18000,
      notShownCount: 1,
      noLongerEligibleCount: 0,
    };
    const action = mockCardsProps?.onMarkAllAsPaid as (
      clientId: string,
      visibleIds: readonly string[],
    ) => Promise<void>;

    await act(async () => action('client:a', ['d1', 'd2']));

    expect(mockAlert).toHaveBeenCalledTimes(1);
    expect(mockAlert.mock.calls[0]?.[0]).toBe('Pendências diferentes');
    expect(mockAlert.mock.calls[0]?.[1]).toContain('1 entrega(s) não aparecem neste card');
    expect(mockAlert.mock.calls[0]?.[1]).toContain('Nada foi quitado');
    expect(mockCommitAll).not.toHaveBeenCalled();
  });

  it('does not commit when the user cancels the native confirmation', async () => {
    const action = mockCardsProps?.onMarkAllAsPaid as (
      clientId: string,
      visibleIds: readonly string[],
    ) => Promise<void>;
    await act(async () => action('client:a', ['d1', 'd2']));
    const confirmation = mockAlert.mock.calls[0] as [
      string,
      string,
      { text: string; onPress?: () => void }[],
    ];

    act(() => confirmation[2][0]?.onPress?.());

    expect(mockClearPending).toHaveBeenCalledWith('uid-a', 'client:a');
    expect(mockCommitAll).not.toHaveBeenCalled();
  });

  it('recovers an ambiguous commit from its receipt without showing a second confirmation', async () => {
    mockReadPending.mockResolvedValue({
      clientId: 'client:a',
      visibleDeliveryIds: ['d1', 'd2'],
      snapshotFingerprint: 'a'.repeat(64),
      idempotencyKey: '8fd21a08-353c-4f51-849b-b435b7f6e813',
      clientName: 'Nome persistido antigo',
      eligibleCount: 2,
      totalCents: 1,
      commitAttempted: true,
    });
    mockGetStatus.mockResolvedValue({ status: 'committed' });
    const action = mockCardsProps?.onMarkAllAsPaid as (
      clientId: string,
      visibleIds: readonly string[],
    ) => Promise<void>;

    await act(async () => action('client:a', ['d1', 'd2']));

    expect(mockGetStatus).toHaveBeenCalledWith('8fd21a08-353c-4f51-849b-b435b7f6e813');
    expect(mockPreviewAll).not.toHaveBeenCalled();
    expect(mockCommitAll).toHaveBeenCalledWith({
      clientId: 'client:a',
      idempotencyKey: '8fd21a08-353c-4f51-849b-b435b7f6e813',
      snapshotFingerprint: 'a'.repeat(64),
      visibleDeliveryIds: ['d1', 'd2'],
    });
    expect(mockAlert).toHaveBeenCalledTimes(1);
    expect(mockAlert.mock.calls[0]?.[0]).toBe('Quitação confirmada');
    expect(mockAlert.mock.calls[0]?.[1]).toContain('R$ 125.00');
    expect(mockAlert.mock.calls[0]?.[1]).not.toContain('Nome persistido antigo');
  });

  it('creates a fresh idempotency key for a later bulk payment after success', async () => {
    const firstKey = '8fd21a08-353c-4f51-849b-b435b7f6e813';
    const secondKey = '7bd94be0-5273-4a11-a574-1234567890ab';
    mockCreateKey.mockReturnValueOnce(firstKey).mockReturnValueOnce(secondKey);
    const action = mockCardsProps?.onMarkAllAsPaid as (
      clientId: string,
      visibleIds: readonly string[],
    ) => Promise<void>;

    await act(async () => action('client:a', ['d1', 'd2']));
    const firstConfirmation = mockAlert.mock.calls[0] as [
      string,
      string,
      { text: string; onPress?: () => void }[],
    ];
    await act(async () => {
      firstConfirmation[2][1]?.onPress?.();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockClearPending).toHaveBeenCalledWith('uid-a', 'client:a');

    const successAlert = mockAlert.mock.calls[1] as [
      string,
      string,
      unknown[],
      { onDismiss?: () => void },
    ];
    successAlert[3].onDismiss?.();
    await act(async () => action('client:a', ['d1', 'd2']));

    const pendingOperations = mockSavePending.mock.calls.map(
      ([, operation]) => operation as { idempotencyKey: string },
    );
    expect(pendingOperations.some(({ idempotencyKey }) => idempotencyKey === firstKey)).toBe(true);
    expect(pendingOperations.at(-1)?.idempotencyKey).toBe(secondKey);
    expect(mockAlert.mock.calls.at(-1)?.[0]).toBe('Marcar todas como pagas?');
    expect(mockCommitAll).toHaveBeenCalledTimes(1);
  });

  it('recovers an older receipt before previewing a changed visible set with a new key', async () => {
    const previousKey = '8fd21a08-353c-4f51-849b-b435b7f6e813';
    const nextKey = '7bd94be0-5273-4a11-a574-1234567890ab';
    mockReadPending.mockResolvedValue({
      clientId: 'client:a',
      visibleDeliveryIds: ['d1', 'd2'],
      snapshotFingerprint: 'a'.repeat(64),
      idempotencyKey: previousKey,
      commitAttempted: true,
    });
    mockGetStatus.mockResolvedValue({ status: 'committed' });
    mockCreateKey.mockReturnValue(nextKey);
    const action = mockCardsProps?.onMarkAllAsPaid as (
      clientId: string,
      visibleIds: readonly string[],
    ) => Promise<void>;

    await act(async () => action('client:a', ['new-delivery']));

    expect(mockCommitAll).toHaveBeenCalledWith({
      clientId: 'client:a',
      idempotencyKey: previousKey,
      snapshotFingerprint: 'a'.repeat(64),
      visibleDeliveryIds: ['d1', 'd2'],
    });
    expect(mockClearPending).toHaveBeenCalledWith('uid-a', 'client:a');
    expect(mockPreviewAll).toHaveBeenCalledWith('client:a', ['new-delivery']);
    expect(mockSavePending).toHaveBeenCalledWith(
      'uid-a',
      expect.objectContaining({
        commitAttempted: false,
        idempotencyKey: nextKey,
        visibleDeliveryIds: ['new-delivery'],
      }),
    );
    expect(mockAlert.mock.calls.at(-1)?.[0]).toBe('Marcar todas como pagas?');
  });

  it('blocks a new operation if a recovered receipt cannot be cleared locally', async () => {
    mockReadPending.mockResolvedValue({
      clientId: 'client:a',
      visibleDeliveryIds: ['d1', 'd2'],
      snapshotFingerprint: 'a'.repeat(64),
      idempotencyKey: '8fd21a08-353c-4f51-849b-b435b7f6e813',
      commitAttempted: true,
    });
    mockGetStatus.mockResolvedValue({ status: 'committed' });
    mockClearPending.mockRejectedValueOnce(new Error('storage unavailable'));
    const action = mockCardsProps?.onMarkAllAsPaid as (
      clientId: string,
      visibleIds: readonly string[],
    ) => Promise<void>;

    await act(async () => action('client:a', ['new-delivery']));

    expect(mockAlert.mock.calls.at(-1)?.[0]).toBe('Quitação anterior confirmada');
    expect(mockAlert.mock.calls.at(-1)?.[1]).toContain('Nenhuma nova quitação foi iniciada');
    expect(mockPreviewAll).not.toHaveBeenCalled();
    expect(mockSavePending).not.toHaveBeenCalled();
  });

  it('re-previews an uncommitted ambiguous retry and reuses its idempotency key', async () => {
    mockReadPending.mockResolvedValue({
      clientId: 'client:a',
      visibleDeliveryIds: ['d1', 'd2'],
      snapshotFingerprint: 'b'.repeat(64),
      idempotencyKey: '8fd21a08-353c-4f51-849b-b435b7f6e813',
      clientName: 'Nome persistido antigo',
      eligibleCount: 2,
      totalCents: 1,
      commitAttempted: true,
    });
    mockGetStatus.mockResolvedValue({ status: 'not-found' });
    const action = mockCardsProps?.onMarkAllAsPaid as (
      clientId: string,
      visibleIds: readonly string[],
    ) => Promise<void>;

    await act(async () => action('client:a', ['d1', 'd2']));

    expect(mockPreviewAll).toHaveBeenCalledWith('client:a', ['d1', 'd2']);
    expect(mockSavePending).toHaveBeenCalledWith(
      'uid-a',
      expect.objectContaining({
        clientName: 'Nome canônico do servidor',
        commitAttempted: false,
        idempotencyKey: '8fd21a08-353c-4f51-849b-b435b7f6e813',
        totalCents: 12500,
      }),
    );
    expect(mockAlert.mock.calls[0]?.[0]).toBe('Marcar todas como pagas?');
    expect(mockAlert.mock.calls[0]?.[1]).toContain('R$ 125.00');
    expect(mockCommitAll).not.toHaveBeenCalled();
  });

  it('does not offer bulk action while the test-mode action guard is active', () => {
    mockBulkEnabled = false;
    act(() => {
      renderer.update(createElement(OpenPaymentClientsScreen));
    });

    expect(mockCardsProps?.onMarkAllAsPaid).toBeUndefined();
  });
});
