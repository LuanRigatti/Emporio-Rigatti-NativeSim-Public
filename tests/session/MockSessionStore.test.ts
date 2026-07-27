import { MockSessionStore } from '@/providers/MockSessionStore';

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
});
