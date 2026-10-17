const { createHash } = require('node:crypto');

const MAX_BULK_DELIVERIES = 499;
const QUERY_LIMIT = MAX_BULK_DELIVERIES + 1;
const RECEIPTS_COLLECTION = 'openPaymentBulkPaymentReceipts';
const DELIVERY_STATUS_OPEN = 'Não Pago';

function createOpenPaymentBulkActionsHandler({ admin, HttpsError, FieldValue }) {
  function normalizeMoney(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    if (typeof value !== 'string' || value.trim() === '') return undefined;
    let normalized = value.trim().replace(/[R$\s]/g, '');
    if (normalized.includes(',') && normalized.includes('.')) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else if (normalized.includes(',')) {
      normalized = normalized.replace(',', '.');
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  function fail(code, message) {
    throw new HttpsError(code, message);
  }

  function requireCanonicalClientId(value) {
    if (
      typeof value !== 'string' ||
      !value.startsWith('client:') ||
      value.length <= 'client:'.length ||
      value.length > 512 ||
      value.slice('client:'.length).includes('/')
    ) {
      fail('invalid-argument', 'client_id_invalid');
    }
    return value.slice('client:'.length);
  }

  function requireVisibleDeliveryIds(value) {
    if (
      !Array.isArray(value) ||
      value.length === 0 ||
      value.length > QUERY_LIMIT ||
      value.some(
        (id) => typeof id !== 'string' || id.length === 0 || id.length > 1500 || id.includes('/'),
      ) ||
      new Set(value).size !== value.length
    ) {
      fail('invalid-argument', 'visible_delivery_ids_invalid');
    }
    return [...value].sort();
  }

  function requireFingerprint(value) {
    if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
      fail('invalid-argument', 'preview_fingerprint_invalid');
    }
    return value;
  }

  function requireOperationId(value) {
    if (
      typeof value !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ) {
      fail('invalid-argument', 'idempotency_key_invalid');
    }
    return value;
  }

  function readClientName(snapshot) {
    if (!snapshot.exists) fail('failed-precondition', 'client_identity_unavailable');
    const name = snapshot.data()?.name;
    if (typeof name !== 'string' || name.trim() === '') {
      fail('failed-precondition', 'client_identity_unavailable');
    }
    return name.trim();
  }

  function toEligibleEntries(snapshot) {
    return snapshot.docs.map((document) => {
      const data = document.data();
      const totalValue = normalizeMoney(data.totalValue);
      const quantity = normalizeMoney(data.quantity);
      if (
        data.status !== DELIVERY_STATUS_OPEN ||
        data.delivered !== true ||
        totalValue === undefined ||
        !Number.isSafeInteger(Math.round(totalValue * 100)) ||
        quantity === undefined ||
        typeof data.date !== 'string' ||
        data.date.trim() === ''
      ) {
        fail('failed-precondition', 'delivery_data_unavailable');
      }
      return {
        id: document.id,
        date: data.date,
        quantity,
        totalValue,
      };
    });
  }

  function summarize(clientId, clientName, entries) {
    const orderedEntries = [...entries].sort((left, right) => left.id.localeCompare(right.id));
    const totalValue = orderedEntries.reduce((sum, entry) => sum + entry.totalValue, 0);
    const totalCents = Math.round(totalValue * 100);
    if (!Number.isSafeInteger(totalCents)) fail('failed-precondition', 'total_unavailable');
    const snapshotFingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          clientId,
          clientName,
          entries: orderedEntries.map(({ date, id, quantity, totalValue: value }) => ({
            date,
            id,
            quantity,
            totalValue: value,
          })),
        }),
      )
      .digest('hex');
    return {
      eligibleCount: orderedEntries.length,
      totalCents,
      snapshotFingerprint,
      updatedDeliveries: orderedEntries.map(({ date, id }) => ({ id, date })),
    };
  }

  function sameIds(left, right) {
    return left.length === right.length && left.every((id, index) => id === right[index]);
  }

  function queryFor(deliveries, clientDocumentId) {
    return deliveries
      .where('clientId', '==', clientDocumentId)
      .where('status', '==', DELIVERY_STATUS_OPEN)
      .where('delivered', '==', true)
      .limit(QUERY_LIMIT);
  }

  async function preview(uid, data) {
    const clientDocumentId = requireCanonicalClientId(data?.clientId);
    const visibleDeliveryIds = requireVisibleDeliveryIds(data?.visibleDeliveryIds);
    const firestore = admin.firestore();
    const userRef = firestore.collection('users').doc(uid);
    const clientSnapshot = await userRef.collection('clients').doc(clientDocumentId).get();
    const clientName = readClientName(clientSnapshot);
    const deliverySnapshot = await queryFor(
      userRef.collection('deliveries'),
      clientDocumentId,
    ).get();

    if (deliverySnapshot.docs.length >= QUERY_LIMIT) {
      return {
        status: 'limit-exceeded',
        clientName,
        minimumEligibleCount: QUERY_LIMIT,
        maxEligibleCount: MAX_BULK_DELIVERIES,
      };
    }

    const entries = toEligibleEntries(deliverySnapshot);
    const summary = summarize(data.clientId, clientName, entries);
    const serverIds = summary.updatedDeliveries.map(({ id }) => id).sort();
    const notShownCount = serverIds.filter((id) => !visibleDeliveryIds.includes(id)).length;
    const noLongerEligibleCount = visibleDeliveryIds.filter((id) => !serverIds.includes(id)).length;
    if (!sameIds(serverIds, visibleDeliveryIds)) {
      return {
        status: 'presentation-mismatch',
        clientName,
        eligibleCount: summary.eligibleCount,
        totalCents: summary.totalCents,
        notShownCount,
        noLongerEligibleCount,
      };
    }
    if (entries.length === 0) {
      return {
        status: 'empty',
        clientName,
        eligibleCount: 0,
        totalCents: 0,
      };
    }
    return {
      status: 'ready',
      clientName,
      eligibleCount: summary.eligibleCount,
      totalCents: summary.totalCents,
      snapshotFingerprint: summary.snapshotFingerprint,
    };
  }

  async function commit(uid, data) {
    const clientDocumentId = requireCanonicalClientId(data?.clientId);
    const visibleDeliveryIds = requireVisibleDeliveryIds(data?.visibleDeliveryIds);
    const snapshotFingerprint = requireFingerprint(data?.snapshotFingerprint);
    const operationId = requireOperationId(data?.idempotencyKey);
    const firestore = admin.firestore();
    const userRef = firestore.collection('users').doc(uid);
    const clientRef = userRef.collection('clients').doc(clientDocumentId);
    const deliveryCollection = userRef.collection('deliveries');
    const receiptRef = firestore
      .collection(RECEIPTS_COLLECTION)
      .doc(uid)
      .collection('operations')
      .doc(operationId);
    const serverTimestamp = FieldValue.serverTimestamp;

    try {
      return await firestore.runTransaction(async (transaction) => {
        const receiptSnapshot = await transaction.get(receiptRef);
        if (receiptSnapshot.exists) {
          const receipt = receiptSnapshot.data();
          if (
            receipt.clientId !== data.clientId ||
            receipt.snapshotFingerprint !== snapshotFingerprint ||
            receipt.visibleIdsFingerprint !==
              createHash('sha256').update(JSON.stringify(visibleDeliveryIds)).digest('hex')
          ) {
            fail('already-exists', 'idempotency_key_conflict');
          }
          return { ...receipt.result, replayed: true };
        }

        const clientSnapshot = await transaction.get(clientRef);
        const clientName = readClientName(clientSnapshot);
        const deliverySnapshot = await transaction.get(
          queryFor(deliveryCollection, clientDocumentId),
        );
        if (deliverySnapshot.docs.length >= QUERY_LIMIT) {
          fail('resource-exhausted', 'bulk_limit_exceeded');
        }
        const entries = toEligibleEntries(deliverySnapshot);
        const summary = summarize(data.clientId, clientName, entries);
        const serverIds = summary.updatedDeliveries.map(({ id }) => id).sort();
        if (
          entries.length === 0 ||
          !sameIds(serverIds, visibleDeliveryIds) ||
          summary.snapshotFingerprint !== snapshotFingerprint
        ) {
          fail('failed-precondition', 'preview_stale');
        }

        const result = {
          status: 'committed',
          operationId,
          clientId: data.clientId,
          clientName,
          eligibleCount: summary.eligibleCount,
          totalCents: summary.totalCents,
          updatedDeliveries: summary.updatedDeliveries,
          replayed: false,
        };
        for (const document of deliverySnapshot.docs) {
          transaction.update(document.ref, {
            status: 'Pago',
            updatedAt: serverTimestamp(),
          });
        }
        transaction.create(receiptRef, {
          clientId: data.clientId,
          snapshotFingerprint,
          visibleIdsFingerprint: createHash('sha256')
            .update(JSON.stringify(visibleDeliveryIds))
            .digest('hex'),
          result,
          committedAt: serverTimestamp(),
        });
        return result;
      });
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      fail('internal', 'bulk_payment_commit_failed');
    }
  }

  async function readOperationStatus(uid, data) {
    const operationId = requireOperationId(data?.idempotencyKey);
    const receiptSnapshot = await admin
      .firestore()
      .collection(RECEIPTS_COLLECTION)
      .doc(uid)
      .collection('operations')
      .doc(operationId)
      .get();
    if (!receiptSnapshot.exists) return { status: 'not-found' };
    const result = receiptSnapshot.data()?.result;
    if (!result || result.status !== 'committed' || result.operationId !== operationId) {
      fail('internal', 'idempotency_receipt_invalid');
    }
    return { status: 'committed', result: { ...result, replayed: true } };
  }

  return async function openPaymentBulkActions(request) {
    const uid = request?.auth?.uid;
    if (typeof uid !== 'string' || uid.trim() === '') {
      fail('unauthenticated', 'authentication_required');
    }
    const operation = request.data?.operation;
    try {
      if (operation === 'preview') return await preview(uid, request.data);
      if (operation === 'commit') return await commit(uid, request.data);
      if (operation === 'status') return await readOperationStatus(uid, request.data);
      fail('invalid-argument', 'operation_invalid');
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      fail('internal', 'open_payment_operation_failed');
    }
  };
}

module.exports = {
  DELIVERY_STATUS_OPEN,
  MAX_BULK_DELIVERIES,
  RECEIPTS_COLLECTION,
  createOpenPaymentBulkActionsHandler,
};
