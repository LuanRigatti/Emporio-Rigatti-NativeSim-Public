import AsyncStorage from '@react-native-async-storage/async-storage';

export const TEST_MODE_STORAGE_KEY = '@pareact/test-mode-enabled-v1';

type Listener = (enabled: boolean) => void;

export class TestModeStorage {
  private cachedValue: boolean | undefined;
  private loadPromise: Promise<boolean> | null = null;
  private readonly listeners = new Set<Listener>();

  public getCached(): boolean | undefined {
    return this.cachedValue;
  }

  public async load(): Promise<boolean> {
    if (this.cachedValue !== undefined) return this.cachedValue;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = AsyncStorage.getItem(TEST_MODE_STORAGE_KEY)
      .then((value) => value === 'true')
      .catch(() => false)
      .then((enabled) => {
        this.cachedValue = enabled;
        this.notify(enabled);
        return enabled;
      })
      .finally(() => {
        this.loadPromise = null;
      });

    return this.loadPromise;
  }

  public async save(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(TEST_MODE_STORAGE_KEY, String(enabled));
    this.cachedValue = enabled;
    this.notify(enabled);
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(enabled: boolean) {
    this.listeners.forEach((listener) => listener(enabled));
  }
}

export const testModeStorage = new TestModeStorage();
