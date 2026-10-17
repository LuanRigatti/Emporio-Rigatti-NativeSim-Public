const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createOpenPaymentBulkActionsHandler,
  RECEIPTS_COLLECTION,
} = require('./openPaymentBulkActions');

class TestHttpsError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function createFirestore(seed = {}) {
  const documents = new Map(Object.entries(seed));
  let failNextCommit = false;
  let committedWrites = 0;

  function snapshot(path) {
    const value = documents.get(path);
    const reference = { id: path.split('/').at(-1), path };
    return {
      exists: value !== undefined,
      id: reference.id,
      ref: reference,
      data: () => value,
    };
  }

  function queryDocuments(query) {
    const prefix = `${query.collection.path}/`;
    const docs = [...documents.entries()]
      .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
      .filter(([, value]) =>
        query.filters.every(({ field, value: expected }) => value[field] === expected),
      )
      .slice(0, query.max ?? Number.POSITIVE_INFINITY)
      .map(([path]) => snapshot(path));
    return { docs, empty: docs.length === 0, size: docs.length };
  }

  class DocumentReference {
    constructor(path) {
      this.path = path;
      this.id = path.split('/').at(-1);
    }

    collection(name) {
      return new CollectionReference(`${this.path}/${name}`);
    }

    async get() {
      return snapshot(this.path);
    }
  }

  class CollectionReference {
    constructor(path) {
      this.path = path;
    }

    doc(id) {
      return new DocumentReference(`${this.path}/${id}`);
    }

    where(field, _operator, value) {
      return new QueryReference(this, [{ field, value }]);
    }
  }

  class QueryReference {
    constructor(collection, filters, max) {
      this.collection = collection;
      this.filters = filters;
      this.max = max;
    }

    where(field, _operator, value) {
      return new QueryReference(this.collection, [...this.filters, { field, value }], this.max);
    }

    limit(max) {
      return new QueryReference(this.collection, this.filters, max);
    }

    async get() {
      return queryDocuments(this);
    }
  }

  const firestore = {
    collection: (path) => new CollectionReference(path),
    runTransaction: async (callback) => {
      const writes = [];
      const transaction = {
        get: async (reference) =>
          reference instanceof QueryReference
            ? queryDocuments(reference)
            : snapshot(reference.path),
        update: (reference, value) => writes.push({ type: 'update', path: reference.path, value }),
        create: (reference, value) => writes.push({ type: 'create', path: reference.path, value }),
      };
      const result = await callback(transaction);
      if (failNextCommit) {
        failNextCommit = false;
        throw new Error('synthetic commit failure');
      }
      const nextDocuments = new Map(documents);
      for (const write of writes) {
        if (write.type === 'create' && nextDocuments.has(write.path)) {
          throw new Error('already exists');
        }
        nextDocuments.set(write.path, {
          ...(nextDocuments.get(write.path) ?? {}),
          ...write.value,
        });
      }
      writes.forEach((write) => {
        documents.set(write.path, nextDocuments.get(write.path));
      });
      committedWrites += writes.length;
      return result;
    },
  };
  const adminFirestore = () => firestore;
  adminFirestore.FieldValue = { serverTimestamp: () => ({ serverTimestamp: true }) };

  return {
    admin: { firestore: adminFirestore },
    documents,
    failCommit: () => {
      failNextCommit = true;
    },
    handler: createOpenPaymentBulkActionsHandler({
      admin: { firestore: adminFirestore },
      HttpsError: TestHttpsError,
      FieldValue: adminFirestore.FieldValue,
    }),
    getCommittedWriteCount: () => committedWrites,
  };
}

function addClient(documents, uid, id, name) {
  documents.set(`users/${uid}/clients/${id}`, { name });
}

function addDelivery(documents, uid, id, fields = {}) {
  documents.set(`users/${uid}/deliveries/${id}`, {
    clientId: 'client-a',
    clientNameSnapshot: 'Cliente',
    date: '2026-10-10',
    delivered: true,
    quantity: 1,
    status: 'Não Pago',
    totalValue: 50,
    ...fields,
  });
}

function previewRequest(uid, clientId, visibleDeliveryIds) {
  return {
    auth: { uid },
    data: { clientId: `client:${clientId}`, operation: 'preview', visibleDeliveryIds },
  };
}

function commitRequest(uid, clientId, visibleDeliveryIds, snapshotFingerprint, idempotencyKey) {
  return {
    auth: { uid },
    data: {
      clientId: `client:${clientId}`,
      idempotencyKey,
      operation: 'commit',
      snapshotFingerprint,
      visibleDeliveryIds,
    },
  };
}

