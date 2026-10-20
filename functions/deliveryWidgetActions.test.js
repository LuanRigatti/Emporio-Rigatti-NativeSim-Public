const assert = require('node:assert/strict');
const test = require('node:test');

const {
  MAX_AUTHORIZATION_AGE_MS,
  SESSION_COLLECTION,
  createDeliveryWidgetActionsHandler,
  digest,
  projectCompleteDay,
} = require('./deliveryWidgetActions');

const currentTime = Date.UTC(2026, 9, 15, 16, 0, 0);
const today = '2026-10-15';
const firebaseAuthTimeMs = currentTime - 60_000;
const firebaseIdToken =
  'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiJ1aWQtZGVyaXZlZC1mcm9tLXRva2VuIn0.signature';

function createFakeAdmin(initialDocuments = {}) {
  const documents = new Map(Object.entries(initialDocuments));
  const authUsers = new Map([
    [
      'uid-derived-from-token',
      {
        uid: 'uid-derived-from-token',
        disabled: false,
        tokensValidAfterTime: new Date(currentTime - 3_600_000).toISOString(),
      },
    ],
  ]);
  const timestamp = { __serverTimestamp: true };
  let transactionTail = Promise.resolve();
  let transactionQueryReadCount = 0;

  function reference(path) {
    return {
      path,
      collection(name) {
        return collection(`${path}/${name}`);
      },
      async create(value) {
        if (documents.has(path)) throw new Error('already-exists');
        documents.set(path, structuredClone(value));
      },
      async get() {
        return snapshot(path);
      },
    };
  }

  function collection(path) {
    return {
      doc(id) {
        return reference(`${path}/${id}`);
      },
      where(field, operator, value) {
        return { kind: 'query', path, field, operator, value };
      },
    };
  }

  function snapshot(path) {
    const value = documents.get(path);
    return { exists: value !== undefined, data: () => value && structuredClone(value) };
  }

  const db = {
    collection,
    async runTransaction(callback) {
      let releaseTransaction;
      const previousTransaction = transactionTail;
      transactionTail = new Promise((resolve) => {
        releaseTransaction = resolve;
      });
      await previousTransaction;
      const writes = [];
      const transaction = {
        async get(target) {
          if (target.kind === 'query') {
            transactionQueryReadCount += 1;
            const prefix = `${target.path}/`;
            const docs = [...documents.entries()]
              .filter(
                ([path, value]) =>
                  path.startsWith(prefix) &&
                  !path.slice(prefix.length).includes('/') &&
                  target.operator === '==' &&
                  value[target.field] === target.value,
              )
              .map(([path, value]) => ({
                id: path.slice(prefix.length),
                data: () => structuredClone(value),
              }));
            return { docs };
          }
          return snapshot(target.path);
        },
        create(target, value) {
          writes.push({ kind: 'create', path: target.path, value });
        },
        update(target, value) {
          writes.push({ kind: 'update', path: target.path, value });
        },
      };
      try {
        const result = await callback(transaction);
        for (const write of writes) {
          if (write.kind === 'create') {
            if (documents.has(write.path)) throw new Error('already-exists');
            documents.set(write.path, structuredClone(write.value));
          } else {
            const previous = documents.get(write.path);
            if (!previous) throw new Error('not-found');
            documents.set(write.path, { ...previous, ...structuredClone(write.value) });
          }
        }
        return result;
      } finally {
        releaseTransaction();
      }
    },
    dump(path) {
      return structuredClone(documents.get(path));
    },
    delete(path) {
      documents.delete(path);
    },
    transactionQueryReadCount: () => transactionQueryReadCount,
  };

  const auth = {
    verifyIdToken: async (token, checkRevoked) => {
      assert.equal(token, firebaseIdToken);
      assert.equal(checkRevoked, true);
      return {
        uid: 'uid-derived-from-token',
        auth_time: Math.floor(firebaseAuthTimeMs / 1000),
      };
    },
    getUser: async (uid) => {
      const user = authUsers.get(uid);
      if (!user) {
        const error = new Error('not found');
        error.code = 'auth/user-not-found';
        throw error;
      }
      return structuredClone(user);
    },
  };

  return {
    auth,
    authUsers,
    db,
    admin: {
      auth: () => auth,
      firestore: Object.assign(() => db, { FieldValue: { serverTimestamp: () => timestamp } }),
    },
  };
}

