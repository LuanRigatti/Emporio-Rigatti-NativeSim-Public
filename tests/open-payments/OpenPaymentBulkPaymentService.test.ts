import {
  clearPendingOpenPaymentBulkOperation,
  commitOpenPaymentBulkPayment,
  createOpenPaymentBulkIdempotencyKey,
  getOpenPaymentBulkOperationStatus,
  previewOpenPaymentBulkPayment,
  readPendingOpenPaymentBulkOperation,
  savePendingOpenPaymentBulkOperation,
  type PendingOpenPaymentBulkOperation,
} from '@/features/open-payments/services/OpenPaymentBulkPaymentService';

const mockStorage = new Map<string, string>();
const mockCallable = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
    removeItem: jest.fn((key: string) => {
      mockStorage.delete(key);
      return Promise.resolve();
    }),
    setItem: jest.fn((key: string, value: string) => {
      mockStorage.set(key, value);
      return Promise.resolve();
    }),
  },
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => '8fd21a08-353c-4f51-849b-b435b7f6e813'),
}));

jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(() => ({})),
  httpsCallable: jest.fn(() => mockCallable),
}));

jest.mock('@/services/firebase', () => ({ getFirebaseApp: jest.fn(() => ({})) }));

describe('OpenPaymentBulkPaymentService', () => {
  beforeEach(() => {
    mockStorage.clear();
    mockCallable.mockReset();
  });

  it('requests an authoritative preview without sending a UID', async () => {
    mockCallable.mockResolvedValue({
      data: {
        clientName: 'Cliente canônico',
        eligibleCount: 2,
        snapshotFingerprint: 'a'.repeat(64),
        status: 'ready',
        totalCents: 12500,
      },
    });

    const result = await previewOpenPaymentBulkPayment('client:doc-1', ['d1', 'd2']);

    expect(result).toMatchObject({ status: 'ready', eligibleCount: 2, totalCents: 12500 });
    expect(mockCallable).toHaveBeenCalledWith({
      clientId: 'client:doc-1',
      operation: 'preview',
      visibleDeliveryIds: ['d1', 'd2'],
    });
    expect(mockCallable.mock.calls[0]?.[0]).not.toHaveProperty('uid');
  });

  it('accepts only a complete commit response matching the confirmed set', async () => {
    mockCallable.mockResolvedValue({
      data: {
        clientId: 'client:doc-1',
        clientName: 'Cliente canônico',
        eligibleCount: 2,
        operationId: '8fd21a08-353c-4f51-849b-b435b7f6e813',
        replayed: false,
        status: 'committed',
        totalCents: 12500,
        updatedDeliveries: [
          { date: '2026-10-10', id: 'd1' },
          { date: '2026-10-11', id: 'd2' },
        ],
      },
    });
    const request = {
      clientId: 'client:doc-1',
      idempotencyKey: '8fd21a08-353c-4f51-849b-b435b7f6e813',
      snapshotFingerprint: 'a'.repeat(64),
      visibleDeliveryIds: ['d2', 'd1'],
    };

    const result = await commitOpenPaymentBulkPayment(request);

    expect(result.status).toBe('committed');
    expect(result.updatedDeliveries).toHaveLength(2);
    expect(mockCallable).toHaveBeenCalledWith({ operation: 'commit', ...request });
  });

  it('rejects a partial success payload and preserves idempotency for retry', async () => {
    mockCallable.mockResolvedValue({
      data: {
        clientId: 'client:doc-1',
        clientName: 'Cliente canônico',
        eligibleCount: 1,
        operationId: '8fd21a08-353c-4f51-849b-b435b7f6e813',
        replayed: false,
        status: 'committed',
        totalCents: 5000,
        updatedDeliveries: [],
      },
    });
    const operation: PendingOpenPaymentBulkOperation = {
      clientId: 'client:doc-1',
      idempotencyKey: '8fd21a08-353c-4f51-849b-b435b7f6e813',
      snapshotFingerprint: 'a'.repeat(64),
      visibleDeliveryIds: ['d1'],
      clientName: 'Cliente canônico',
      eligibleCount: 1,
      totalCents: 5000,
      commitAttempted: true,
    };
    await savePendingOpenPaymentBulkOperation('uid-1', operation);

    await expect(commitOpenPaymentBulkPayment(operation)).rejects.toThrow(
      'bulk_commit_response_invalid',
    );
    expect(await readPendingOpenPaymentBulkOperation('uid-1', 'client:doc-1')).toEqual({
      clientId: operation.clientId,
      commitAttempted: operation.commitAttempted,
      idempotencyKey: operation.idempotencyKey,
      snapshotFingerprint: operation.snapshotFingerprint,
      visibleDeliveryIds: operation.visibleDeliveryIds,
    });
  });

  it('keeps the same idempotency key in local pending storage until success is confirmed', async () => {
    const operation = {
      clientId: 'client:doc-1',
      visibleDeliveryIds: ['d1'],
      snapshotFingerprint: 'a'.repeat(64),
      idempotencyKey: createOpenPaymentBulkIdempotencyKey(),
      clientName: 'Cliente canônico',
      eligibleCount: 1,
      totalCents: 5000,
      commitAttempted: true,
    };

    await savePendingOpenPaymentBulkOperation('uid-1', operation);
    const persistedOperation = await readPendingOpenPaymentBulkOperation('uid-1', 'client:doc-1');
    expect(persistedOperation).toEqual({
      clientId: operation.clientId,
      commitAttempted: operation.commitAttempted,
      idempotencyKey: operation.idempotencyKey,
      snapshotFingerprint: operation.snapshotFingerprint,
      visibleDeliveryIds: operation.visibleDeliveryIds,
    });
    expect(persistedOperation).not.toHaveProperty('clientName');
    expect(persistedOperation).not.toHaveProperty('totalCents');
    expect(await readPendingOpenPaymentBulkOperation('uid-2', 'client:doc-1')).toBeNull();
    await clearPendingOpenPaymentBulkOperation('uid-1', 'client:doc-1');
    expect(await readPendingOpenPaymentBulkOperation('uid-1', 'client:doc-1')).toBeNull();
  });

  it('recovers a committed receipt under the current authenticated callable session', async () => {
    mockCallable.mockResolvedValue({
      data: {
        status: 'committed',
        result: {
          status: 'committed',
          operationId: '8fd21a08-353c-4f51-849b-b435b7f6e813',
          clientId: 'client:doc-1',
          clientName: 'Cliente canônico',
          eligibleCount: 1,
          totalCents: 5000,
          updatedDeliveries: [{ id: 'd1', date: '2026-10-10' }],
          replayed: true,
        },
      },
    });

    const status = await getOpenPaymentBulkOperationStatus('8fd21a08-353c-4f51-849b-b435b7f6e813');

    expect(status.status).toBe('committed');
    expect(mockCallable).toHaveBeenCalledWith({
      operation: 'status',
      idempotencyKey: '8fd21a08-353c-4f51-849b-b435b7f6e813',
    });
    expect(mockCallable.mock.calls[0]?.[0]).not.toHaveProperty('uid');
  });

  it('does not call the server for a visible set beyond the safe transaction limit', async () => {
    const result = await previewOpenPaymentBulkPayment(
      'client:doc-1',
      Array.from({ length: 500 }, (_, index) => `d-${index}`),
    );

    expect(result.status).toBe('limit-exceeded');
    expect(mockCallable).not.toHaveBeenCalled();
  });
});