const operationKey = '8fd21a08-353c-4f51-849b-b435b7f6e813';

test('previews and atomically marks every eligible delivery for one canonical client', async () => {
  const env = createFirestore();
  addClient(env.documents, 'uid-a', 'client-a', 'Cliente A');
  addDelivery(env.documents, 'uid-a', 'delivery-1', { totalValue: 50.25, paymentMethod: 'Pix' });
  addDelivery(env.documents, 'uid-a', 'delivery-2', {
    totalValue: 12.5,
    paymentMethod: 'Dinheiro',
  });

  const preview = await env.handler(
    previewRequest('uid-a', 'client-a', ['delivery-1', 'delivery-2']),
  );
  assert.equal(preview.status, 'ready');
  assert.equal(preview.clientName, 'Cliente A');
  assert.equal(preview.eligibleCount, 2);
  assert.equal(preview.totalCents, 6275);

  const committed = await env.handler(
    commitRequest(
      'uid-a',
      'client-a',
      ['delivery-1', 'delivery-2'],
      preview.snapshotFingerprint,
      operationKey,
    ),
  );
  assert.equal(committed.status, 'committed');
  assert.equal(committed.eligibleCount, 2);
  assert.equal(committed.totalCents, 6275);
  assert.equal(env.documents.get('users/uid-a/deliveries/delivery-1').status, 'Pago');
  assert.deepEqual(env.documents.get('users/uid-a/deliveries/delivery-1').paymentMethod, 'Pix');
  assert.deepEqual(
    env.documents.get('users/uid-a/deliveries/delivery-2').paymentMethod,
    'Dinheiro',
  );
  assert.deepEqual(env.documents.get('users/uid-a/deliveries/delivery-1').totalValue, 50.25);
  assert.deepEqual(env.documents.get('users/uid-a/deliveries/delivery-1').updatedAt, {
    serverTimestamp: true,
  });
  assert.equal(env.getCommittedWriteCount(), 3);
});

test('returns a stale presentation when all visible deliveries are already paid', async () => {
  const env = createFirestore();
  addClient(env.documents, 'uid-a', 'client-a', 'Cliente A');
  addDelivery(env.documents, 'uid-a', 'paid-delivery', { status: 'Pago' });

  const preview = await env.handler(previewRequest('uid-a', 'client-a', ['paid-delivery']));
  assert.equal(preview.status, 'presentation-mismatch');
  assert.equal(preview.eligibleCount, 0);
  assert.equal(preview.noLongerEligibleCount, 1);
  assert.equal(env.getCommittedWriteCount(), 0);
});

test('same display names do not allow updating another canonical client', async () => {
  const env = createFirestore();
  addClient(env.documents, 'uid-a', 'client-a', 'Maria Silva');
  addClient(env.documents, 'uid-a', 'client-b', 'Maria Silva');
  addDelivery(env.documents, 'uid-a', 'a-delivery', { clientId: 'client-a' });
  addDelivery(env.documents, 'uid-a', 'b-delivery', { clientId: 'client-b' });
  const preview = await env.handler(previewRequest('uid-a', 'client-a', ['a-delivery']));

  await env.handler(
    commitRequest('uid-a', 'client-a', ['a-delivery'], preview.snapshotFingerprint, operationKey),
  );
  assert.equal(env.documents.get('users/uid-a/deliveries/a-delivery').status, 'Pago');
  assert.equal(env.documents.get('users/uid-a/deliveries/b-delivery').status, 'Não Pago');
});

test('historical snapshot names for one client require the complete visible set', async () => {
  const env = createFirestore();
  addClient(env.documents, 'uid-a', 'client-a', 'Nome Atual');
  addDelivery(env.documents, 'uid-a', 'old-name', {
    clientId: 'client-a',
    clientNameSnapshot: 'Nome antigo',
  });
  addDelivery(env.documents, 'uid-a', 'current-name', {
    clientId: 'client-a',
    clientNameSnapshot: 'Nome Atual',
  });

  const mismatch = await env.handler(previewRequest('uid-a', 'client-a', ['current-name']));
  assert.equal(mismatch.status, 'presentation-mismatch');
  assert.equal(mismatch.notShownCount, 1);
  assert.equal(mismatch.eligibleCount, 2);
  const complete = await env.handler(
    previewRequest('uid-a', 'client-a', ['current-name', 'old-name']),
  );
  assert.equal(complete.status, 'ready');
  assert.equal(complete.eligibleCount, 2);
});

