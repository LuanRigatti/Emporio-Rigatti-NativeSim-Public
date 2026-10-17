const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const { randomUUID } = require('node:crypto');
const { createServer } = require('node:http');
const { after, test } = require('node:test');
const admin = require('firebase-admin');

const DEMO_PROJECT_ID = 'demo-emporio-bulk-predeploy';
const emulatorConfig = require('../firebase.emulator.json');
const emulatorPorts = emulatorConfig.emulators;
const authHost = `127.0.0.1:${emulatorPorts.auth.port}`;
const firestoreHost = `${authHost.split(':')[0]}:${emulatorPorts.firestore.port}`;
const functionsHost = `${authHost.split(':')[0]}:${emulatorPorts.functions.port}`;

if (process.env.OPEN_PAYMENT_BULK_TEST_PROJECT_ID !== DEMO_PROJECT_ID) {
  throw new Error('emulator_test_requires_the_fixed_demo_project');
}

for (const key of ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT']) {
  if (process.env[key] && process.env[key] !== DEMO_PROJECT_ID) {
    throw new Error('emulator_test_project_environment_mismatch');
  }
}

process.env.GCLOUD_PROJECT = DEMO_PROJECT_ID;
process.env.GOOGLE_CLOUD_PROJECT = DEMO_PROJECT_ID;
process.env.FIRESTORE_EMULATOR_HOST = firestoreHost;
process.env.FIREBASE_AUTH_EMULATOR_HOST = authHost;

const app = admin.initializeApp(
  { projectId: DEMO_PROJECT_ID },
  `open-payment-bulk-emulator-${process.pid}`,
);
const firestore = admin.firestore(app);
const callableUrl = `http://${functionsHost}/${DEMO_PROJECT_ID}/us-central1/openPaymentBulkActions`;
const authSignupUrl = `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator-only`;

after(async () => {
  await app.delete();
});

async function createSyntheticUser() {
  const nonce = randomUUID();
  const response = await fetch(authSignupUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `synthetic-${nonce}@example.test`,
      password: `Emulator-${nonce}-only`,
      returnSecureToken: true,
    }),
  });
  const result = await response.json();
  if (!response.ok || typeof result.localId !== 'string' || typeof result.idToken !== 'string') {
    throw new Error(`auth_emulator_signup_failed_${response.status}`);
  }
  return { uid: result.localId, idToken: result.idToken };
}

async function callCallable(user, data) {
  const response = await fetch(callableUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(user?.idToken ? { Authorization: `Bearer ${user.idToken}` } : {}),
    },
    body: JSON.stringify({ data }),
  });
  const body = await response.json();
  if (body.error) {
    const error = new Error(body.error.message ?? body.error.status ?? 'callable_failed');
    error.status = body.error.status;
    error.details = body.error.details;
    throw error;
  }
  if (!response.ok || !Object.prototype.hasOwnProperty.call(body, 'result')) {
    throw new Error(`callable_response_invalid_${response.status}`);
  }
  return body.result;
}

