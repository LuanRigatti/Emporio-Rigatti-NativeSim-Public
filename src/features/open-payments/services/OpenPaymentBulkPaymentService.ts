import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { getFunctions, httpsCallable } from 'firebase/functions';

import { getFirebaseApp } from '@/services/firebase';

export const MAX_OPEN_PAYMENT_BULK_DELIVERIES = 499;

export type OpenPaymentBulkPreview =
  | {
      status: 'ready';
      clientName: string;
      eligibleCount: number;
      totalCents: number;
      snapshotFingerprint: string;
    }
  | { status: 'empty'; clientName: string; eligibleCount: 0; totalCents: 0 }
  | {
      status: 'limit-exceeded';
      clientName: string;
      minimumEligibleCount: number;
      maxEligibleCount: number;
    }
  | {
      status: 'presentation-mismatch';
      clientName: string;
      eligibleCount: number;
      totalCents: number;
      notShownCount: number;
      noLongerEligibleCount: number;
    };

export type OpenPaymentBulkCommitResult = {
  status: 'committed';
  operationId: string;
  clientId: string;
  clientName: string;
  eligibleCount: number;
  totalCents: number;
  updatedDeliveries: { id: string; date: string }[];
  replayed: boolean;
};

export type PendingOpenPaymentBulkOperation = {
  clientId: string;
  visibleDeliveryIds: string[];
  snapshotFingerprint: string;
  idempotencyKey: string;
  commitAttempted: boolean;
  clientName?: string;
  eligibleCount?: number;
  totalCents?: number;
};

export type OpenPaymentBulkConfirmation = PendingOpenPaymentBulkOperation & {
  clientName: string;
  eligibleCount: number;
  totalCents: number;
};

const PENDING_OPERATION_PREFIX = '@pareact/open-payment-bulk-operation-v1';

type PreviewRequest = {
  operation: 'preview';
  clientId: string;
  visibleDeliveryIds: readonly string[];
};

type CommitRequest = {
  operation: 'commit';
  clientId: string;
  visibleDeliveryIds: readonly string[];
  snapshotFingerprint: string;
  idempotencyKey: string;
};

type StatusRequest = { operation: 'status'; idempotencyKey: string };

type OpenPaymentBulkRequest = PreviewRequest | CommitRequest | StatusRequest;
type OpenPaymentBulkResponse =
  | OpenPaymentBulkPreview
  | OpenPaymentBulkCommitResult
  | { status: 'not-found' }
  | { status: 'committed'; result: OpenPaymentBulkCommitResult };

function getCallable() {
  return httpsCallable<OpenPaymentBulkRequest, OpenPaymentBulkResponse>(
    getFunctions(getFirebaseApp(), 'us-central1'),
    'openPaymentBulkActions',
  );
}

function isPendingOperation(value: unknown): value is PendingOpenPaymentBulkOperation {
  if (!value || typeof value !== 'object') return false;
  const operation = value as Partial<PendingOpenPaymentBulkOperation>;
  return (
    typeof operation.clientId === 'string' &&
    operation.clientId.startsWith('client:') &&
    operation.clientId.length > 'client:'.length &&
    Array.isArray(operation.visibleDeliveryIds) &&
    operation.visibleDeliveryIds.every((id) => typeof id === 'string') &&
    new Set(operation.visibleDeliveryIds).size === operation.visibleDeliveryIds.length &&
    typeof operation.snapshotFingerprint === 'string' &&
    /^[a-f0-9]{64}$/.test(operation.snapshotFingerprint) &&
    typeof operation.idempotencyKey === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      operation.idempotencyKey,
    ) &&
    typeof operation.commitAttempted === 'boolean'
  );
}

function pendingOperationKey(uid: string, clientId: string): string {
  return `${PENDING_OPERATION_PREFIX}:${encodeURIComponent(uid)}:${encodeURIComponent(clientId)}`;
}