test('legacy deliveries without clientId are not linked or changed', async () => {
  const env = createFirestore();
  addClient(env.documents, 'uid-a', 'client-a', 'Cliente A');
  addDelivery(env.documents, 'uid-a', 'canonical', { clientId: 'client-a' });
  addDelivery(env.documents, 'uid-a', 'legacy', { clientId: undefined });
  delete env.documents.get('users/uid-a/deliveries/legacy').clientId;
  const preview = await env.handler(previewRequest('uid-a', 'client-a', ['canonical']));
  await env.handler(
    commitRequest('uid-a', 'client-a', ['canonical'], preview.snapshotFingerprint, operationKey),
  );
  assert.equal(env.documents.get('users/uid-a/deliveries/canonical').status, 'Pago');
  assert.equal(env.documents.get('users/uid-a/deliveries/legacy').status, 'Não Pago');
});

test('rejects unauthenticated requests', async () => {
  const env = createFirestore();
  await assert.rejects(
    env.handler({ data: { operation: 'preview' } }),
    (error) => error instanceof TestHttpsError && error.code === 'unauthenticated',
  );
});

test('ignores a supplied UID and cannot access another user collection', async () => {
  const env = createFirestore();
  addClient(env.documents, 'uid-b', 'client-a', 'Privado');
  addDelivery(env.documents, 'uid-b', 'private-delivery');
  await assert.rejects(
    env.handler({
      auth: { uid: 'uid-a' },
      data: {
        clientId: 'client:client-a',
        operation: 'preview',
        uid: 'uid-b',
        visibleDeliveryIds: ['private-delivery'],
      },
    }),
    (error) => error instanceof TestHttpsError && error.code === 'failed-precondition',
  );
  assert.equal(env.documents.get('users/uid-b/deliveries/private-delivery').status, 'Não Pago');
});

test('aborts confirmation when the eligible set changes after preview', async () => {
  const env = createFirestore();
  addClient(env.documents, 'uid-a', 'client-a', 'Cliente A');
  addDelivery(env.documents, 'uid-a', 'first');
  const preview = await env.handler(previewRequest('uid-a', 'client-a', ['first']));
  addDelivery(env.documents, 'uid-a', 'concurrent');

  await assert.rejects(
    env.handler(
      commitRequest('uid-a', 'client-a', ['first'], preview.snapshotFingerprint, operationKey),
    ),
    (error) => error instanceof TestHttpsError && error.code === 'failed-precondition',
  );
  assert.equal(env.documents.get('users/uid-a/deliveries/first').status, 'Não Pago');
  assert.equal(env.getCommittedWriteCount(), 0);
});

test('transaction failure rolls back and allows a safe retry with the same key', async () => {
  const env = createFirestore();
  addClient(env.documents, 'uid-a', 'client-a', 'Cliente A');
  addDelivery(env.documents, 'uid-a', 'first');
  addDelivery(env.documents, 'uid-a', 'second');
  const preview = await env.handler(previewRequest('uid-a', 'client-a', ['first', 'second']));
  env.failCommit();

  await assert.rejects(
    env.handler(
      commitRequest(
        'uid-a',
        'client-a',
        ['first', 'second'],
        preview.snapshotFingerprint,
        operationKey,
      ),
    ),
    (error) => error instanceof TestHttpsError && error.code === 'internal',
  );
  assert.equal(env.documents.get('users/uid-a/deliveries/first').status, 'Não Pago');
  assert.equal(env.documents.get('users/uid-a/deliveries/second').status, 'Não Pago');
  assert.equal(
    [...env.documents.keys()].some((path) => path.startsWith(`${RECEIPTS_COLLECTION}/`)),
    false,
  );
  assert.equal(env.getCommittedWriteCount(), 0);

  const retry = await env.handler(
    commitRequest(
      'uid-a',
      'client-a',
      ['first', 'second'],
      preview.snapshotFingerprint,
      operationKey,
    ),
  );
  assert.equal(retry.status, 'committed');
  assert.equal(retry.operationId, operationKey);
  assert.equal(env.documents.get('users/uid-a/deliveries/first').status, 'Pago');
  assert.equal(env.documents.get('users/uid-a/deliveries/second').status, 'Pago');
  assert.equal(env.getCommittedWriteCount(), 3);
});