async function forwardCommitAndDropReply(user, data) {
  const proxy = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    try {
      const upstream = await fetch(callableUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user?.idToken ? { Authorization: `Bearer ${user.idToken}` } : {}),
        },
        body: Buffer.concat(chunks),
      });
      await upstream.arrayBuffer();
      response.destroy();
    } catch {
      if (!response.destroyed) {
        response.writeHead(502).end();
      }
    }
  });
  await new Promise((resolve, reject) => {
    proxy.once('error', reject);
    proxy.listen(0, '127.0.0.1', resolve);
  });
  const address = proxy.address();
  assert.equal(typeof address, 'object');
  try {
    await assert.rejects(
      fetch(`http://127.0.0.1:${address.port}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      }),
    );
  } finally {
    await new Promise((resolve) => proxy.close(resolve));
  }
}

async function seedClient(user, clientDocumentId, name = 'Cliente Sintético') {
  await firestore
    .collection('users')
    .doc(user.uid)
    .collection('clients')
    .doc(clientDocumentId)
    .set({ name });
}

function makeDelivery(clientDocumentId, overrides = {}) {
  const delivery = {
    clientId: clientDocumentId,
    clientNameSnapshot: 'Nome histórico sintético',
    addressSnapshot: 'Endereço sintético',
    date: '2026-10-14',
    quantity: 1,
    unitPriceHistorical: 12.5,
    totalValue: 12.5,
    status: 'Não Pago',
    delivered: true,
    invoiceStatus: 'a_emitir',
    boletoStatus: 'a_emitir',
    paymentMethod: null,
    observation: 'marcador sintético de preservação',
    dateAddedAt: 1_760_000_000_000,
    createdAt: 1_760_000_000_001,
    updatedAt: 'updated-at-original-sintético',
    ...overrides,
  };
  if (clientDocumentId === null) delete delivery.clientId;
  return delivery;
}

async function seedDelivery(user, deliveryId, clientDocumentId, overrides = {}) {
  const reference = firestore
    .collection('users')
    .doc(user.uid)
    .collection('deliveries')
    .doc(deliveryId);
  await reference.set(makeDelivery(clientDocumentId, overrides));
  return reference;
}

function canonicalClientId(clientDocumentId) {
  return `client:${clientDocumentId}`;
}

async function preview(user, clientDocumentId, visibleDeliveryIds) {
  return callCallable(user, {
    operation: 'preview',
    clientId: canonicalClientId(clientDocumentId),
    visibleDeliveryIds,
  });
}

async function commit(
  user,
  clientDocumentId,
  visibleDeliveryIds,
  snapshotFingerprint,
  idempotencyKey,
) {
  return callCallable(user, {
    operation: 'commit',
    clientId: canonicalClientId(clientDocumentId),
    visibleDeliveryIds,
    snapshotFingerprint,
    idempotencyKey,
  });
}

async function readStatus(user, idempotencyKey) {
  return callCallable(user, { operation: 'status', idempotencyKey });
}

async function readDelivery(user, deliveryId) {
  const snapshot = await firestore
    .collection('users')
    .doc(user.uid)
    .collection('deliveries')
    .doc(deliveryId)
    .get();
  assert.equal(snapshot.exists, true, `missing synthetic delivery ${deliveryId}`);
  return snapshot.data();
}

async function readReceipts(user) {
  const snapshot = await firestore
    .collection('openPaymentBulkPaymentReceipts')
    .doc(user.uid)
    .collection('operations')
    .get();
  return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
}

async function assertDeliveryUpdatedOnlyForPayment(user, deliveryId, before) {
  const afterData = await readDelivery(user, deliveryId);
  const beforePreserved = { ...before };
  const afterPreserved = { ...afterData };
  delete beforePreserved.status;
  delete beforePreserved.updatedAt;
  delete afterPreserved.status;
  delete afterPreserved.updatedAt;
  assert.deepEqual(afterPreserved, beforePreserved);
  assert.equal(afterData.status, 'Pago');
  assert.equal(afterData.updatedAt instanceof admin.firestore.Timestamp, true);
}

async function seedManyDeliveries(user, clientDocumentId, count) {
  const collection = firestore.collection('users').doc(user.uid).collection('deliveries');
  const ids = Array.from(
    { length: count },
    (_, index) => `synthetic-${String(index).padStart(3, '0')}`,
  );
  for (let offset = 0; offset < ids.length; offset += 400) {
    const batch = firestore.batch();
    for (const id of ids.slice(offset, offset + 400)) {
      batch.set(collection.doc(id), makeDelivery(clientDocumentId, { totalValue: 1 }));
    }
    await batch.commit();
  }
  return ids;
}

test('requires Auth Emulator identity and rejects non-canonical client IDs', async () => {
  await assert.rejects(
    callCallable(null, {
      operation: 'preview',
      clientId: 'client:synthetic-client',
      visibleDeliveryIds: ['synthetic-delivery'],
    }),
    (error) => error.status === 'UNAUTHENTICATED',
  );

  const user = await createSyntheticUser();
  await assert.rejects(
    callCallable(user, {
      operation: 'preview',
      clientId: 'legacy:Cliente Sintético',
      visibleDeliveryIds: ['synthetic-delivery'],
    }),
    (error) => error.status === 'INVALID_ARGUMENT',
  );
});

test('previews and commits only one UID/clientId while preserving financial fields', async () => {
  const owner = await createSyntheticUser();
  const otherUid = await createSyntheticUser();
  await seedClient(owner, 'canonical-a', 'Cliente Sintético Repetido');
  await seedClient(owner, 'canonical-b', 'Cliente Sintético Repetido');
  await seedClient(otherUid, 'canonical-a', 'Cliente Sintético Repetido');

  const firstRef = await seedDelivery(owner, 'owner-a-1', 'canonical-a', {
    clientNameSnapshot: 'Nome histórico anterior',
    totalValue: 12.5,
    unitPriceHistorical: 10.25,
    quantity: 2,
  });
  const secondRef = await seedDelivery(owner, 'owner-a-2', 'canonical-a', {
    clientNameSnapshot: 'Nome histórico posterior',
    totalValue: 25,
  });
  const otherClientRef = await seedDelivery(owner, 'owner-b-1', 'canonical-b', {
    totalValue: 90,
  });
  const otherUidRef = await seedDelivery(otherUid, 'owner-a-1', 'canonical-a', {
    totalValue: 120,
  });
  const before = {
    'owner-a-1': (await firstRef.get()).data(),
    'owner-a-2': (await secondRef.get()).data(),
  };

  const previewResult = await preview(owner, 'canonical-a', ['owner-a-1', 'owner-a-2']);
  assert.deepEqual(
    {
      status: previewResult.status,
      clientName: previewResult.clientName,
      eligibleCount: previewResult.eligibleCount,
      totalCents: previewResult.totalCents,
    },
    {
      status: 'ready',
      clientName: 'Cliente Sintético Repetido',
      eligibleCount: 2,
      totalCents: 3750,
    },
  );

  const operationId = randomUUID();
  const committed = await commit(
    owner,
    'canonical-a',
    ['owner-a-1', 'owner-a-2'],
    previewResult.snapshotFingerprint,
    operationId,
  );
  assert.equal(committed.status, 'committed');
  assert.equal(committed.eligibleCount, 2);
  assert.equal(committed.totalCents, 3750);
  await assertDeliveryUpdatedOnlyForPayment(owner, 'owner-a-1', before['owner-a-1']);
  await assertDeliveryUpdatedOnlyForPayment(owner, 'owner-a-2', before['owner-a-2']);
  assert.equal((await otherClientRef.get()).data().status, 'Não Pago');
  assert.equal((await otherUidRef.get()).data().status, 'Não Pago');

  const receipts = await readReceipts(owner);
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].id, operationId);
  assert.equal(receipts[0].result.totalCents, 3750);
  assert.equal((await readReceipts(otherUid)).length, 0);
});

test('blocks presentation mismatch, legacy rows, duplicate-name clients, and ineligible deliveries', async () => {
  const user = await createSyntheticUser();
  await seedClient(user, 'canonical-a', 'Cliente Sintético Igual');
  await seedClient(user, 'canonical-b', 'Cliente Sintético Igual');
  await seedClient(user, 'canonical-c', 'Cliente Sintético Já Pago');
  await seedDelivery(user, 'eligible-a', 'canonical-a');
  await seedDelivery(user, 'not-delivered', 'canonical-a', { delivered: false });
  await seedDelivery(user, 'already-paid', 'canonical-a', { status: 'Pago' });
  await seedDelivery(user, 'legacy-no-client-id', null);
  await seedDelivery(user, 'same-name-other-client', 'canonical-b');
  await seedDelivery(user, 'canonical-c-already-paid', 'canonical-c', { status: 'Pago' });

  const mismatch = await preview(user, 'canonical-a', ['eligible-a', 'legacy-no-client-id']);
  assert.equal(mismatch.status, 'presentation-mismatch');
  assert.equal(mismatch.eligibleCount, 1);
  assert.equal(mismatch.noLongerEligibleCount, 1);

  const wrongClientCard = await preview(user, 'canonical-b', ['already-paid']);
  assert.equal(wrongClientCard.status, 'presentation-mismatch');
  assert.equal(wrongClientCard.eligibleCount, 1);

  const distinctSameNameClient = await preview(user, 'canonical-b', ['same-name-other-client']);
  assert.equal(distinctSameNameClient.status, 'ready');
  assert.equal(distinctSameNameClient.eligibleCount, 1);

  const allPaid = await preview(user, 'canonical-c', ['canonical-c-already-paid']);
  assert.equal(allPaid.status, 'presentation-mismatch');
  assert.equal(allPaid.eligibleCount, 0);
  assert.equal(allPaid.totalCents, 0);

  const ready = await preview(user, 'canonical-a', ['eligible-a']);
  assert.equal(ready.status, 'ready');
  const result = await commit(
    user,
    'canonical-a',
    ['eligible-a'],
    ready.snapshotFingerprint,
    randomUUID(),
  );
  assert.equal(result.eligibleCount, 1);
  assert.equal((await readDelivery(user, 'eligible-a')).status, 'Pago');
  assert.equal((await readDelivery(user, 'not-delivered')).status, 'Não Pago');
  assert.equal((await readDelivery(user, 'already-paid')).status, 'Pago');
  assert.equal((await readDelivery(user, 'legacy-no-client-id')).status, 'Não Pago');
  assert.equal((await readDelivery(user, 'same-name-other-client')).status, 'Não Pago');
});

test('aborts a stale fingerprint after a concurrent eligible delivery is added', async () => {
  const user = await createSyntheticUser();
  await seedClient(user, 'concurrent-client', 'Cliente Concorrente Sintético');
  await seedDelivery(user, 'concurrent-first', 'concurrent-client');
  const previewResult = await preview(user, 'concurrent-client', ['concurrent-first']);
  await seedDelivery(user, 'concurrent-added', 'concurrent-client', { totalValue: 37 });

  await assert.rejects(
    commit(
      user,
      'concurrent-client',
      ['concurrent-first'],
      previewResult.snapshotFingerprint,
      randomUUID(),
    ),
    (error) => error.status === 'FAILED_PRECONDITION',
  );
  assert.equal((await readDelivery(user, 'concurrent-first')).status, 'Não Pago');
  assert.equal((await readDelivery(user, 'concurrent-added')).status, 'Não Pago');
  assert.equal((await readReceipts(user)).length, 0);
});

test('requires the preview fingerprint at confirmation and leaves the set unpaid on mismatch', async () => {
  const user = await createSyntheticUser();
  await seedClient(user, 'fingerprint-client', 'Cliente Fingerprint Sintético');
  await seedDelivery(user, 'fingerprint-delivery', 'fingerprint-client');
  const result = await preview(user, 'fingerprint-client', ['fingerprint-delivery']);

  await assert.rejects(
    commit(user, 'fingerprint-client', ['fingerprint-delivery'], '0'.repeat(64), randomUUID()),
    (error) => error.status === 'FAILED_PRECONDITION',
  );
  assert.equal((await readDelivery(user, 'fingerprint-delivery')).status, 'Não Pago');
  assert.equal((await readReceipts(user)).length, 0);
  assert.equal(result.status, 'ready');
});

test('aborts a transaction with malformed concurrent data without partial payment', async () => {
  const user = await createSyntheticUser();
  await seedClient(user, 'rollback-client', 'Cliente Rollback Sintético');
  await seedDelivery(user, 'rollback-first', 'rollback-client');
  const malformedRef = await seedDelivery(user, 'rollback-second', 'rollback-client');
  const previewResult = await preview(user, 'rollback-client', [
    'rollback-first',
    'rollback-second',
  ]);
  await malformedRef.update({ quantity: 'quantidade-invalida' });

  await assert.rejects(
    commit(
      user,
      'rollback-client',
      ['rollback-first', 'rollback-second'],
      previewResult.snapshotFingerprint,
      randomUUID(),
    ),
    (error) => error.status === 'FAILED_PRECONDITION',
  );
  assert.equal((await readDelivery(user, 'rollback-first')).status, 'Não Pago');
  assert.equal((await readDelivery(user, 'rollback-second')).status, 'Não Pago');
  assert.equal((await readReceipts(user)).length, 0);
});

test('serializes simultaneous duplicate commits into one persistent receipt', async () => {
  const user = await createSyntheticUser();
  await seedClient(user, 'double-tap-client', 'Cliente Duplo Toque Sintético');
  await seedDelivery(user, 'double-tap-a', 'double-tap-client');
  await seedDelivery(user, 'double-tap-b', 'double-tap-client', { totalValue: 8 });
  const ids = ['double-tap-a', 'double-tap-b'];
  const previewResult = await preview(user, 'double-tap-client', ids);
  const operationId = randomUUID();

  const outcomes = await Promise.allSettled([
    commit(user, 'double-tap-client', ids, previewResult.snapshotFingerprint, operationId),
    commit(user, 'double-tap-client', ids, previewResult.snapshotFingerprint, operationId),
  ]);
  assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 2);
  const results = outcomes.map((outcome) => outcome.value);
  assert.deepEqual(results.map((result) => result.replayed).sort(), [false, true]);
  assert.equal((await readReceipts(user)).length, 1);
  for (const id of ids) assert.equal((await readDelivery(user, id)).status, 'Pago');
});

test('allows only one of two concurrent distinct operations and leaves no partial state', async () => {
  const user = await createSyntheticUser();
  await seedClient(user, 'race-client', 'Cliente Corrida Sintético');
  await seedDelivery(user, 'race-a', 'race-client');
  await seedDelivery(user, 'race-b', 'race-client');
  const ids = ['race-a', 'race-b'];
  const previewResult = await preview(user, 'race-client', ids);

  const outcomes = await Promise.allSettled([
    commit(user, 'race-client', ids, previewResult.snapshotFingerprint, randomUUID()),
    commit(user, 'race-client', ids, previewResult.snapshotFingerprint, randomUUID()),
  ]);
  assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter((outcome) => outcome.status === 'rejected').length, 1);
  const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
  assert.equal(
    ['FAILED_PRECONDITION', 'ABORTED', 'INTERNAL'].includes(rejected.reason.status),
    true,
    `unexpected transaction failure: ${rejected.reason.status}`,
  );
  assert.equal((await readReceipts(user)).length, 1);
  for (const id of ids) assert.equal((await readDelivery(user, id)).status, 'Pago');
});

test('recovers a lost reply, replays its receipt, and accepts a fresh later operation', async () => {
  const user = await createSyntheticUser();
  await seedClient(user, 'retry-client', 'Cliente Retry Sintético');
  await seedDelivery(user, 'retry-first', 'retry-client', { totalValue: 14 });
  const firstIds = ['retry-first'];
  const firstPreview = await preview(user, 'retry-client', firstIds);
  const firstOperationId = randomUUID();

  await forwardCommitAndDropReply(user, {
    operation: 'commit',
    clientId: canonicalClientId('retry-client'),
    visibleDeliveryIds: firstIds,
    snapshotFingerprint: firstPreview.snapshotFingerprint,
    idempotencyKey: firstOperationId,
  });
  const recovered = await readStatus(user, firstOperationId);
  assert.equal(recovered.status, 'committed');
  assert.equal(recovered.result.replayed, true);
  const replay = await commit(
    user,
    'retry-client',
    firstIds,
    firstPreview.snapshotFingerprint,
    firstOperationId,
  );
  assert.equal(replay.replayed, true);
  assert.equal((await readReceipts(user)).length, 1);

  await seedDelivery(user, 'retry-later', 'retry-client', { totalValue: 5 });
  const secondIds = ['retry-later'];
  const secondPreview = await preview(user, 'retry-client', secondIds);
  const secondOperationId = randomUUID();
  assert.notEqual(secondOperationId, firstOperationId);
  const secondCommit = await commit(
    user,
    'retry-client',
    secondIds,
    secondPreview.snapshotFingerprint,
    secondOperationId,
  );
  assert.equal(secondCommit.eligibleCount, 1);
  assert.equal((await readDelivery(user, 'retry-later')).status, 'Pago');
  assert.equal((await readReceipts(user)).length, 2);
});

test('reports the 500th eligible delivery as over the safe transaction limit without writes', async () => {
  const user = await createSyntheticUser();
  await seedClient(user, 'limit-client', 'Cliente Limite Sintético');
  const ids = await seedManyDeliveries(user, 'limit-client', 500);
  const result = await preview(user, 'limit-client', ids);
  assert.equal(result.status, 'limit-exceeded');
  assert.equal(result.minimumEligibleCount, 500);
  assert.equal(result.maxEligibleCount, 499);
  const open = await firestore
    .collection('users')
    .doc(user.uid)
    .collection('deliveries')
    .where('clientId', '==', 'limit-client')
    .where('status', '==', 'Não Pago')
    .where('delivered', '==', true)
    .get();
  assert.equal(open.size, 500);
  assert.equal((await readReceipts(user)).length, 0);
});

test(
  'commits the safe boundary of 499 deliveries plus one receipt atomically',
  { timeout: 120_000 },
  async () => {
    const user = await createSyntheticUser();
    await seedClient(user, 'boundary-client', 'Cliente Limite Seguro Sintético');
    const ids = await seedManyDeliveries(user, 'boundary-client', 499);
    const result = await preview(user, 'boundary-client', ids);
    assert.equal(result.status, 'ready');
    assert.equal(result.eligibleCount, 499);
    assert.equal(result.totalCents, 49_900);
    const operationId = randomUUID();
    const committed = await commit(
      user,
      'boundary-client',
      ids,
      result.snapshotFingerprint,
      operationId,
    );
    assert.equal(committed.status, 'committed');
    assert.equal(committed.updatedDeliveries.length, 499);

    const remainingOpen = await firestore
      .collection('users')
      .doc(user.uid)
      .collection('deliveries')
      .where('clientId', '==', 'boundary-client')
      .where('status', '==', 'Não Pago')
      .where('delivered', '==', true)
      .get();
    assert.equal(remainingOpen.size, 0);
    const receipts = await readReceipts(user);
    assert.equal(receipts.length, 1);
    assert.equal(receipts[0].id, operationId);
    assert.equal(receipts[0].result.eligibleCount, 499);
  },
);
