import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';

import { assertFirestoreUid } from '@/services/database/firestorePaths';

import {
  firestoreBackupFileService,
  type GeneratedFirestoreBackupFile,
} from './FirestoreBackupFileService';

const BACKUP_VERSION = 1 as const;
const SCHEMA_VERSION = 1 as const;

type FirestoreData = Readonly<Record<string, unknown>>;

export type FirestoreBackupDocument = {
  id: string;
  data: FirestoreData;
};

export type FirestoreBackupReceipt = FirestoreBackupDocument & {
  payments: readonly FirestoreBackupDocument[];
};

export type FirestoreBackupSettings = {
  factory: FirestoreData | null;
  car: FirestoreData | null;
  company: FirestoreData | null;
};

export type FirestoreBackupSnapshot = {
  clients: readonly FirestoreBackupDocument[];
  deliveries: readonly FirestoreBackupDocument[];
  factoryReceipts: readonly FirestoreBackupReceipt[];
  dailyData: readonly FirestoreBackupDocument[];
  monthlyData: readonly FirestoreBackupDocument[];
  settings: FirestoreBackupSettings;
};

export type FirestoreBackupCounts = {
  clients: number;
  deliveries: number;
  factoryReceipts: number;
  factoryPayments: number;
  dailyData: number;
  monthlyData: number;
  settings: {
    factory: number;
    car: number;
    company: number;
  };
};

export type FirestoreBackupPayload = {
  backupVersion: typeof BACKUP_VERSION;
  schemaVersion: typeof SCHEMA_VERSION;
  exportedAt: string;
  uid: string;
  appData: {
    clients: Record<string, FirestoreData>;
    deliveries: Record<string, FirestoreData>;
    factoryReceipts: Record<
      string,
      {
        data: FirestoreData;
        payments: Record<string, FirestoreData>;
      }
    >;
    dailyData: Record<string, FirestoreData>;
    monthlyData: Record<string, FirestoreData>;
    settings: FirestoreBackupSettings;
  };
  metadata: {
    counts: FirestoreBackupCounts;
    checksumSha256?: string;
    checksumScope?: 'payload-without-checksum';
  };
};

export type FirestoreBackupExportResult = {
  fileName: string;
  exportedAt: string;
  checksumSha256: string;
  sizeBytes: number;
  counts: FirestoreBackupCounts;
};

export type FirestoreBackupServiceDependencies = {
  readSnapshot?: (uid: string) => Promise<FirestoreBackupSnapshot>;
  createFile?: (json: string, fileName: string) => Promise<GeneratedFirestoreBackupFile>;
  shareFile?: (file: GeneratedFirestoreBackupFile) => Promise<void>;
  releaseFile?: (file: GeneratedFirestoreBackupFile) => void;
};

type CreateBackupFile = (json: string, fileName: string) => Promise<GeneratedFirestoreBackupFile>;
type ShareBackupFile = (file: GeneratedFirestoreBackupFile) => Promise<void>;
type ReleaseBackupFile = (file: GeneratedFirestoreBackupFile) => void;

type FirestoreTimestampLike = {
  seconds: number;
  nanoseconds: number;
  toDate: () => Date;
};

function isTimestamp(value: object): value is FirestoreTimestampLike {
  const candidate = value as Partial<FirestoreTimestampLike>;
  return (
    typeof candidate.seconds === 'number' &&
    typeof candidate.nanoseconds === 'number' &&
    typeof candidate.toDate === 'function'
  );
}

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function serializeFirestoreValue(value: unknown): unknown {
  if (value === undefined) return { __firestoreType: 'undefined' };
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('O backup encontrou um número Firestore não finito.');
    }
    return value;
  }
  if (value instanceof Date) {
    return { __firestoreType: 'date', value: value.toISOString() };
  }
  if (Array.isArray(value)) return value.map(serializeFirestoreValue);
  if (typeof value !== 'object') {
    throw new Error('O backup encontrou um valor Firestore não serializável.');
  }
  if (isTimestamp(value)) {
    return {
      __firestoreType: 'timestamp',
      nanoseconds: value.nanoseconds,
      seconds: value.seconds,
    };
  }
  if (!isPlainObject(value)) {
    throw new Error('O backup encontrou um tipo Firestore não suportado.');
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [key, serializeFirestoreValue(nestedValue)]),
  );
}