function responseMock() {
  return {
    body: undefined,
    statusCode: 200,
    headers: {},
    set(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function requestMock({ operation, authorization, body = {}, method = 'POST' }) {
  return {
    body: { operation, ...body },
    method,
    headers: { authorization },
    get(name) {
      return this.headers[name.toLowerCase()] ?? '';
    },
  };
}

async function invoke(handler, request) {
  const response = responseMock();
  await handler(request, response);
  return response;
}

function deterministicHandler(fake, options = {}) {
  let tokenIndex = 0;
  return createDeliveryWidgetActionsHandler({
    admin: fake.admin,
    now: options.now ?? (() => currentTime),
    makeSessionId: () => 'session-server-generated',
    makeToken: () => `opaque-capability-${String(++tokenIndex).padStart(32, '0')}`,
  });
}

test('issues a scoped authorization from verified Firebase identity and stores only a hash', async () => {
  const fake = createFakeAdmin();
  const handler = deterministicHandler(fake);
  const response = await invoke(
    handler,
    requestMock({
      operation: 'issue',
      authorization: `Bearer ${firebaseIdToken}`,
      body: { uid: 'attacker-supplied-uid' },
    }),
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.uid, 'uid-derived-from-token');
  assert.equal(response.body.sessionId, 'session-server-generated');
  assert.equal(response.body.expiresAt, currentTime + MAX_AUTHORIZATION_AGE_MS);
  assert.equal(response.body.absoluteExpiresAt, currentTime + MAX_AUTHORIZATION_AGE_MS);
  const session = fake.db.dump(`${SESSION_COLLECTION}/session-server-generated`);
  assert.equal(session.uid, 'uid-derived-from-token');
  assert.equal(session.scope, 'deliveries.complete');
  assert.equal(session.firebaseAuthTimeMs, firebaseAuthTimeMs);
  assert.equal(session.issuedAtMs, currentTime);
  assert.equal(session.refreshCapabilityHash, digest(response.body.refreshCapability));
  assert.notEqual(session.refreshCapabilityHash, response.body.refreshCapability);
  assert.equal(session.actionRevision, 0);
});

test('does not issue an authorization for a disabled Firebase user', async () => {
  const fake = createFakeAdmin();
  fake.authUsers.get('uid-derived-from-token').disabled = true;
  const handler = deterministicHandler(fake);

  const response = await invoke(
    handler,
    requestMock({ operation: 'issue', authorization: `Bearer ${firebaseIdToken}` }),
  );

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { error: 'authorization_expired' });
  assert.equal(fake.db.dump(`${SESSION_COLLECTION}/session-server-generated`), undefined);
});

test('allows Firebase accounts with no recorded token-revocation timestamp', async () => {
  const fake = createFakeAdmin();
  fake.authUsers.get('uid-derived-from-token').tokensValidAfterTime = undefined;
  const handler = deterministicHandler(fake);

  const response = await invoke(
    handler,
    requestMock({ operation: 'issue', authorization: `Bearer ${firebaseIdToken}` }),
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.absoluteExpiresAt, currentTime + MAX_AUTHORIZATION_AGE_MS);
});

test('renew validates but never extends the fixed 24-hour authorization', async () => {
  const fake = createFakeAdmin();
  const handler = deterministicHandler(fake);
  const issued = await invoke(
    handler,
    requestMock({ operation: 'issue', authorization: `Bearer ${firebaseIdToken}` }),
  );
  const later = currentTime + MAX_AUTHORIZATION_AGE_MS / 2;
  const renewHandler = createDeliveryWidgetActionsHandler({
    admin: fake.admin,
    now: () => later,
    makeToken: () => 'unused-renewal-token-value-00000000000000000000',
  });
  const renewed = await invoke(
    renewHandler,
    requestMock({
      operation: 'renew',
      authorization: `Bearer ${issued.body.refreshCapability}`,
      body: { sessionId: issued.body.sessionId },
    }),
  );

  assert.equal(renewed.statusCode, 200);
  assert.equal(renewed.body.expiresAt, issued.body.expiresAt);
  assert.equal(renewed.body.absoluteExpiresAt, issued.body.absoluteExpiresAt);
  assert.equal(
    fake.db.dump(`${SESSION_COLLECTION}/session-server-generated`).expiresAt,
    issued.body.expiresAt,
  );

  const afterAbsoluteExpiry = createDeliveryWidgetActionsHandler({
    admin: fake.admin,
    now: () => issued.body.absoluteExpiresAt,
  });
  const expired = await invoke(
    afterAbsoluteExpiry,
    requestMock({
      operation: 'renew',
      authorization: `Bearer ${issued.body.refreshCapability}`,
      body: { sessionId: issued.body.sessionId },
    }),
  );
  assert.equal(expired.statusCode, 401);
  assert.deepEqual(expired.body, { error: 'authorization_expired' });
});

test('rejects capabilities issued by the legacy 90-day authorization format', async () => {
  const capability = 'legacy-capability-012345678901234567890123456789';
  const fake = createFakeAdmin({
    [`${SESSION_COLLECTION}/session-server-generated`]: {
      uid: 'uid-derived-from-token',
      scope: 'deliveries.complete',
      refreshCapabilityHash: digest(capability),
      expiresAt: currentTime + 60_000,
      absoluteExpiresAt: currentTime + 90 * 24 * 60 * 60 * 1000,
      actionRevision: 0,
      revokedAt: null,
    },
  });
  const handler = deterministicHandler(fake);
  const response = await invoke(
    handler,
    requestMock({
      operation: 'renew',
      authorization: `Bearer ${capability}`,
      body: { sessionId: 'session-server-generated' },
    }),
  );

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { error: 'authorization_expired' });
});

test('rejects renewal and completion after the Firebase user is disabled', async () => {
  const fake = createFakeAdmin({
    'users/uid-derived-from-token/deliveries/today': {
      clientNameSnapshot: 'Cliente',
      date: today,
      delivered: false,
      quantity: 1,
      totalValue: 50,
    },
  });
  const handler = deterministicHandler(fake);
  const issued = await invoke(
    handler,
    requestMock({ operation: 'issue', authorization: `Bearer ${firebaseIdToken}` }),
  );
  fake.authUsers.get('uid-derived-from-token').disabled = true;

  const renew = await invoke(
    handler,
    requestMock({
      operation: 'renew',
      authorization: `Bearer ${issued.body.refreshCapability}`,
      body: { sessionId: issued.body.sessionId },
    }),
  );
  const complete = await invoke(
    handler,
    requestMock({
      operation: 'complete',
      authorization: `Bearer ${issued.body.refreshCapability}`,
      body: { sessionId: issued.body.sessionId, deliveryId: 'today', date: today },
    }),
  );

  assert.equal(renew.statusCode, 401);
  assert.equal(complete.statusCode, 401);
  assert.deepEqual(complete.body, { error: 'authorization_expired' });
  assert.equal(fake.db.dump('users/uid-derived-from-token/deliveries/today').delivered, false);
});

test('rejects a capability issued before Firebase token revocation', async () => {
  const fake = createFakeAdmin({
    'users/uid-derived-from-token/deliveries/today': {
      clientNameSnapshot: 'Cliente',
      date: today,
      delivered: false,
      quantity: 1,
      totalValue: 50,
    },
  });
  const handler = deterministicHandler(fake);
  const issued = await invoke(
    handler,
    requestMock({ operation: 'issue', authorization: `Bearer ${firebaseIdToken}` }),
  );
  fake.authUsers.get('uid-derived-from-token').tokensValidAfterTime = new Date(
    firebaseAuthTimeMs + 1000,
  ).toISOString();

  const renewed = await invoke(
    handler,
    requestMock({
      operation: 'renew',
      authorization: `Bearer ${issued.body.refreshCapability}`,
      body: { sessionId: issued.body.sessionId },
    }),
  );
  const response = await invoke(
    handler,
    requestMock({
      operation: 'complete',
      authorization: `Bearer ${issued.body.refreshCapability}`,
      body: { sessionId: issued.body.sessionId, deliveryId: 'today', date: today },
    }),
  );

  assert.equal(renewed.statusCode, 401);
  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { error: 'authorization_expired' });
  assert.equal(fake.db.dump('users/uid-derived-from-token/deliveries/today').delivered, false);
});

