jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      clear: jest.fn(async () => {
        store.clear();
      }),
      getItem: jest.fn(async (key: string) => store.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
    },
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  FINANCIAL_PRIVACY_STORAGE_KEY,
  loadFinancialPrivacy,
  saveFinancialPrivacy,
} from '@/services/privacy';

describe('FinancialPrivacyStorage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('defaults to visible values when no preference exists', async () => {
    await expect(loadFinancialPrivacy()).resolves.toBe(false);
  });

  it('persists and restores the hidden preference locally', async () => {
    await saveFinancialPrivacy(true);
    expect(await AsyncStorage.getItem(FINANCIAL_PRIVACY_STORAGE_KEY)).toBe('true');
    await expect(loadFinancialPrivacy()).resolves.toBe(true);

    await saveFinancialPrivacy(false);
    await expect(loadFinancialPrivacy()).resolves.toBe(false);
  });
});
