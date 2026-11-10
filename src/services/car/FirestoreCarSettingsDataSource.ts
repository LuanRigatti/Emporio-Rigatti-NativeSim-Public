import type { DocumentSnapshot } from 'firebase/firestore';

import { EMPTY_CAR_SETTINGS, type CarSettings } from './CarSettings';

export type FirestoreCarSettingsDocument = {
  gasolineAutonomy?: unknown;
  alcoholAutonomy?: unknown;
  updatedAt?: unknown;
};

export type FirestoreCarSettingsLoadResult = {
  exists: boolean;
  settings: CarSettings;
  source: 'server' | 'pending' | 'cache';
};

export type FirestoreCarSettingsMutationOptions = {
  canRun?: () => boolean;
  canPersist?: () => boolean;
};

export type FirestoreCarSettingsWriteResult =
  { kind: 'patch'; changes: Partial<CarSettings> } | { kind: 'snapshot'; settings: CarSettings };

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

export function carSettingsDocumentPath(
  uid: string,
): readonly ['users', string, 'settings', 'car'] {
  return ['users', uid, 'settings', 'car'];
}

function firestoreModule(): typeof import('firebase/firestore') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('firebase/firestore') as typeof import('firebase/firestore');
}

function firebaseFirestoreModule(): typeof import('@/services/firebase/firestore') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/services/firebase/firestore') as typeof import('@/services/firebase/firestore');
}

function documentFor(uid: string) {
  const { doc } = firestoreModule();
  const { getFirebaseFirestore } = firebaseFirestoreModule();
  return doc(getFirebaseFirestore(), ...carSettingsDocumentPath(uid));
}

function readSnapshot(snapshot: DocumentSnapshot): FirestoreCarSettingsLoadResult {
  const exists = snapshot.exists();
  const { fromCache, hasPendingWrites } = snapshot.metadata;
  return {
    exists,
    settings: exists
      ? carSettingsFromFirestore(snapshot.data() as FirestoreCarSettingsDocument)
      : { ...EMPTY_CAR_SETTINGS },
    source: hasPendingWrites ? 'pending' : fromCache ? 'cache' : 'server',
  };
}

export class FirestoreCarSettingsDataSource {
  public async load(uid: string): Promise<CarSettings | undefined> {
    const { getDoc } = firestoreModule();
    const snapshot = await getDoc(documentFor(uid));
    const result = readSnapshot(snapshot);
    return result.source === 'server' && result.exists ? result.settings : undefined;
  }

  public async loadWithMetadata(
    uid: string,
    options?: FirestoreCarSettingsMutationOptions,
  ): Promise<FirestoreCarSettingsLoadResult | undefined> {
    if (options?.canRun && !options.canRun()) return undefined;
    const { getDocFromServer } = firestoreModule();
    const snapshot = await getDocFromServer(documentFor(uid));
    if (options?.canRun && !options.canRun()) return undefined;
    return readSnapshot(snapshot);
  }

  public watchForConfirmation(
    uid: string,
    onConfirmed: (result: FirestoreCarSettingsLoadResult) => void,
    onError: (error: unknown) => void,
  ): () => void {
    const { onSnapshot } = firestoreModule();
    return onSnapshot(
      documentFor(uid),
      { includeMetadataChanges: true },
      (snapshot) => {
        const result = readSnapshot(snapshot);
        if (result.source === 'server') onConfirmed(result);
      },
      onError,
    );
  }

  public async save(uid: string, settings: CarSettings): Promise<void> {
    await this.saveFields(uid, settings, true);
  }

  public saveFields(
    uid: string,
    changes: Partial<CarSettings>,
    allowCreate: boolean,
    options?: FirestoreCarSettingsMutationOptions,
  ): Promise<FirestoreCarSettingsWriteResult | undefined> {
    const fields = Object.fromEntries(
      Object.entries(changes).filter(
        ([field, value]) =>
          (field === 'gasolineAutonomy' || field === 'alcoholAutonomy') &&
          typeof value === 'string',
      ),
    ) as Partial<CarSettings>;
    if (Object.keys(fields).length === 0) return Promise.resolve(undefined);

    if (options?.canRun && !options.canRun()) return Promise.resolve(undefined);
    if (options?.canPersist && !options.canPersist()) return Promise.resolve(undefined);
    const { runTransaction, serverTimestamp, updateDoc } = firestoreModule();
    const reference = documentFor(uid);
    const payload = { ...fields, updatedAt: serverTimestamp() };
    if (!allowCreate) {
      const update = () =>
        updateDoc(reference, payload).then(() => {
          if (options?.canPersist && !options.canPersist()) return undefined;
          return { kind: 'patch' as const, changes: fields };
        });
      const pendingCreate = this.mutationQueues.get(uid);
      if (!pendingCreate) return update();
      return pendingCreate.then(() => {
        if (options?.canPersist && !options.canPersist()) return undefined;
        return update();
      });
    }

    const previous = this.mutationQueues.get(uid) ?? Promise.resolve();
    const write = previous
      .catch(() => undefined)
      .then(() => {
        if (options?.canPersist && !options.canPersist()) return undefined;
        const { getFirebaseFirestore } = firebaseFirestoreModule();
        return runTransaction(getFirebaseFirestore(), async (transaction) => {
          if (options?.canPersist && !options.canPersist()) return;
          const snapshot = await transaction.get(reference);
          if (options?.canPersist && !options.canPersist()) return;
          const exists = snapshot.exists();
          const base = exists
            ? carSettingsFromFirestore(snapshot.data() as FirestoreCarSettingsDocument)
            : EMPTY_CAR_SETTINGS;
          if (exists) transaction.update(reference, payload);
          else {
            transaction.set(
              reference,
              {
                ...EMPTY_CAR_SETTINGS,
                ...payload,
              },
              { merge: true },
            );
          }
          return { kind: 'snapshot' as const, settings: { ...base, ...fields } };
        });
      });
    const validatedWrite = write.then((result) => {
      if (options?.canPersist && !options.canPersist()) return undefined;
      return result;
    });
    const recovered = validatedWrite.then(
      () => undefined,
      () => undefined,
    );
    this.mutationQueues.set(uid, recovered);
    void recovered.finally(() => {
      if (this.mutationQueues.get(uid) === recovered) this.mutationQueues.delete(uid);
    });
    return validatedWrite;
  }

  private readonly mutationQueues = new Map<string, Promise<void>>();
}

export const firestoreCarSettingsDataSource = new FirestoreCarSettingsDataSource();
