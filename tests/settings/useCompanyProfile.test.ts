import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement } from 'react';

import { useCompanyProfile } from '@/hooks/useCompanyProfile';
import {
  companyProfileStorage,
  firestoreCompanyProfileDataSource,
  type CompanyProfile,
} from '@/services/company';

jest.mock('@/config/featureFlags', () => ({ ENABLE_FIRESTORE_COMPANY_PROFILE: true }));
jest.mock('@/providers', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
jest.mock('@/services/company', () => ({
  companyProfileStorage: { load: jest.fn(), save: jest.fn() },
  EMPTY_COMPANY_PROFILE: { address: '', legalName: '', taxId: '', tradeName: '' },
  firestoreCompanyProfileDataSource: { load: jest.fn(), save: jest.fn() },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function profile(legalName: string): CompanyProfile {
  return {
    address: 'Endereço local',
    legalName,
    taxId: '123',
    tradeName: 'Nome fantasia',
  };
}

describe('useCompanyProfile hydration', () => {
  let hookResult!: ReturnType<typeof useCompanyProfile>;
  let renderer: ReactTestRenderer | undefined;

  function HookProbe() {
    hookResult = useCompanyProfile();
    return null;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(companyProfileStorage.save).mockResolvedValue(undefined);
    jest.mocked(firestoreCompanyProfileDataSource.save).mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (renderer) act(() => renderer?.unmount());
    renderer = undefined;
  });

  it('marks local hydration ready before the Firestore request resolves', async () => {
    const localLoad = deferred<CompanyProfile>();
    const remoteLoad = deferred<CompanyProfile | undefined>();
    jest.mocked(companyProfileStorage.load).mockReturnValue(localLoad.promise);
    jest.mocked(firestoreCompanyProfileDataSource.load).mockReturnValue(remoteLoad.promise);

    act(() => {
      renderer = create(createElement(HookProbe));
    });
    expect(hookResult.isHydrated).toBe(false);

    await act(async () => {
      localLoad.resolve(profile('Nome local'));
      await localLoad.promise;
    });

    expect(hookResult.isHydrated).toBe(true);
    expect(hookResult.profile.legalName).toBe('Nome local');
    expect(firestoreCompanyProfileDataSource.load).toHaveBeenCalledWith('user-1');
    await act(async () => {
      remoteLoad.resolve(undefined);
      await remoteLoad.promise;
    });
  });

  it('keeps a local edit made during Firestore loading and syncs it over the stale result', async () => {
    const localLoad = deferred<CompanyProfile>();
    const remoteLoad = deferred<CompanyProfile | undefined>();
    jest.mocked(companyProfileStorage.load).mockReturnValue(localLoad.promise);
    jest.mocked(firestoreCompanyProfileDataSource.load).mockReturnValue(remoteLoad.promise);

    act(() => {
      renderer = create(createElement(HookProbe));
    });
    await act(async () => {
      localLoad.resolve(profile('Nome local'));
      await localLoad.promise;
    });

    act(() => hookResult.updateField('legalName', 'Edição local'));
    await act(async () => {
      remoteLoad.resolve(profile('Resposta remota antiga'));
      await remoteLoad.promise;
      await Promise.resolve();
    });

    expect(hookResult.profile.legalName).toBe('Edição local');
    expect(firestoreCompanyProfileDataSource.save).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ legalName: 'Edição local' }),
    );
  });

  it('applies Firestore data when no local edit happened during its request', async () => {
    const localLoad = deferred<CompanyProfile>();
    const remoteLoad = deferred<CompanyProfile | undefined>();
    jest.mocked(companyProfileStorage.load).mockReturnValue(localLoad.promise);
    jest.mocked(firestoreCompanyProfileDataSource.load).mockReturnValue(remoteLoad.promise);

    act(() => {
      renderer = create(createElement(HookProbe));
    });
    await act(async () => {
      localLoad.resolve(profile('Nome local'));
      await localLoad.promise;
    });
    await act(async () => {
      remoteLoad.resolve(profile('Nome remoto atualizado'));
      await remoteLoad.promise;
      await Promise.resolve();
    });

    expect(hookResult.profile.legalName).toBe('Nome remoto atualizado');
    expect(hookResult.isHydrated).toBe(true);
    expect(firestoreCompanyProfileDataSource.save).not.toHaveBeenCalled();
  });
});
