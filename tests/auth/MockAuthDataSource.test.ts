import { MockAuthDataSource } from '@/services/auth/MockAuthDataSource';
import { authDataSource, mockAuthDataSource } from '@/services/auth/AuthDataSource';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('@/services/auth/FirebaseAuthDataSource', () => ({
  FirebaseAuthDataSource: jest.fn(),
  firebaseAuthDataSource: {},
}));

function storage(initialValue: string | null = null) {
  let value = initialValue;
  return {
    getItem: jest.fn(async () => value),
    setItem: jest.fn(async (_key: string, nextValue: string) => {
      value = nextValue;
    }),
  };
}

describe('MockAuthDataSource', () => {
  it('is the active data source while Firebase Auth is disabled', () => {
    expect(authDataSource).toBe(mockAuthDataSource);
  });

  it('starts unauthenticated and signs in with a stable user id', async () => {
    const source = new MockAuthDataSource(0, storage());
    const updates: string[] = [];

    source.subscribe((user) => updates.push(user?.id ?? 'none'));
    expect(source.getCurrentUser()).toBeNull();

    await source.signInWithGooglePopup();

    expect(source.getCurrentUser()).toMatchObject({ id: 'mock-user-1' });
    expect(updates).toEqual(['mock-user-1']);
  });

  it('restores the persisted session and removes it on logout', async () => {
    const firstStorage = storage();
    const firstSource = new MockAuthDataSource(0, firstStorage);
    await firstSource.signInWithGooglePopup();

    const secondSource = new MockAuthDataSource(0, {
      getItem: firstStorage.getItem,
      setItem: firstStorage.setItem,
    });
    await secondSource.restore();
    expect(secondSource.getCurrentUser()?.id).toBe('mock-user-1');

    await secondSource.signOut();
    expect(secondSource.getCurrentUser()).toBeNull();
  });
});