export function serializeFirestoreDocument(data: Readonly<Record<string, unknown>>): FirestoreData {
  return serializeFirestoreValue(data) as FirestoreData;
}

function documentsToMap(
  documents: readonly FirestoreBackupDocument[],
): Record<string, FirestoreData> {
  return Object.fromEntries(documents.map((document) => [document.id, document.data]));
}

function receiptsToMap(
  receipts: readonly FirestoreBackupReceipt[],
): FirestoreBackupPayload['appData']['factoryReceipts'] {
  return Object.fromEntries(
    receipts.map((receipt) => [
      receipt.id,
      {
        data: receipt.data,
        payments: documentsToMap(receipt.payments),
      },
    ]),
  );
}

export function countFirestoreBackupSnapshot(
  snapshot: FirestoreBackupSnapshot,
): FirestoreBackupCounts {
  return {
    clients: snapshot.clients.length,
    deliveries: snapshot.deliveries.length,
    factoryReceipts: snapshot.factoryReceipts.length,
    factoryPayments: snapshot.factoryReceipts.reduce(
      (total, receipt) => total + receipt.payments.length,
      0,
    ),
    dailyData: snapshot.dailyData.length,
    monthlyData: snapshot.monthlyData.length,
    settings: {
      factory: snapshot.settings.factory ? 1 : 0,
      car: snapshot.settings.car ? 1 : 0,
      company: snapshot.settings.company ? 1 : 0,
    },
  };
}

export function buildFirestoreBackupPayload(
  uid: string,
  exportedAt: string,
  snapshot: FirestoreBackupSnapshot,
): FirestoreBackupPayload {
  assertFirestoreUid(uid);
  return {
    appData: {
      clients: documentsToMap(snapshot.clients),
      dailyData: documentsToMap(snapshot.dailyData),
      deliveries: documentsToMap(snapshot.deliveries),
      factoryReceipts: receiptsToMap(snapshot.factoryReceipts),
      monthlyData: documentsToMap(snapshot.monthlyData),
      settings: snapshot.settings,
    },
    backupVersion: BACKUP_VERSION,
    exportedAt,
    metadata: { counts: countFirestoreBackupSnapshot(snapshot) },
    schemaVersion: SCHEMA_VERSION,
    uid,
  };
}

function sameCounts(left: FirestoreBackupCounts, right: FirestoreBackupCounts): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function countsFromPayload(payload: FirestoreBackupPayload): FirestoreBackupCounts {
  const factoryReceipts = Object.values(payload.appData.factoryReceipts);
  return {
    clients: Object.keys(payload.appData.clients).length,
    deliveries: Object.keys(payload.appData.deliveries).length,
    factoryReceipts: factoryReceipts.length,
    factoryPayments: factoryReceipts.reduce(
      (total, receipt) => total + Object.keys(receipt.payments).length,
      0,
    ),
    dailyData: Object.keys(payload.appData.dailyData).length,
    monthlyData: Object.keys(payload.appData.monthlyData).length,
    settings: {
      factory: payload.appData.settings.factory ? 1 : 0,
      car: payload.appData.settings.car ? 1 : 0,
      company: payload.appData.settings.company ? 1 : 0,
    },
  };
}

function fileNameFor(date: Date): string {
  const stamp = date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  return `backup-firestore-${stamp}.json`;
}

