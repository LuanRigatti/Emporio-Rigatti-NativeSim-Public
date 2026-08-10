import type { CarSettings } from './CarSettingsStorage';

export type FirestoreCarSettingsDocument = {
  gasolineAutonomy?: unknown;
  alcoholAutonomy?: unknown;
  updatedAt?: unknown;
};

export function carSettingsFromFirestore(value: FirestoreCarSettingsDocument): CarSettings {
  return {
    gasolineAutonomy: typeof value.gasolineAutonomy === 'string' ? value.gasolineAutonomy : '',
    alcoholAutonomy: typeof value.alcoholAutonomy === 'string' ? value.alcoholAutonomy : '',
  };
}

export function carSettingsToFirestore(
  settings: CarSettings,
): Pick<FirestoreCarSettingsDocument, 'gasolineAutonomy' | 'alcoholAutonomy'> {
  return {
    gasolineAutonomy: settings.gasolineAutonomy,
    alcoholAutonomy: settings.alcoholAutonomy,
  };
}

export function carSettingsDocumentPath(uid: string): readonly string[] {
  return ['users', uid, 'settings', 'car'];
}

async function documentFor(uid: string) {
  const { doc } = await import('firebase/firestore');
  const { getFirebaseFirestore } = await import('@/services/firebase/firestore');
  return doc(getFirebaseFirestore(), 'users', uid, 'settings', 'car');
}

export class FirestoreCarSettingsDataSource {
  public async load(uid: string): Promise<CarSettings | undefined> {
    const { getDoc } = await import('firebase/firestore');
    const snapshot = await getDoc(await documentFor(uid));
    if (!snapshot.exists()) return undefined;
    return carSettingsFromFirestore(snapshot.data() as FirestoreCarSettingsDocument);
  }

  public async save(uid: string, settings: CarSettings): Promise<void> {
    const { serverTimestamp, setDoc } = await import('firebase/firestore');
    await setDoc(
      await documentFor(uid),
      { ...carSettingsToFirestore(settings), updatedAt: serverTimestamp() },
      { merge: true },
    );
  }
}

export const firestoreCarSettingsDataSource = new FirestoreCarSettingsDataSource();
