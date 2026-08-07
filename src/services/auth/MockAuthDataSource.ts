import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AuthDataSource, AuthStateListener, AuthUser } from './types';

export const MOCK_AUTH_SESSION_STORAGE_KEY = '@pareact/mock-auth-session-v1';

type AuthStorage = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;

const MOCK_USER: AuthUser = {
  displayName: 'Usuário Mock',
  email: 'mock@pareact.local',
  id: 'mock-user-1',
  phoneNumber: null,
  photoUrl: null,
};

function parseUser(value: string | null): AuthUser | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const record = parsed as Partial<AuthUser>;
    if (typeof record.id !== 'string' || !record.id.trim()) return null;

    return {
      displayName: typeof record.displayName === 'string' ? record.displayName : null,
      email: typeof record.email === 'string' ? record.email : null,
      id: record.id,
      phoneNumber: typeof record.phoneNumber === 'string' ? record.phoneNumber : null,
      photoUrl: typeof record.photoUrl === 'string' ? record.photoUrl : null,
    };
  } catch {
    return null;
  }
}

export class MockAuthDataSource implements AuthDataSource {
  private currentUser: AuthUser | null = null;
  private hasLocalMutation = false;
  private readonly listeners = new Set<AuthStateListener>();
  private restorePromise: Promise<void> | null = null;

  public constructor(
    private readonly signInDelayMs = 1000,
    private readonly storage: AuthStorage = AsyncStorage,
  ) {}

  public getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  public subscribe(listener: AuthStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public async restore(): Promise<void> {
    if (this.restorePromise) return this.restorePromise;

    this.restorePromise = this.storage
      .getItem(MOCK_AUTH_SESSION_STORAGE_KEY)
      .then((value) => {
        if (!this.hasLocalMutation) this.setUserValue(parseUser(value), false);
      })
      .catch(() => {
        if (!this.hasLocalMutation) this.setUserValue(null, false);
      });

    return this.restorePromise;
  }

  public async signIn(email: string, _password: string): Promise<AuthUser> {
    await this.delay();
    const user = { ...MOCK_USER, email: email.trim() || MOCK_USER.email };
    this.setUser(user);
    return user;
  }

  public async signInWithGooglePopup(): Promise<AuthUser> {
    await this.delay();
    this.setUser(MOCK_USER);
    return MOCK_USER;
  }

  public async signInWithGoogleNative(): Promise<AuthUser> {
    return this.signInWithGooglePopup();
  }

  public async signInWithGoogleCredential(): Promise<AuthUser> {
    await this.delay();
    this.setUser(MOCK_USER);
    return MOCK_USER;
  }

  public async signOut(): Promise<void> {
    this.setUser(null);
  }

  private async delay(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, this.signInDelayMs));
  }

  private setUser(nextUser: AuthUser | null): void {
    this.setUserValue(nextUser, true);
  }

  private setUserValue(nextUser: AuthUser | null, persist: boolean): void {
    if (persist) this.hasLocalMutation = true;
    this.currentUser = nextUser;
    this.listeners.forEach((listener) => listener(nextUser));
    if (persist) {
      void this.storage.setItem(MOCK_AUTH_SESSION_STORAGE_KEY, JSON.stringify(nextUser));
    }
  }
}

export const mockAuthDataSource = new MockAuthDataSource();
