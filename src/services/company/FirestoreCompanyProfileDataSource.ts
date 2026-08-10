import type { CompanyProfile } from './CompanyProfileStorage';

export type FirestoreCompanyProfileDocument = {
  legalName?: unknown;
  tradeName?: unknown;
  taxId?: unknown;
  address?: unknown;
  updatedAt?: unknown;
};

export function companyProfileFromFirestore(
  value: FirestoreCompanyProfileDocument,
): CompanyProfile {
  return {
    legalName: typeof value.legalName === 'string' ? value.legalName : '',
    tradeName: typeof value.tradeName === 'string' ? value.tradeName : '',
    taxId: typeof value.taxId === 'string' ? value.taxId : '',
    address: typeof value.address === 'string' ? value.address : '',
  };
}

export function companyProfileToFirestore(
  profile: CompanyProfile,
): Pick<FirestoreCompanyProfileDocument, 'legalName' | 'tradeName' | 'taxId' | 'address'> {
  return {
    legalName: profile.legalName,
    tradeName: profile.tradeName,
    taxId: profile.taxId,
    address: profile.address,
  };
}

export function companyProfileDocumentPath(uid: string): readonly string[] {
  return ['users', uid, 'settings', 'company'];
}

async function documentFor(uid: string) {
  const { doc } = await import('firebase/firestore');
  const { getFirebaseFirestore } = await import('@/services/firebase/firestore');
  return doc(getFirebaseFirestore(), 'users', uid, 'settings', 'company');
}

export class FirestoreCompanyProfileDataSource {
  public async load(uid: string): Promise<CompanyProfile | undefined> {
    const { getDoc } = await import('firebase/firestore');
    const snapshot = await getDoc(await documentFor(uid));
    if (!snapshot.exists()) return undefined;
    return companyProfileFromFirestore(snapshot.data() as FirestoreCompanyProfileDocument);
  }

  public async save(uid: string, profile: CompanyProfile): Promise<void> {
    const { serverTimestamp, setDoc } = await import('firebase/firestore');
    await setDoc(
      await documentFor(uid),
      { ...companyProfileToFirestore(profile), updatedAt: serverTimestamp() },
      { merge: true },
    );
  }
}

export const firestoreCompanyProfileDataSource = new FirestoreCompanyProfileDataSource();
