import AsyncStorage from '@react-native-async-storage/async-storage';

export const FINANCIAL_PRIVACY_STORAGE_KEY = '@pareact/financial-values-hidden';

function parseStoredValue(value: string | null): boolean {
  return value === 'true';
}

export async function loadFinancialPrivacy(): Promise<boolean> {
  return parseStoredValue(await AsyncStorage.getItem(FINANCIAL_PRIVACY_STORAGE_KEY));
}

export async function saveFinancialPrivacy(hidden: boolean): Promise<void> {
  await AsyncStorage.setItem(FINANCIAL_PRIVACY_STORAGE_KEY, String(hidden));
}