function validatePreview(value: unknown): OpenPaymentBulkPreview {
  if (!value || typeof value !== 'object') throw new Error('bulk_preview_response_invalid');
  const preview = value as Partial<OpenPaymentBulkPreview>;
  if (
    !['ready', 'empty', 'limit-exceeded', 'presentation-mismatch'].includes(preview.status ?? '') ||
    typeof preview.clientName !== 'string'
  ) {
    throw new Error('bulk_preview_response_invalid');
  }
  const validReady =
    preview.status !== 'ready' ||
    (Number.isSafeInteger(preview.eligibleCount) &&
      Number.isSafeInteger(preview.totalCents) &&
      typeof preview.snapshotFingerprint === 'string');
  const validEmpty =
    preview.status !== 'empty' || (preview.eligibleCount === 0 && preview.totalCents === 0);
  const validLimit =
    preview.status !== 'limit-exceeded' ||
    (Number.isSafeInteger(preview.minimumEligibleCount) &&
      Number.isSafeInteger(preview.maxEligibleCount));
  const validMismatch =
    preview.status !== 'presentation-mismatch' ||
    (Number.isSafeInteger(preview.eligibleCount) &&
      Number.isSafeInteger(preview.totalCents) &&
      Number.isSafeInteger(preview.notShownCount) &&
      Number.isSafeInteger(preview.noLongerEligibleCount));
  if (!validReady || !validEmpty || !validLimit || !validMismatch) {
    throw new Error('bulk_preview_response_invalid');
  }
  return preview as OpenPaymentBulkPreview;
}

function validateCommitResult(
  value: unknown,
  input: Pick<CommitRequest, 'clientId' | 'idempotencyKey' | 'visibleDeliveryIds'>,
): OpenPaymentBulkCommitResult {
  if (!value || typeof value !== 'object') throw new Error('bulk_commit_response_invalid');
  const result = value as Partial<OpenPaymentBulkCommitResult>;
  const expectedIds = [...input.visibleDeliveryIds].sort();
  const returned = Array.isArray(result.updatedDeliveries) ? result.updatedDeliveries : [];
  const returnedIds = returned
    .map((entry) => (entry && typeof entry.id === 'string' ? entry.id : ''))
    .sort();
  if (
    result.status !== 'committed' ||
    result.operationId !== input.idempotencyKey ||
    result.clientId !== input.clientId ||
    typeof result.clientName !== 'string' ||
    !Number.isSafeInteger(result.eligibleCount) ||
    result.eligibleCount !== expectedIds.length ||
    !Number.isSafeInteger(result.totalCents) ||
    typeof result.replayed !== 'boolean' ||
    returned.length !== expectedIds.length ||
    returned.some((entry) => !entry || typeof entry.date !== 'string' || !entry.date) ||
    returnedIds.some((id, index) => id !== expectedIds[index])
  ) {
    throw new Error('bulk_commit_response_invalid');
  }
  return result as OpenPaymentBulkCommitResult;
}

export function createOpenPaymentBulkIdempotencyKey(): string {
  return Crypto.randomUUID();
}

export async function previewOpenPaymentBulkPayment(
  clientId: string,
  visibleDeliveryIds: readonly string[],
): Promise<OpenPaymentBulkPreview> {
  if (visibleDeliveryIds.length > MAX_OPEN_PAYMENT_BULK_DELIVERIES) {
    return {
      status: 'limit-exceeded',
      clientName: '',
      minimumEligibleCount: visibleDeliveryIds.length,
      maxEligibleCount: MAX_OPEN_PAYMENT_BULK_DELIVERIES,
    };
  }
  const result = await getCallable()({
    operation: 'preview',
    clientId,
    visibleDeliveryIds,
  });
  return validatePreview(result.data);
}

