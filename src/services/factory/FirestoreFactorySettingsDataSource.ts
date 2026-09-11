import type { FactorySettings } from './FactorySettingsStorage';

export type FirestoreFactorySettingsDocument = {
  bucketCost?: unknown;
  updatedAt?: unknown;
};

export function factorySettingsFromFirestore(
  value: FirestoreFactorySettingsDocument,
): FactorySettings {
  return { bucketCost: typeof value.bucketCost === 'string' ? value.bucketCost : '' };
}

export function factorySettingsToFirestore(
  settings: FactorySettings,
): Pick<FirestoreFactorySettingsDocument, 'bucketCost'> {
  return { bucketCost: settings.bucketCost };
}

export function factorySettingsDocumentPath(uid: string): readonly string[] {
  return ['users', uid, 'settings', 'factory'];
}

async function documentFor(uid: string) {
  const { doc } = await import('firebase/firestore');
  const { getFirebaseFirestore } = await import('@/services/firebase/firestore');
  return doc(getFirebaseFirestore(), 'users', uid, 'settings', 'factory');
}

export class FirestoreFactorySettingsDataSource {
  public async load(uid: string): Promise<FactorySettings | undefined> {
    const { getDoc } = await import('firebase/firestore');
    const snapshot = await getDoc(await documentFor(uid));
    if (!snapshot.exists()) return undefined;
    return factorySettingsFromFirestore(snapshot.data() as FirestoreFactorySettingsDocument);
  }

  public async save(uid: string, settings: FactorySettings): Promise<void> {
    const { serverTimestamp, setDoc } = await import('firebase/firestore');
    await setDoc(
      await documentFor(uid),
      { ...factorySettingsToFirestore(settings), updatedAt: serverTimestamp() },
      { merge: true },
    );
  }
}

export const firestoreFactorySettingsDataSource = new FirestoreFactorySettingsDataSource();
