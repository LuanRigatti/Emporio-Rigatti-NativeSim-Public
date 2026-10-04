import type { FirestoreDeliveryDataSource } from '@/services/deliveries/FirestoreDeliveryDataSource';
import { reconcileLiveActivityAfterRestore } from '@/features/deliveries/liveActivity/LiveActivityRestoreReconciliation';
import { todayIso } from '@/utils/data';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

describe('Live Activity Restore reconciliation', () => {
  it('does not query when Restore wrote no documents', async () => {
    const source = {
      invalidateCompleteDateSnapshot: jest.fn(),
      load: jest.fn(),
    } as unknown as FirestoreDeliveryDataSource;

    await reconcileLiveActivityAfterRestore(0, 'user-1', 3, source);

    expect(source.invalidateCompleteDateSnapshot).not.toHaveBeenCalled();
    expect(source.load).not.toHaveBeenCalled();
  });

  it('invalidates and performs one forced exact-date reconciliation after successful writes', async () => {
    const source = {
      invalidateCompleteDateSnapshot: jest.fn(),
      load: jest.fn(async () => []),
    } as unknown as FirestoreDeliveryDataSource;

    await reconcileLiveActivityAfterRestore(2, 'user-1', 3, source);

    expect(source.invalidateCompleteDateSnapshot).toHaveBeenCalledTimes(1);
    expect(source.invalidateCompleteDateSnapshot).toHaveBeenCalledWith('user-1', todayIso(), 3);
    expect(source.load).toHaveBeenCalledTimes(1);
    expect(source.load).toHaveBeenCalledWith(
      'user-1',
      { mode: 'today', date: todayIso() },
      { force: true },
      3,
    );
  });

  it('keeps a successful Restore successful when reconciliation is offline', async () => {
    const source = {
      invalidateCompleteDateSnapshot: jest.fn(),
      load: jest.fn(async () => {
        throw new Error('offline');
      }),
    } as unknown as FirestoreDeliveryDataSource;

    await expect(
      reconcileLiveActivityAfterRestore(1, 'user-1', 3, source),
    ).resolves.toBeUndefined();
  });
});