test('allows a queued logout revocation to invalidate a capability after expiry', async () => {
  const fake = createFakeAdmin();
  const handler = deterministicHandler(fake);
  const issued = await invoke(
    handler,
    requestMock({ operation: 'issue', authorization: `Bearer ${firebaseIdToken}` }),
  );
  const afterExpiry = createDeliveryWidgetActionsHandler({
    admin: fake.admin,
    now: () => issued.body.expiresAt + 1,
  });

  const revoked = await invoke(
    afterExpiry,
    requestMock({
      operation: 'revoke',
      authorization: `Bearer ${issued.body.refreshCapability}`,
      body: { sessionId: issued.body.sessionId },
    }),
  );
  const session = fake.db.dump(`${SESSION_COLLECTION}/${issued.body.sessionId}`);

  assert.deepEqual(revoked.body, { revoked: true });
  assert.notEqual(session.revokedAt, null);
});

test('rejects a widget action after the fixed capability expires without app JavaScript', async () => {
  const capability = 'expired-capability-012345678901234567890123456789';
  const issuedAtMs = currentTime - MAX_AUTHORIZATION_AGE_MS;
  const fake = createFakeAdmin({
    [`${SESSION_COLLECTION}/session-server-generated`]: {
      uid: 'uid-derived-from-token',
      scope: 'deliveries.complete',
      firebaseAuthTimeMs,
      issuedAtMs,
      refreshCapabilityHash: digest(capability),
      expiresAt: currentTime,
      absoluteExpiresAt: currentTime,
      actionRevision: 0,
      revokedAt: null,
    },
    'users/uid-derived-from-token/deliveries/today': {
      clientNameSnapshot: 'Cliente',
      date: today,
      delivered: false,
      quantity: 1,
      totalValue: 50,
    },
  });
  const handler = deterministicHandler(fake);

  const response = await invoke(
    handler,
    requestMock({
      operation: 'complete',
      authorization: `Bearer ${capability}`,
      body: { sessionId: 'session-server-generated', deliveryId: 'today', date: today },
    }),
  );

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { error: 'authorization_expired' });
  assert.equal(fake.db.dump('users/uid-derived-from-token/deliveries/today').delivered, false);
});

