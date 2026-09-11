import AsyncStorage from '@react-native-async-storage/async-storage';

export const COMPANY_PROFILE_STORAGE_KEY = '@pareact/company-profile-v1';

export type CompanyProfile = {
  legalName: string;
  tradeName: string;
  taxId: string;
  address: string;
};

export const EMPTY_COMPANY_PROFILE: CompanyProfile = {
  address: '',
  legalName: '',
  taxId: '',
  tradeName: '',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseProfile(serialized: string | null): CompanyProfile | null {
  if (!serialized) return null;

  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!isRecord(parsed)) return null;

    return {
      address: typeof parsed.address === 'string' ? parsed.address : '',
      legalName: typeof parsed.legalName === 'string' ? parsed.legalName : '',
      taxId: typeof parsed.taxId === 'string' ? parsed.taxId : '',
      tradeName: typeof parsed.tradeName === 'string' ? parsed.tradeName : '',
    };
  } catch {
    return null;
  }
}

export class CompanyProfileStorage {
  private writeQueue = Promise.resolve();

  public async load(): Promise<CompanyProfile> {
    try {
      return (
        parseProfile(await AsyncStorage.getItem(COMPANY_PROFILE_STORAGE_KEY)) ?? {
          ...EMPTY_COMPANY_PROFILE,
        }
      );
    } catch (error) {
      if (__DEV__) console.warn('[CompanyProfileStorage] Falha ao ler dados da empresa.', error);
      return { ...EMPTY_COMPANY_PROFILE };
    }
  }

  public save(profile: CompanyProfile): Promise<void> {
    const serialized = JSON.stringify(profile);
    this.writeQueue = this.writeQueue
      .then(() => AsyncStorage.setItem(COMPANY_PROFILE_STORAGE_KEY, serialized))
      .catch((error) => {
        if (__DEV__)
          console.warn('[CompanyProfileStorage] Falha ao salvar dados da empresa.', error);
      });
    return this.writeQueue;
  }
}

export const companyProfileStorage = new CompanyProfileStorage();
