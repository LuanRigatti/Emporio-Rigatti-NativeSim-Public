import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import { Timestamp } from 'firebase/firestore';

import {
  countFirestoreBackupSnapshot,
  type FirestoreBackupPayload,
  type FirestoreBackupSnapshot,
} from './FirestoreBackupService';
import { serializeFirestoreValue } from './FirestoreBackupService';

export type FirestoreBackupValidationIssue = {
  code:
    | 'invalid-json'
    | 'unsupported-backup-version'
    | 'unsupported-schema-version'
    | 'invalid-structure'
    | 'invalid-checksum'
    | 'uid-mismatch'
    | 'invalid-record';
  message: string;
  path?: string;
};

export type ValidatedFirestoreBackup = {
  payload: FirestoreBackupPayload | null;
  checksumValid: boolean;
  uidMatches: boolean;
  issues: readonly FirestoreBackupValidationIssue[];
  canCompare: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function addIssue(
  issues: FirestoreBackupValidationIssue[],
  code: FirestoreBackupValidationIssue['code'],
  message: string,
  path?: string,
): void {
  issues.push({ code, message, ...(path ? { path } : {}) });
}

function requireString(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: FirestoreBackupValidationIssue[],
): boolean {
  if (typeof value[key] !== 'string' || !value[key]) {
    addIssue(issues, 'invalid-record', `Campo obrigatório inválido: ${key}.`, path);
    return false;
  }
  return true;
}

function requireNumber(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: FirestoreBackupValidationIssue[],
): boolean {
  if (typeof value[key] !== 'number' || !Number.isFinite(value[key])) {
    addIssue(issues, 'invalid-record', `Campo numérico inválido: ${key}.`, path);
    return false;
  }
  return true;
}

function requireBoolean(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: FirestoreBackupValidationIssue[],
): boolean {
  if (typeof value[key] !== 'boolean') {
    addIssue(issues, 'invalid-record', `Campo booleano inválido: ${key}.`, path);
    return false;
  }
  return true;
}

function validateDocumentMap(
  value: unknown,
  entity: string,
  issues: FirestoreBackupValidationIssue[],
  validateData?: (data: Record<string, unknown>, path: string) => void,
): value is Record<string, Record<string, unknown>> {
  if (!isRecord(value)) {
    addIssue(issues, 'invalid-structure', `A coleção ${entity} deve ser um objeto.`);
    return false;
  }

  Object.entries(value).forEach(([id, data]) => {
    const path = `${entity}.${id}`;
    if (!id || !isRecord(data)) {
      addIssue(issues, 'invalid-record', 'Documento ou ID inválido.', path);
      return;
    }
    validateData?.(data, path);
  });
  return true;
}

function validDate(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function validMonth(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5));
  return month >= 1 && month <= 12;
}