test('returns a sanitized temporary failure if Firebase user state cannot be checked', async () => {
  const fake = createFakeAdmin();
  const handler = deterministicHandler(fake);
  const issued = await invoke(
    handler,
    requestMock({ operation: 'issue', authorization: `Bearer ${firebaseIdToken}` }),
  );
  fake.auth.getUser = async () => {
    throw new Error('private provider detail');
  };

  const response = await invoke(
    handler,
    requestMock({
      operation: 'complete',
      authorization: `Bearer ${issued.body.refreshCapability}`,
      body: { sessionId: issued.body.sessionId, deliveryId: 'missing', date: today },
    }),
  );

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, { error: 'authorization_unavailable' });
});

test('invalidates a capability when the Firebase account has been deleted', async () => {
  const fake = createFakeAdmin();
  const handler = deterministicHandler(fake);
  const issued = await invoke(
    handler,
    requestMock({ operation: 'issue', authorization: `Bearer ${firebaseIdToken}` }),
  );
  fake.auth.getUser = async () => {
    const error = new Error('not found');
    error.code = 'auth/user-not-found';
    throw error;
  };

  const response = await invoke(
    handler,
    requestMock({
      operation: 'complete',
      authorization: `Bearer ${issued.body.refreshCapability}`,
      body: { sessionId: issued.body.sessionId, deliveryId: 'missing', date: today },
    }),
  );

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { error: 'authorization_expired' });
});

