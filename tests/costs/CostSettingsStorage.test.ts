import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  CostSettingsStorage,
  costSettingsStorageKey,
  StaleCostSettingsOperationError,
  type CostSettings,
} from '@/services/costs/CostSettingsStorage';

const values = {
  estar: '',
  fuel: '',
  fuelPrice: '6',
  fuelType: 'gasolina',
  kilometers: '10',
  light: '',
  other: '',
};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

function settings(kilometers: string): CostSettings {
  return {
    periods: {
      day: { '2026-09-02': { ...values, kilometers } },
      month: {},
      year: {},
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, reject, resolve };
}

describe('CostSettingsStorage persistence contract', () => {
  const mockGetItem = jest.mocked(AsyncStorage.getItem);
  const mockSetItem = jest.mocked(AsyncStorage.setItem);

  beforeEach(() => {
    mockGetItem.mockReset().mockResolvedValue(null);
    mockSetItem.mockReset().mockResolvedValue(undefined);
  });

  it('updates the in-memory cache only after AsyncStorage confirms the write', async () => {
    const storage = new CostSettingsStorage();
    const write = deferred<void>();

    mockSetItem.mockReturnValue(write.promise);
    const pending = storage.save(settings('10'), 'uid-a');

    expect(storage.getCached('uid-a')).toBeNull();
    write.resolve();
    await pending;

    expect(storage.getCached('uid-a')).toEqual(settings('10'));
    expect(mockSetItem).toHaveBeenCalledWith(
      costSettingsStorageKey('uid-a'),
      JSON.stringify(settings('10')),
    );
  });

  it('keeps the previous cache after a failed write and allows the queue to recover', async () => {
    const storage = new CostSettingsStorage();
    await storage.save(settings('10'), 'uid-a');
    mockSetItem.mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(storage.save(settings('20'), 'uid-a')).rejects.toThrow('storage unavailable');
    expect(storage.getCached('uid-a')).toEqual(settings('10'));

    await storage.save(settings('30'), 'uid-a');
    expect(storage.getCached('uid-a')).toEqual(settings('30'));
  });

  it('keeps the last confirmed value after a failed write and remount', async () => {
    const stored = new Map<string, string>();
    mockSetItem.mockImplementation((key, value) => {
      stored.set(key, value);
      return Promise.resolve();
    });
    mockGetItem.mockImplementation((key) => Promise.resolve(stored.get(key) ?? null));

    const firstStorage = new CostSettingsStorage();
    await firstStorage.save(settings('10'), 'uid-a');
    mockSetItem.mockRejectedValueOnce(new Error('disk full'));

    await expect(firstStorage.save(settings('20'), 'uid-a')).rejects.toThrow('disk full');
    const remountedStorage = new CostSettingsStorage();

    await expect(remountedStorage.load('uid-a')).resolves.toEqual(settings('10'));
  });

  it('waits for a newer queued write before returning a cached snapshot', async () => {
    const storage = new CostSettingsStorage();
    await storage.save(settings('10'), 'uid-a');
    const write = deferred<void>();
    mockSetItem.mockReturnValue(write.promise);

    const pendingSave = storage.save(settings('20'), 'uid-a');
    const pendingLoad = storage.load('uid-a');
    let resolved = false;
    void pendingLoad.then(() => {
      resolved = true;
    });
    await Promise.resolve();

    expect(resolved).toBe(false);
    write.resolve();
    await pendingSave;
    await expect(pendingLoad).resolves.toEqual(settings('20'));
  });

  it('uses separate physical and in-memory scopes for different UIDs', async () => {
    const storageValues = new Map<string, string>();
    mockSetItem.mockImplementation((key, value) => {
      storageValues.set(key, value);
      return Promise.resolve();
    });
    mockGetItem.mockImplementation((key) => Promise.resolve(storageValues.get(key) ?? null));

    const first = new CostSettingsStorage();
    await first.save(settings('10'), 'uid-a');
    await first.save(settings('20'), 'uid-b');

    const second = new CostSettingsStorage();
    await expect(second.load('uid-a')).resolves.toEqual(settings('10'));
    await expect(second.load('uid-b')).resolves.toEqual(settings('20'));
    expect(mockSetItem.mock.calls.map(([key]) => key)).toEqual([
      costSettingsStorageKey('uid-a'),
      costSettingsStorageKey('uid-b'),
    ]);
  });

  it('does not reuse an in-flight read from an older session of the same UID', async () => {
    const storage = new CostSettingsStorage();
    const firstRead = deferred<string | null>();
    const secondSettings = settings('20');
    mockGetItem
      .mockReturnValueOnce(firstRead.promise)
      .mockResolvedValueOnce(JSON.stringify(secondSettings));
    let firstSessionActive = true;

    const first = storage.load('uid-a', {
      canRun: () => firstSessionActive,
      sessionKey: 'uid-a:1',
    });
    const second = storage.load('uid-a', {
      canRun: () => true,
      sessionKey: 'uid-a:2',
    });

    expect(mockGetItem).toHaveBeenCalledTimes(2);
    await expect(second).resolves.toEqual(secondSettings);

    firstSessionActive = false;
    firstRead.resolve(JSON.stringify(settings('10')));

    await expect(first).rejects.toBeInstanceOf(StaleCostSettingsOperationError);
    expect(storage.getCached('uid-a')).toEqual(secondSettings);
  });

  it('does not publish a local write after its session becomes stale', async () => {
    const storage = new CostSettingsStorage();
    const write = deferred<void>();
    let active = true;
    mockSetItem.mockReturnValue(write.promise);

    const pending = storage.save(settings('10'), 'uid-a', { canRun: () => active });
    active = false;
    write.resolve();

    await expect(pending).rejects.toBeInstanceOf(StaleCostSettingsOperationError);
    expect(storage.getCached('uid-a')).toBeNull();
  });
});