function validateAppData(
  appData: unknown,
  issues: FirestoreBackupValidationIssue[],
): appData is FirestoreBackupPayload['appData'] {
  if (!isRecord(appData)) {
    addIssue(issues, 'invalid-structure', 'appData deve ser um objeto.');
    return false;
  }

  const issueCountBeforeAppData = issues.length;
  let valid = true;
  valid =
    validateDocumentMap(appData.clients, 'clients', issues, (data, path) => {
      requireString(data, 'name', path, issues);
      if (data.normalizedName !== undefined) requireString(data, 'normalizedName', path, issues);
      if (data.currentUnitPrice !== undefined)
        requireNumber(data, 'currentUnitPrice', path, issues);
    }) && valid;
  valid =
    validateDocumentMap(appData.deliveries, 'deliveries', issues, (data, path) => {
      requireString(data, 'clientId', path, issues);
      requireString(data, 'clientNameSnapshot', path, issues);
      requireString(data, 'date', path, issues);
      if (!validDate(data.date)) addIssue(issues, 'invalid-record', 'Data inválida.', path);
      requireNumber(data, 'quantity', path, issues);
      requireNumber(data, 'totalValue', path, issues);
      requireString(data, 'status', path, issues);
      requireBoolean(data, 'delivered', path, issues);
    }) && valid;
  valid =
    validateDocumentMap(appData.dailyData, 'dailyData', issues, (data, path) => {
      requireString(data, 'data', path, issues);
      if (!validDate(data.data)) addIssue(issues, 'invalid-record', 'Data inválida.', path);
    }) && valid;
  valid =
    validateDocumentMap(appData.monthlyData, 'monthlyData', issues, (data, path) => {
      requireString(data, 'month', path, issues);
      if (!validMonth(data.month)) addIssue(issues, 'invalid-record', 'Mês inválido.', path);
    }) && valid;

  if (!isRecord(appData.factoryReceipts)) {
    valid = false;
    addIssue(issues, 'invalid-structure', 'A coleção factoryReceipts deve ser um objeto.');
  } else {
    Object.entries(appData.factoryReceipts).forEach(([id, value]) => {
      const path = `factoryReceipts.${id}`;
      if (!id || !isRecord(value) || !isRecord(value.data) || !isRecord(value.payments)) {
        valid = false;
        addIssue(issues, 'invalid-record', 'Compra ou pagamentos inválidos.', path);
        return;
      }
      requireString(value.data, 'date', path, issues);
      if (!validDate(value.data.date)) addIssue(issues, 'invalid-record', 'Data inválida.', path);
      requireNumber(value.data, 'quantity', path, issues);
      requireNumber(value.data, 'totalValue', path, issues);
      requireBoolean(value.data, 'completed', path, issues);
      Object.entries(value.payments).forEach(([paymentId, payment]) => {
        const paymentPath = `${path}.payments.${paymentId}`;
        if (!paymentId || !isRecord(payment)) {
          valid = false;
          addIssue(issues, 'invalid-record', 'Pagamento inválido.', paymentPath);
          return;
        }
        requireString(payment, 'date', paymentPath, issues);
        if (!validDate(payment.date))
          addIssue(issues, 'invalid-record', 'Data inválida.', paymentPath);
        requireNumber(payment, 'amount', paymentPath, issues);
      });
    });
  }

  const settings = appData.settings as unknown;
  if (!isRecord(settings)) {
    valid = false;
    addIssue(issues, 'invalid-structure', 'settings deve ser um objeto.');
  } else {
    (['factory', 'car', 'company'] as const).forEach((key) => {
      if (settings[key] !== null && !isRecord(settings[key])) {
        valid = false;
        addIssue(issues, 'invalid-record', `Configuração ${key} inválida.`, `settings.${key}`);
      }
    });
  }

  return valid && issues.length === issueCountBeforeAppData;
}

function validateCounts(
  payload: FirestoreBackupPayload,
  issues: FirestoreBackupValidationIssue[],
): void {
  if (!isRecord(payload.metadata) || !isRecord(payload.metadata.counts)) {
    addIssue(issues, 'invalid-structure', 'metadata.counts é obrigatório.');
    return;
  }

  const snapshot: FirestoreBackupSnapshot = {
    clients: Object.entries(payload.appData.clients).map(([id, data]) => ({ id, data })),
    dailyData: Object.entries(payload.appData.dailyData).map(([id, data]) => ({ id, data })),
    deliveries: Object.entries(payload.appData.deliveries).map(([id, data]) => ({ id, data })),
    factoryReceipts: Object.entries(payload.appData.factoryReceipts).map(([id, value]) => ({
      data: value.data,
      id,
      payments: Object.entries(value.payments).map(([paymentId, data]) => ({
        data,
        id: paymentId,
      })),
    })),
    monthlyData: Object.entries(payload.appData.monthlyData).map(([id, data]) => ({ id, data })),
    settings: payload.appData.settings,
  };
  const expected = countFirestoreBackupSnapshot(snapshot);
  if (JSON.stringify(expected) !== JSON.stringify(payload.metadata.counts)) {
    addIssue(issues, 'invalid-structure', 'As contagens do metadata não correspondem ao arquivo.');
  }
}

function checksumInput(payload: FirestoreBackupPayload): string {
  const withoutChecksum = JSON.parse(JSON.stringify(payload)) as FirestoreBackupPayload;
  delete withoutChecksum.metadata.checksumSha256;
  delete withoutChecksum.metadata.checksumScope;
  return JSON.stringify(withoutChecksum, null, 2);
}