test('completes only the derived user delivery and returns a narrow confirmation', async () => {
  const fake = createFakeAdmin({
    'users/uid-derived-from-token/deliveries/ana': {
      clientNameSnapshot: 'Ana',
      date: today,
      delivered: false,
      quantity: 2,
      totalValue: 100,
      status: 'Não Pago',
      paymentMethod: undefined,
      invoiceStatus: 'a_emitir',
    },
    'users/uid-derived-from-token/deliveries/bia': {
      clientNameSnapshot: 'Bia',
      date: today,
      delivered: false,
      quantity: 3,
      totalValue: 150,
      status: 'Não Pago',
    },
    'users/uid-other/deliveries/victim': {
      clientNameSnapshot: 'Outra conta',
      date: today,
      delivered: false,
      quantity: 9,
      totalValue: 900,
      status: 'Não Pago',
    },
  });
  const handler = deterministicHandler(fake);
  const issued = await invoke(
    handler,
    requestMock({ operation: 'issue', authorization: `Bearer ${firebaseIdToken}` }),
  );
  const response = await invoke(
    handler,
    requestMock({
      operation: 'complete',
      authorization: `Bearer ${issued.body.refreshCapability}`,
      body: {
        sessionId: issued.body.sessionId,
        deliveryId: 'ana',
        date: today,
        responseVersion: 2,
        uid: 'uid-other',
      },
    }),
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    confirmed: true,
    deliveryId: 'ana',
    date: today,
    revision: 1,
  });
  assert.equal(fake.db.transactionQueryReadCount(), 0);
  const completed = fake.db.dump('users/uid-derived-from-token/deliveries/ana');
  assert.equal(completed.delivered, true);
  assert.deepEqual(completed.status, 'Não Pago');
  assert.equal(completed.invoiceStatus, 'a_emitir');
  assert.equal(completed.updatedAt.__serverTimestamp, true);
  assert.equal(fake.db.dump('users/uid-other/deliveries/victim').delivered, false);
});

test('keeps the full canonical response for widgets using the legacy action protocol', async () => {
  const fake = createFakeAdmin({
    'users/uid-derived-from-token/deliveries/ana': {
      clientNameSnapshot: 'Ana',
      date: today,
      delivered: false,
      quantity: 2,
      totalValue: 100,
    },
    'users/uid-derived-from-token/deliveries/bia': {
      clientNameSnapshot: 'Bia',
      date: today,
      delivered: false,
      quantity: 3,
      totalValue: 150,
    },
  });
  const handler = deterministicHandler(fake);
  const issued = await invoke(
    handler,
    requestMock({ operation: 'issue', authorization: `Bearer ${firebaseIdToken}` }),
  );
  const response = await invoke(
    handler,
    requestMock({
      operation: 'complete',
      authorization: `Bearer ${issued.body.refreshCapability}`,
      body: { sessionId: issued.body.sessionId, deliveryId: 'ana', date: today },
    }),
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.snapshotComplete, true);
  assert.equal(response.body.state, 'pending');
  assert.equal(response.body.deliveryCount, 1);
  assert.equal(response.body.deliveries[0].id, 'bia');
  assert.equal(fake.db.transactionQueryReadCount(), 1);
});

test('legacy widget snapshots keep Firestore IDs and canonical delivery order', () => {
  const snapshot = projectCompleteDay(
    [
      {
        id: 'added-late',
        data: {
          id: 'untrusted-payload-id',
          dateAddedAt: 300,
          createdAt: 1,
          delivered: false,
        },
      },
      { id: 'tie-b', data: { createdAt: 100, delivered: false } },
      { id: 'added-early', data: { dateAddedAt: 100, createdAt: 900, delivered: false } },
      { id: 'legacy-first', data: { createdAt: new Date(50), delivered: false } },
      { id: 'tie-a', data: { createdAt: 100, delivered: false } },
      { id: 'unknown-b', data: { delivered: false } },
      { id: 'unknown-a', data: { delivered: false } },
    ],
    today,
    1,
  );

  assert.deepEqual(
    snapshot.deliveries.map(({ id }) => id),
    ['legacy-first', 'added-early', 'tie-a', 'tie-b', 'added-late', 'unknown-a', 'unknown-b'],
  );
});