test('same idempotency key replays the persistent receipt without duplicate writes', async () => {
  const env = createFirestore();
  addClient(env.documents, 'uid-a', 'client-a', 'Cliente A');
  addDelivery(env.documents, 'uid-a', 'first');
  const preview = await env.handler(previewRequest('uid-a', 'client-a', ['first']));
  const request = commitRequest(
    'uid-a',
    'client-a',
    ['first'],
    preview.snapshotFingerprint,
    operationKey,
  );
  const first = await env.handler(request);
  const replay = await env.handler(request);

  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.equal(replay.operationId, operationKey);
  assert.equal(env.getCommittedWriteCount(), 2);
  const status = await env.handler({
    auth: { uid: 'uid-a' },
    data: { idempotencyKey: operationKey, operation: 'status' },
  });
  assert.equal(status.status, 'committed');
  assert.equal(status.result.totalCents, 5000);
  const otherUserStatus = await env.handler({
    auth: { uid: 'uid-b' },
    data: { idempotencyKey: operationKey, operation: 'status' },
  });
  assert.deepEqual(otherUserStatus, { status: 'not-found' });
  await assert.rejects(
    env.handler(
      commitRequest('uid-a', 'client-a', ['different'], preview.snapshotFingerprint, operationKey),
    ),
    (error) => error instanceof TestHttpsError && error.code === 'already-exists',
  );
});

test('a later bulk payment uses a fresh receipt after new deliveries are created', async () => {
  const env = createFirestore();
  addClient(env.documents, 'uid-a', 'client-a', 'Cliente A');
  addDelivery(env.documents, 'uid-a', 'first');

  const firstPreview = await env.handler(previewRequest('uid-a', 'client-a', ['first']));
  const firstOperation = await env.handler(
    commitRequest('uid-a', 'client-a', ['first'], firstPreview.snapshotFingerprint, operationKey),
  );
  assert.equal(firstOperation.status, 'committed');

  addDelivery(env.documents, 'uid-a', 'later-delivery', {
    date: '2026-10-14',
    totalValue: 75,
  });
  const secondKey = '7bd94be0-5273-4a11-a574-1234567890ab';
  const secondPreview = await env.handler(previewRequest('uid-a', 'client-a', ['later-delivery']));
  assert.equal(secondPreview.status, 'ready');
  const secondOperation = await env.handler(
    commitRequest(
      'uid-a',
      'client-a',
      ['later-delivery'],
      secondPreview.snapshotFingerprint,
      secondKey,
    ),
  );

  assert.equal(secondOperation.status, 'committed');
  assert.equal(secondOperation.operationId, secondKey);
  assert.equal(secondOperation.replayed, false);
  assert.equal(env.documents.get('users/uid-a/deliveries/first').status, 'Pago');
  assert.equal(env.documents.get('users/uid-a/deliveries/later-delivery').status, 'Pago');
  assert.equal(
    [...env.documents.keys()].filter((path) => path.startsWith(`${RECEIPTS_COLLECTION}/`)).length,
    2,
  );
  assert.equal(env.getCommittedWriteCount(), 4);
});

test('aborts above the transaction write limit without partial updates', async () => {
  const env = createFirestore();
  addClient(env.documents, 'uid-a', 'client-a', 'Cliente A');
  const ids = Array.from({ length: 500 }, (_, index) => `delivery-${index}`);
  ids.forEach((id) => addDelivery(env.documents, 'uid-a', id));

  const preview = await env.handler(previewRequest('uid-a', 'client-a', ids));
  assert.equal(preview.status, 'limit-exceeded');
  await assert.rejects(
    env.handler(commitRequest('uid-a', 'client-a', ids, '0'.repeat(64), operationKey)),
    (error) => error instanceof TestHttpsError && error.code === 'resource-exhausted',
  );
  assert.ok(
    ids.every((id) => env.documents.get(`users/uid-a/deliveries/${id}`).status === 'Não Pago'),
  );
  assert.equal(env.getCommittedWriteCount(), 0);
});

test('allows exactly 499 delivery updates plus the persistent receipt in one transaction', async () => {
  const env = createFirestore();
  addClient(env.documents, 'uid-a', 'client-a', 'Cliente A');
  const ids = Array.from({ length: 499 }, (_, index) => `delivery-${index}`);
  ids.forEach((id) => addDelivery(env.documents, 'uid-a', id));

  const preview = await env.handler(previewRequest('uid-a', 'client-a', ids));
  assert.equal(preview.status, 'ready');
  assert.equal(preview.eligibleCount, 499);

  const committed = await env.handler(
    commitRequest('uid-a', 'client-a', ids, preview.snapshotFingerprint, operationKey),
  );

  assert.equal(committed.status, 'committed');
  assert.equal(committed.updatedDeliveries.length, 499);
  assert.equal(env.getCommittedWriteCount(), 500);
  assert.ok(ids.every((id) => env.documents.get(`users/uid-a/deliveries/${id}`).status === 'Pago'));
});