export function deserializeFirestoreValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(deserializeFirestoreValue);
  if (!isRecord(value)) return value;
  if (value.__firestoreType === 'timestamp') {
    if (typeof value.seconds !== 'number' || typeof value.nanoseconds !== 'number') {
      throw new Error('Timestamp serializado inválido.');
    }
    return new Timestamp(value.seconds, value.nanoseconds);
  }
  if (value.__firestoreType === 'date') {
    if (typeof value.value !== 'string') throw new Error('Date serializado inválido.');
    return new Date(value.value);
  }
  if (value.__firestoreType === 'undefined') return undefined;
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [key, deserializeFirestoreValue(nested)]),
  );
}

async function verifyRoundTrip(payload: FirestoreBackupPayload): Promise<boolean> {
  const deserialized = deserializeFirestoreValue(payload.appData);
  const reserialized = serializeFirestoreValue(deserialized);
  return JSON.stringify(reserialized) === JSON.stringify(payload.appData);
}

export class FirestoreBackupValidationService {
  public async validate(contents: string, expectedUid: string): Promise<ValidatedFirestoreBackup> {
    const issues: FirestoreBackupValidationIssue[] = [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(contents);
    } catch {
      addIssue(issues, 'invalid-json', 'O arquivo não contém JSON válido.');
      return { canCompare: false, checksumValid: false, issues, payload: null, uidMatches: false };
    }

    if (!isRecord(parsed)) {
      addIssue(issues, 'invalid-structure', 'A raiz do backup deve ser um objeto.');
      return { canCompare: false, checksumValid: false, issues, payload: null, uidMatches: false };
    }

    const backupVersion = parsed.backupVersion;
    const schemaVersion = parsed.schemaVersion;
    const hasVersions = backupVersion === 1 && schemaVersion === 1;
    if (backupVersion !== 1) {
      addIssue(issues, 'unsupported-backup-version', 'backupVersion incompatível.');
    }
    if (schemaVersion !== 1) {
      addIssue(issues, 'unsupported-schema-version', 'schemaVersion incompatível.');
    }

    const payload = parsed as unknown as FirestoreBackupPayload;
    const uidMatches = typeof parsed.uid === 'string' && parsed.uid === expectedUid;
    if (!uidMatches)
      addIssue(issues, 'uid-mismatch', 'O backup pertence a outro usuário Firebase.');

    if (typeof parsed.exportedAt !== 'string' || !isRecord(parsed.appData)) {
      addIssue(issues, 'invalid-structure', 'exportedAt e appData são obrigatórios.');
    }
    const appDataValid = validateAppData(parsed.appData, issues);
    if (appDataValid) validateCounts(payload, issues);

    let checksumValid = false;
    if (isRecord(parsed.metadata) && typeof parsed.metadata.checksumSha256 === 'string') {
      if (parsed.metadata.checksumScope !== 'payload-without-checksum') {
        addIssue(issues, 'invalid-checksum', 'Escopo do checksum incompatível.');
      } else {
        const expectedChecksum = await digestStringAsync(
          CryptoDigestAlgorithm.SHA256,
          checksumInput(payload),
        );
        checksumValid = expectedChecksum === parsed.metadata.checksumSha256;
        if (!checksumValid) addIssue(issues, 'invalid-checksum', 'O checksum SHA-256 não confere.');
      }
    } else {
      addIssue(issues, 'invalid-checksum', 'Checksum SHA-256 ausente.');
    }

    if (appDataValid && checksumValid) {
      try {
        if (!(await verifyRoundTrip(payload))) {
          addIssue(issues, 'invalid-structure', 'Timestamp ou tipo serializado não é reversível.');
        }
      } catch (error) {
        addIssue(
          issues,
          'invalid-structure',
          error instanceof Error ? error.message : 'Tipo inválido.',
        );
      }
    }

    const canCompare = hasVersions && appDataValid && checksumValid && uidMatches;
    return { canCompare, checksumValid, issues, payload: hasVersions ? payload : null, uidMatches };
  }
}

export const firestoreBackupValidationService = new FirestoreBackupValidationService();
