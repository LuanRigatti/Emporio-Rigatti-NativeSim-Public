import { MockSessionStore } from '@/providers/MockSessionStore';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
  },
}));

describe('MockSessionStore', () => {
  it('starts unauthenticated and exposes the same state through checkAuthentication', async () => {
    const session = new MockSessionStore(0);

    await expect(session.checkAuthentication()).resolves.toBe(false);
    expect(session.isAuthenticated).toBe(false);
  });

  it('shares sign-in and sign-out state through one session source', async () => {
    const session = new MockSessionStore(0);

    await session.signInWithGoogleMock();
    expect(await session.checkAuthentication()).toBe(true);

    await session.signOutMock();
    expect(await session.checkAuthentication()).toBe(false);
  });

  it('keeps a stable mock user identity after restoring the session', async () => {
    const stored = JSON.stringify({
      displayName: 'Usuário Mock',
      email: 'mock@pareact.local',
      id: 'mock-user-1',
      phoneNumber: null,
      photoUrl: null,
    });
    const storage = {
      getItem: jest.fn(async () => stored),
      setItem: jest.fn(async () => undefined),
    };
    const session = new MockSessionStore(0, storage);

    await session.checkAuthentication();

    expect(session.getCurrentUser()?.id).toBe('mock-user-1');
    expect(session.getCurrentUser()?.id).toBe(session.getCurrentUser()?.id);
  });
});