test('repeated completion is idempotent and returns the unchanged revision', async () => {
  const fake = createFakeAdmin({
    'users/uid-derived-from-token/deliveries/already': {
      clientNameSnapshot: 'Cliente',
      date: today,
      delivered: false,
      quantity: 1,
      totalValue: 50,
    },
  });
  const handler = deterministicHandler(fake);
  const issued = await invoke(
    handler,
    requestMock({ operation: 'issue', authorization: `Bearer ${firebaseIdToken}` }),
  );
  const complete = () =>
    invoke(
      handler,
      requestMock({
        operation: 'complete',
        authorization: `Bearer ${issued.body.refreshCapability}`,
        body: {
          sessionId: issued.body.sessionId,
          deliveryId: 'already',
          date: today,
          responseVersion: 2,
        },
      }),
    );

  const first = await complete();
  const updatedAt = fake.db.dump('users/uid-derived-from-token/deliveries/already').updatedAt;
  const second = await complete();
  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.deepEqual(second.body, {
    confirmed: true,
    deliveryId: 'already',
    date: today,
    revision: first.body.revision,
  });
  assert.equal(second.body.revision, first.body.revision);
  assert.deepEqual(
    fake.db.dump('users/uid-derived-from-token/deliveries/already').updatedAt,
    updatedAt,
  );
  fake.db.delete('users/uid-derived-from-token/deliveries/already');
  const empty = await complete();
  assert.equal(empty.statusCode, 404);
});

test('concurrent duplicate completion requests write the canonical delivery once', async () => {
  const fake = createFakeAdmin({
    'users/uid-derived-from-token/deliveries/same': {
      clientNameSnapshot: 'Cliente',
      date: today,
      delivered: false,
      quantity: 1,
      totalValue: 50,
    },
  });
  const handler = deterministicHandler(fake);
  const issued = await invoke(
    handler,
    requestMock({ operation: 'issue', authorization: `Bearer ${firebaseIdToken}` }),
  );
  const complete = () =>
    invoke(
      handler,
      requestMock({
        operation: 'complete',
        authorization: `Bearer ${issued.body.refreshCapability}`,
        body: {
          sessionId: issued.body.sessionId,
          deliveryId: 'same',
          date: today,
          responseVersion: 2,
        },
      }),
    );

  const [first, second] = await Promise.all([complete(), complete()]);
  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(first.body.confirmed, true);
  assert.equal(second.body.confirmed, true);
  assert.equal(first.body.revision, 1);
  assert.equal(second.body.revision, 1);
  assert.equal(fake.db.dump(`${SESSION_COLLECTION}/session-server-generated`).actionRevision, 1);
  assert.equal(fake.db.dump('users/uid-derived-from-token/deliveries/same').delivered, true);
  assert.equal(fake.db.transactionQueryReadCount(), 0);
});

test('serializes concurrent widget actions and returns a confirmation per delivery', async () => {
  const fake = createFakeAdmin({
    'users/uid-derived-from-token/deliveries/first': {
      clientNameSnapshot: 'A Cliente',
      date: today,
      delivered: false,
      quantity: 1,
      totalValue: 50,
      status: 'Não Pago',
    },
    'users/uid-derived-from-token/deliveries/second': {
      clientNameSnapshot: 'B Cliente',
      date: today,
      delivered: false,
      quantity: 2,
      totalValue: 100,
      status: 'Não Pago',
    },
  });
  const handler = deterministicHandler(fake);
  const issued = await invoke(
    handler,
    requestMock({ operation: 'issue', authorization: `Bearer ${firebaseIdToken}` }),
  );
  const complete = (deliveryId) =>
    invoke(
      handler,
      requestMock({
        operation: 'complete',
        authorization: `Bearer ${issued.body.refreshCapability}`,
        body: { sessionId: issued.body.sessionId, deliveryId, date: today, responseVersion: 2 },
      }),
    );

  const [first, second] = await Promise.all([complete('first'), complete('second')]);
  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.deepEqual([first.body.deliveryId, second.body.deliveryId].sort(), ['first', 'second']);
  assert.equal(first.body.confirmed, true);
  assert.equal(second.body.confirmed, true);
  assert.equal(Math.max(first.body.revision, second.body.revision), 2);
  assert.equal(fake.db.transactionQueryReadCount(), 0);
  assert.equal(fake.db.dump(`${SESSION_COLLECTION}/session-server-generated`).actionRevision, 2);
  assert.equal(fake.db.dump('users/uid-derived-from-token/deliveries/first').delivered, true);
  assert.equal(fake.db.dump('users/uid-derived-from-token/deliveries/second').delivered, true);
});