export async function readFirestoreBackupSnapshot(uid: string): Promise<FirestoreBackupSnapshot> {
  assertFirestoreUid(uid);
  const { collection, doc, getDoc, getDocs } = await import('firebase/firestore');
  const { getFirebaseFirestore } = await import('@/services/firebase/firestore');
  const firestore = getFirebaseFirestore();
  const userRoot = doc(firestore, 'users', uid);
  const [clients, deliveries, factoryReceipts, dailyData, monthlyData, factory, car, company] =
    await Promise.all([
      getDocs(collection(userRoot, 'clients')),
      getDocs(collection(userRoot, 'deliveries')),
      getDocs(collection(userRoot, 'factoryReceipts')),
      getDocs(collection(userRoot, 'dailyData')),
      getDocs(collection(userRoot, 'monthlyData')),
      getDoc(doc(userRoot, 'settings', 'factory')),
      getDoc(doc(userRoot, 'settings', 'car')),
      getDoc(doc(userRoot, 'settings', 'company')),
    ]);

  const mappedFactoryReceipts = await Promise.all(
    factoryReceipts.docs.map(async (receipt) => {
      const payments = await getDocs(collection(receipt.ref, 'payments'));
      return {
        data: serializeFirestoreDocument(receipt.data()),
        id: receipt.id,
        payments: payments.docs.map((payment) => ({
          data: serializeFirestoreDocument(payment.data()),
          id: payment.id,
        })),
      } satisfies FirestoreBackupReceipt;
    }),
  );

  const mapDocuments = (result: {
    docs: readonly { id: string; data: () => Record<string, unknown> }[];
  }) =>
    result.docs.map((document) => ({
      data: serializeFirestoreDocument(document.data()),
      id: document.id,
    }));

  return {
    clients: mapDocuments(clients),
    dailyData: mapDocuments(dailyData),
    deliveries: mapDocuments(deliveries),
    factoryReceipts: mappedFactoryReceipts,
    monthlyData: mapDocuments(monthlyData),
    settings: {
      car: car.exists() ? serializeFirestoreDocument(car.data() ?? {}) : null,
      company: company.exists() ? serializeFirestoreDocument(company.data() ?? {}) : null,
      factory: factory.exists() ? serializeFirestoreDocument(factory.data() ?? {}) : null,
    },
  };
}

export class FirestoreBackupService {
  private readonly readSnapshot: (uid: string) => Promise<FirestoreBackupSnapshot>;
  private readonly createFile: CreateBackupFile;
  private readonly shareFile: ShareBackupFile;
  private readonly releaseFile: ReleaseBackupFile;

  public constructor(
    private readonly uid: string,
    dependencies: FirestoreBackupServiceDependencies = {},
  ) {
    assertFirestoreUid(uid);
    this.readSnapshot = dependencies.readSnapshot ?? readFirestoreBackupSnapshot;
    this.createFile =
      dependencies.createFile ??
      ((json, fileName) => firestoreBackupFileService.create(json, fileName));
    this.shareFile = dependencies.shareFile ?? ((file) => firestoreBackupFileService.share(file));
    this.releaseFile =
      dependencies.releaseFile ?? ((file) => firestoreBackupFileService.release(file));
  }

  public async exportBackup(): Promise<FirestoreBackupExportResult> {
    const date = new Date();
    const exportedAt = date.toISOString();
    const snapshot = await this.readSnapshot(this.uid);
    const payload = buildFirestoreBackupPayload(this.uid, exportedAt, snapshot);
    const checksumInput = JSON.stringify(payload, null, 2);
    const checksumSha256 = await digestStringAsync(CryptoDigestAlgorithm.SHA256, checksumInput);
    const finalPayload: FirestoreBackupPayload = {
      ...payload,
      metadata: {
        ...payload.metadata,
        checksumScope: 'payload-without-checksum',
        checksumSha256,
      },
    };
    const json = JSON.stringify(finalPayload, null, 2);
    const parsed = JSON.parse(json) as FirestoreBackupPayload;
    const parsedCounts = countsFromPayload(parsed);
    if (!sameCounts(payload.metadata.counts, parsedCounts)) {
      throw new Error('A contagem lida não corresponde à contagem exportada.');
    }

    let generated: GeneratedFirestoreBackupFile | undefined;
    try {
      generated = await this.createFile(json, fileNameFor(date));
      await this.shareFile(generated);
      return {
        checksumSha256,
        counts: payload.metadata.counts,
        exportedAt,
        fileName: generated.fileName,
        sizeBytes: generated.sizeBytes,
      };
    } finally {
      if (generated) this.releaseFile(generated);
    }
  }
}

export function createFirestoreBackupService(
  uid: string,
  dependencies?: FirestoreBackupServiceDependencies,
): FirestoreBackupService {
  return new FirestoreBackupService(uid, dependencies);
}
