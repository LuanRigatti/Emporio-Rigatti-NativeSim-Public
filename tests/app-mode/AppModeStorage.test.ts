import { AppModeStorage, appModeStorageKey } from '@/services/preferences/AppModeStorage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

function createStorage(initialValues: Record<string, string> = {}) {
  const values = new Map(Object.entries(initialValues));
  return {
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
  };
}

describe('AppModeStorage', () => {
  it('uses wholesale when the UID has no saved preference', async () => {
    const storage = createStorage();
    const appModeStorage = new AppModeStorage(storage);

    await expect(appModeStorage.load('user-a')).resolves.toBe('wholesale');
    expect(storage.getItem).toHaveBeenCalledWith(appModeStorageKey('user-a'));
  });

  it('keeps preferences isolated by UID', async () => {
    const storage = createStorage();
    const appModeStorage = new AppModeStorage(storage);

    await appModeStorage.save('user-a', 'retail');

    await expect(appModeStorage.load('user-a')).resolves.toBe('retail');
    await expect(appModeStorage.load('user-b')).resolves.toBe('wholesale');
    expect(storage.setItem).toHaveBeenCalledWith(appModeStorageKey('user-a'), 'retail');
  });

  it('falls back to wholesale for an invalid saved value', async () => {
    const storage = createStorage({ [appModeStorageKey('user-a')]: 'invalid' });
    const appModeStorage = new AppModeStorage(storage);

    await expect(appModeStorage.load('user-a')).resolves.toBe('wholesale');
  });
});
