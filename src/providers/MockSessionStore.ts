export type MockSessionListener = () => void;

export class MockSessionStore {
  private isAuthenticatedState = false;
  private readonly listeners = new Set<MockSessionListener>();

  public constructor(private readonly signInDelayMs = 1000) {}

  public get isAuthenticated(): boolean {
    return this.isAuthenticatedState;
  }

  public async checkAuthentication(): Promise<boolean> {
    return this.isAuthenticatedState;
  }

  public async signInWithGoogleMock(): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, this.signInDelayMs);
    });
    this.setAuthenticated(true);
  }

  public async signOutMock(): Promise<void> {
    this.setAuthenticated(false);
  }

  public subscribe(listener: MockSessionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setAuthenticated(nextValue: boolean): void {
    if (this.isAuthenticatedState === nextValue) return;

    this.isAuthenticatedState = nextValue;
    this.listeners.forEach((listener) => listener());
  }
}

export const mockSessionStore = new MockSessionStore();
