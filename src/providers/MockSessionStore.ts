import { MockAuthDataSource } from '@/services/auth/MockAuthDataSource';

export type MockSessionListener = () => void;

/**
 * Compatibility facade for older callers. The active provider uses
 * MockAuthDataSource directly.
 */
export class MockSessionStore extends MockAuthDataSource {
  public get isAuthenticated(): boolean {
    return Boolean(this.getCurrentUser());
  }

  public async checkAuthentication(): Promise<boolean> {
    await this.restore();
    return this.isAuthenticated;
  }

  public async signInWithGoogleMock(): Promise<void> {
    await this.signInWithGooglePopup();
  }

  public async signOutMock(): Promise<void> {
    await this.signOut();
  }
}

export const mockSessionStore = new MockSessionStore();