export async function commitOpenPaymentBulkPayment(
  input: Omit<CommitRequest, 'operation'>,
): Promise<OpenPaymentBulkCommitResult> {
  if (input.visibleDeliveryIds.length > MAX_OPEN_PAYMENT_BULK_DELIVERIES) {
    throw new Error('bulk_limit_exceeded');
  }
  const result = await getCallable()({ operation: 'commit', ...input });
  return validateCommitResult(result.data, input);
}

export async function getOpenPaymentBulkOperationStatus(
  idempotencyKey: string,
): Promise<{ status: 'not-found' } | { status: 'committed'; result: OpenPaymentBulkCommitResult }> {
  const response = await getCallable()({ operation: 'status', idempotencyKey });
  const value = response.data;
  if (!value || typeof value !== 'object') throw new Error('bulk_status_response_invalid');
  if ('status' in value && value.status === 'not-found') return { status: 'not-found' };
  if ('status' in value && value.status === 'committed' && 'result' in value) {
    return {
      status: 'committed',
      result: validateCommitResult(value.result, {
        clientId: value.result.clientId,
        visibleDeliveryIds: value.result.updatedDeliveries.map(({ id }) => id),
        idempotencyKey,
      }),
    };
  }
  throw new Error('bulk_status_response_invalid');
}

export async function readPendingOpenPaymentBulkOperation(
  uid: string,
  clientId: string,
): Promise<PendingOpenPaymentBulkOperation | null> {
  const key = pendingOperationKey(uid, clientId);
  const serialized = await AsyncStorage.getItem(key);
  if (!serialized) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error('bulk_pending_operation_unreadable');
  }
  if (!isPendingOperation(parsed) || parsed.clientId !== clientId) {
    throw new Error('bulk_pending_operation_unreadable');
  }
  return parsed;
}

export async function savePendingOpenPaymentBulkOperation(
  uid: string,
  operation: PendingOpenPaymentBulkOperation,
): Promise<void> {
  await AsyncStorage.setItem(
    pendingOperationKey(uid, operation.clientId),
    JSON.stringify({
      clientId: operation.clientId,
      commitAttempted: operation.commitAttempted,
      idempotencyKey: operation.idempotencyKey,
      snapshotFingerprint: operation.snapshotFingerprint,
      visibleDeliveryIds: operation.visibleDeliveryIds,
    }),
  );
}

export async function clearPendingOpenPaymentBulkOperation(
  uid: string,
  clientId: string,
): Promise<void> {
  await AsyncStorage.removeItem(pendingOperationKey(uid, clientId));
}

export function getOpenPaymentBulkErrorCode(error: unknown): string {
  const rawCode =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  return rawCode.replace(/^functions\//, '');
}

export function isDefinitiveOpenPaymentBulkError(error: unknown): boolean {
  return new Set([
    'already-exists',
    'failed-precondition',
    'invalid-argument',
    'not-found',
    'permission-denied',
    'resource-exhausted',
    'unauthenticated',
  ]).has(getOpenPaymentBulkErrorCode(error));
}

export function getOpenPaymentBulkErrorMessage(error: unknown): string {
  const code = getOpenPaymentBulkErrorCode(error);

  if (code === 'resource-exhausted') {
    return 'O número de entregas excede o limite seguro para quitação em lote. Use as ações individuais.';
  }
  if (code === 'already-exists') {
    return 'A chave desta operação já está associada a outra quitação. Atualize a lista e tente novamente.';
  }
  if (code === 'failed-precondition' || code === 'aborted') {
    return 'As pendências mudaram ou não puderam ser identificadas com segurança. Nada foi quitado. Atualize a lista e tente novamente.';
  }
  if (code === 'unauthenticated' || code === 'permission-denied') {
    return 'Sua sessão não está disponível. Entre novamente para continuar.';
  }
  if (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    code === 'internal' ||
    code === ''
  ) {
    return 'Não foi possível confirmar a quitação no servidor. Nenhum sucesso foi informado. Verifique sua conexão e atualize a lista.';
  }
  return 'Não foi possível quitar as entregas. Nenhuma confirmação de sucesso foi recebida.';
}