test('rejects expired dates, invalid sessions, and a revoked authorization', async () => {
  const fake = createFakeAdmin({
    'users/uid-derived-from-token/deliveries/today': {
      clientNameSnapshot: 'Cliente',
      date: today,
      delivered: false,
      quantity: 1,
      totalValue: 50,
    },
  });
  const handler = deterministicHandler(fake);
  const issued = await invoke(
    handler,
    requestMock({ operation: 'issue', authorization: `Bearer ${firebaseIdToken}` }),
  );

  const stale = await invoke(
    handler,
    requestMock({
      operation: 'complete',
      authorization: `Bearer ${issued.body.refreshCapability}`,
      body: { sessionId: issued.body.sessionId, deliveryId: 'today', date: '2026-10-14' },
    }),
  );
  assert.equal(stale.statusCode, 409);
  assert.deepEqual(stale.body, { error: 'stale_delivery_date' });

  const revoked = await invoke(
    handler,
    requestMock({
      operation: 'revoke',
      authorization: `Bearer ${issued.body.refreshCapability}`,
      body: { sessionId: issued.body.sessionId },
    }),
  );
  assert.deepEqual(revoked.body, { revoked: true });
  const repeatedRevoke = await invoke(
    handler,
    requestMock({
      operation: 'revoke',
      authorization: `Bearer ${issued.body.refreshCapability}`,
      body: { sessionId: issued.body.sessionId },
    }),
  );
  assert.deepEqual(repeatedRevoke.body, { revoked: true });
  const action = await invoke(
    handler,
    requestMock({
      operation: 'complete',
      authorization: `Bearer ${issued.body.refreshCapability}`,
      body: { sessionId: issued.body.sessionId, deliveryId: 'today', date: today },
    }),
  );
  assert.equal(action.statusCode, 401);
  assert.deepEqual(action.body, { error: 'authorization_expired' });
});

test('rejects malformed capability timing metadata', async () => {
  const capability = 'opaque-capability-00000000000000000000000000000001';
  const fake = createFakeAdmin({
    [`${SESSION_COLLECTION}/session-server-generated`]: {
      uid: 'uid-derived-from-token',
      scope: 'deliveries.complete',
      refreshCapabilityHash: digest(capability),
      expiresAt: currentTime + 60_000,
      absoluteExpiresAt: currentTime,
      actionRevision: 0,
      revokedAt: null,
    },
    'users/uid-derived-from-token/deliveries/today': {
      clientNameSnapshot: 'Cliente',
      date: today,
      delivered: false,
      quantity: 1,
      totalValue: 50,
    },
  });
  const handler = deterministicHandler(fake);
  const response = await invoke(
    handler,
    requestMock({
      operation: 'complete',
      authorization: `Bearer ${capability}`,
      body: {
        sessionId: 'session-server-generated',
        deliveryId: 'today',
        date: today,
      },
    }),
  );

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { error: 'authorization_expired' });
  assert.equal(fake.db.dump('users/uid-derived-from-token/deliveries/today').delivered, false);
});

test('rejects path separators in externally supplied document identifiers', async () => {
  const fake = createFakeAdmin();
  const handler = deterministicHandler(fake);
  const response = await invoke(
    handler,
    requestMock({
      operation: 'complete',
      authorization: 'Bearer capability-012345678901234567890123456789',
      body: { sessionId: 'session/nested', deliveryId: 'delivery/other', date: today },
    }),
  );
  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, { error: 'invalid_session' });
});

test('denies missing bearer tokens and ignores Firebase verification failures', async () => {
  const fake = createFakeAdmin();
  const handler = deterministicHandler(fake);
  const missing = await invoke(handler, requestMock({ operation: 'issue', authorization: '' }));
  assert.equal(missing.statusCode, 401);

  const invalidAdmin = {
    ...fake.admin,
    auth: () => ({
      verifyIdToken: async () => {
        throw new Error('raw private detail');
      },
    }),
  };
  const invalidHandler = createDeliveryWidgetActionsHandler({ admin: invalidAdmin });
  const invalid = await invoke(
    invalidHandler,
    requestMock({ operation: 'issue', authorization: `Bearer ${firebaseIdToken}` }),
  );
  assert.deepEqual(invalid.body, { error: 'unauthorized' });
});
