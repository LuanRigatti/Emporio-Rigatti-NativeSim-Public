const { createHash, randomBytes, randomUUID, timingSafeEqual } = require('node:crypto');
const { Buffer } = require('node:buffer');

const SESSION_COLLECTION = 'deliveryWidgetActionSessions';
const ACTION_SCOPE = 'deliveries.complete';
// Offline logout cannot notify the server immediately; any issued capability is bounded by this TTL.
const MAX_AUTHORIZATION_AGE_MS = 24 * 60 * 60 * 1000;
const BUSINESS_TIME_ZONE = 'America/Sao_Paulo';
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

class DeliveryWidgetActionError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function readBearer(request) {
  const authorization = request.get?.('authorization') ?? request.headers?.authorization ?? '';
  const match = /^Bearer ([A-Za-z0-9._-]{32,4096})$/.exec(authorization);
  if (!match) throw new DeliveryWidgetActionError(401, 'unauthorized');
  return match[1];
}

function requireString(value, code, maxLength = 256) {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > maxLength ||
    value.includes('/')
  ) {
    throw new DeliveryWidgetActionError(400, code);
  }
  return value;
}

function businessDate(now = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
  }).formatToParts(new Date(now));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function normalizeClientKey(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function formatClientName(value) {
  const normalized = normalizeClientKey(value);
  const alias =
    normalized === 'santos'
      ? 'Elias'
      : normalized === 'vianna'
        ? 'Viana'
        : ['adri guilhem', 'adriguilhem', 'adri guilherme', 'adri guilhen'].includes(normalized)
          ? 'Adri'
          : value;

  return alias
    .trim()
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function deliveryTimestampMillis(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (value instanceof Date) {
    const milliseconds = value.getTime();
    return Number.isFinite(milliseconds) ? milliseconds : undefined;
  }
  if (!value || typeof value !== 'object') return undefined;

  if (typeof value.toMillis === 'function') {
    const milliseconds = value.toMillis();
    return Number.isFinite(milliseconds) ? milliseconds : undefined;
  }
  if (typeof value.seconds === 'number') {
    const nanoseconds = typeof value.nanoseconds === 'number' ? value.nanoseconds : 0;
    const milliseconds = value.seconds * 1000 + nanoseconds / 1_000_000;
    return Number.isFinite(milliseconds) ? milliseconds : undefined;
  }
  return undefined;
}

function deliveryOrderMillis(delivery) {
  return (
    deliveryTimestampMillis(delivery.dateAddedAt) ?? deliveryTimestampMillis(delivery.createdAt)
  );
}

function compareDeliveryIds(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareDeliveryRows(left, right) {
  const leftOrder = deliveryOrderMillis(left);
  const rightOrder = deliveryOrderMillis(right);

  if (leftOrder !== undefined && rightOrder !== undefined) {
    return leftOrder - rightOrder || compareDeliveryIds(left.id, right.id);
  }
  if (leftOrder !== undefined) return -1;
  if (rightOrder !== undefined) return 1;
  return compareDeliveryIds(left.id, right.id);
}

function projectCompleteDay(documents, date, revision) {
  const dayDeliveries = documents.map(({ id, data }) => ({ ...data, id }));
  if (dayDeliveries.some((delivery) => typeof delivery.delivered !== 'boolean')) {
    throw new DeliveryWidgetActionError(409, 'incomplete_day_snapshot');
  }
  const deliveries = dayDeliveries
    .filter((delivery) => delivery.delivered === false)
    .sort(compareDeliveryRows)
    .map((delivery) => {
      const quantity = delivery.quantity;
      const value = delivery.totalValue;
      const quantityText =
        typeof quantity === 'number' && Number.isFinite(quantity)
          ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(quantity)
          : '—';

      return {
        id: delivery.id,
        clientName:
          typeof delivery.clientNameSnapshot === 'string'
            ? formatClientName(delivery.clientNameSnapshot)
            : '',
        quantityLabel: `${quantityText} ${quantity === 1 ? 'balde' : 'baldes'}`,
        valueLabel:
          typeof value === 'number' && Number.isFinite(value)
            ? new Intl.NumberFormat('pt-BR', { currency: 'BRL', style: 'currency' }).format(value)
            : '—',
      };
    });

  return {
    snapshotComplete: true,
    date,
    state: deliveries.length > 0 ? 'pending' : dayDeliveries.length > 0 ? 'all_completed' : 'empty',
    deliveryCount: deliveries.length,
    deliveries,
    revision,
  };
}

function createDeliveryWidgetActionsHandler({
  admin,
  auth = admin.auth(),
  db = admin.firestore(),
  now = Date.now,
  makeToken = () => randomBytes(32).toString('base64url'),
  makeSessionId = randomUUID,
}) {
  const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();

  async function issue(request, response) {
    const idToken = readBearer(request);
    let decoded;
    try {
      decoded = await auth.verifyIdToken(idToken, true);
    } catch {
      throw new DeliveryWidgetActionError(401, 'unauthorized');
    }
    if (
      typeof decoded?.uid !== 'string' ||
      !decoded.uid ||
      !Number.isSafeInteger(decoded.auth_time) ||
      decoded.auth_time <= 0
    ) {
      throw new DeliveryWidgetActionError(401, 'unauthorized');
    }

    const issuedAtMs = now();
    const firebaseAuthTimeMs = decoded.auth_time * 1000;
    await assertCurrentFirebaseSession(auth, decoded.uid, firebaseAuthTimeMs);

    const sessionId = makeSessionId();
    const refreshCapability = makeToken();
    const absoluteExpiresAt = issuedAtMs + MAX_AUTHORIZATION_AGE_MS;
    const expiresAt = absoluteExpiresAt;
    await db
      .collection(SESSION_COLLECTION)
      .doc(sessionId)
      .create({
        uid: decoded.uid,
        scope: ACTION_SCOPE,
        firebaseAuthTimeMs,
        issuedAtMs,
        refreshCapabilityHash: digest(refreshCapability),
        expiresAt,
        absoluteExpiresAt,
        actionRevision: 0,
        createdAt: serverTimestamp(),
        revokedAt: null,
      });

    response.status(200).json({
      sessionId,
      uid: decoded.uid,
      refreshCapability,
      expiresAt,
      absoluteExpiresAt,
    });
  }

  async function renew(request, response) {
    const refreshCapability = readBearer(request);
    const sessionId = requireString(request.body?.sessionId, 'invalid_session');
    const sessionRef = db.collection(SESSION_COLLECTION).doc(sessionId);
    const session = await readAuthorizedSession(sessionRef, refreshCapability, now());
    await assertCurrentFirebaseSession(auth, session.uid, session.firebaseAuthTimeMs);
    response.status(200).json({
      expiresAt: session.expiresAt,
      absoluteExpiresAt: session.absoluteExpiresAt,
    });
  }

  async function complete(request, response) {
    const refreshCapability = readBearer(request);
    const sessionId = requireString(request.body?.sessionId, 'invalid_session');
    const deliveryId = requireString(request.body?.deliveryId, 'invalid_delivery_id');
    const date = requireString(request.body?.date, 'invalid_date', 10);
    if (!ISO_DATE_PATTERN.test(date) || businessDate(now()) !== date) {
      throw new DeliveryWidgetActionError(409, 'stale_delivery_date');
    }

    const sessionRef = db.collection(SESSION_COLLECTION).doc(sessionId);
    const authorizedSession = await readAuthorizedSession(sessionRef, refreshCapability, now());
    await assertCurrentFirebaseSession(
      auth,
      authorizedSession.uid,
      authorizedSession.firebaseAuthTimeMs,
    );

    let result;
    await db.runTransaction(async (transaction) => {
      if (businessDate(now()) !== date) {
        throw new DeliveryWidgetActionError(409, 'stale_delivery_date');
      }
      const sessionSnapshot = await transaction.get(sessionRef);
      const session = sessionSnapshot.exists ? sessionSnapshot.data() : null;
      if (!isSessionAuthorized(session, refreshCapability, now())) {
        throw new DeliveryWidgetActionError(401, 'authorization_expired');
      }
      if (
        session.uid !== authorizedSession.uid ||
        session.firebaseAuthTimeMs !== authorizedSession.firebaseAuthTimeMs
      ) {
        throw new DeliveryWidgetActionError(401, 'authorization_expired');
      }

      const targetRef = db
        .collection('users')
        .doc(session.uid)
        .collection('deliveries')
        .doc(deliveryId);
      const dayQuery = db
        .collection('users')
        .doc(session.uid)
        .collection('deliveries')
        .where('date', '==', date);
      const targetSnapshot = await transaction.get(targetRef);
      const daySnapshot = await transaction.get(dayQuery);
      if (!targetSnapshot.exists) throw new DeliveryWidgetActionError(404, 'delivery_not_found');
      const target = targetSnapshot.data();
      if (target.date !== date || (target.delivered !== false && target.delivered !== true)) {
        throw new DeliveryWidgetActionError(409, 'delivery_not_eligible');
      }

      const previousRevision = Number.isSafeInteger(session.actionRevision)
        ? session.actionRevision
        : 0;
      const revision = target.delivered === false ? previousRevision + 1 : previousRevision;
      if (target.delivered === false) {
        transaction.update(targetRef, {
          delivered: true,
          updatedAt: serverTimestamp(),
        });
        transaction.update(sessionRef, {
          actionRevision: revision,
          lastActionAt: serverTimestamp(),
        });
      }

      const dayDocuments = daySnapshot.docs.map((document) => ({
        id: document.id,
        data:
          document.id === deliveryId ? { ...document.data(), delivered: true } : document.data(),
      }));
      result = projectCompleteDay(dayDocuments, date, revision);
    });

    response.status(200).json(result);
  }

  async function revoke(request, response) {
    const refreshCapability = readBearer(request);
    const sessionId = requireString(request.body?.sessionId, 'invalid_session');
    const sessionRef = db.collection(SESSION_COLLECTION).doc(sessionId);
    let revoked = false;

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(sessionRef);
      const session = snapshot.exists ? snapshot.data() : null;
      if (
        !session ||
        session.scope !== ACTION_SCOPE ||
        typeof session.uid !== 'string' ||
        !matchesCapabilityHash(session.refreshCapabilityHash, refreshCapability)
      ) {
        throw new DeliveryWidgetActionError(401, 'unauthorized');
      }
      if (session.revokedAt == null) {
        transaction.update(sessionRef, {
          revokedAt: serverTimestamp(),
        });
      }
      revoked = true;
    });

    response.status(200).json({ revoked });
  }

  return async function deliveryWidgetActions(request, response) {
    if (request.method !== 'POST') {
      response.set('Allow', 'POST');
      response.status(405).json({ error: 'method_not_allowed' });
      return;
    }

    try {
      const operation = request.body?.operation;
      if (operation === 'issue') return await issue(request, response);
      if (operation === 'renew') return await renew(request, response);
      if (operation === 'complete') return await complete(request, response);
      if (operation === 'revoke') return await revoke(request, response);
      throw new DeliveryWidgetActionError(400, 'invalid_operation');
    } catch (error) {
      const status = error instanceof DeliveryWidgetActionError ? error.status : 500;
      const code = error instanceof DeliveryWidgetActionError ? error.code : 'internal_error';
      response.status(status).json({ error: code });
    }
  };
}

function isSessionAuthorized(session, refreshCapability, timestamp) {
  return Boolean(
    session &&
    session.scope === ACTION_SCOPE &&
    session.revokedAt == null &&
    typeof session.uid === 'string' &&
    session.uid.length > 0 &&
    Number.isFinite(session.expiresAt) &&
    session.expiresAt > timestamp &&
    Number.isFinite(session.absoluteExpiresAt) &&
    session.absoluteExpiresAt > timestamp &&
    Number.isSafeInteger(session.issuedAtMs) &&
    session.issuedAtMs <= timestamp &&
    session.absoluteExpiresAt - session.issuedAtMs === MAX_AUTHORIZATION_AGE_MS &&
    session.expiresAt === session.absoluteExpiresAt &&
    Number.isSafeInteger(session.firebaseAuthTimeMs) &&
    session.firebaseAuthTimeMs > 0 &&
    typeof refreshCapability === 'string' &&
    matchesCapabilityHash(session.refreshCapabilityHash, refreshCapability),
  );
}

async function readAuthorizedSession(sessionRef, refreshCapability, timestamp) {
  const snapshot = await sessionRef.get();
  const session = snapshot.exists ? snapshot.data() : null;
  if (!isSessionAuthorized(session, refreshCapability, timestamp)) {
    throw new DeliveryWidgetActionError(401, 'authorization_expired');
  }
  return session;
}

function matchesCapabilityHash(storedHash, refreshCapability) {
  if (
    typeof storedHash !== 'string' ||
    !/^[a-f\d]{64}$/i.test(storedHash) ||
    typeof refreshCapability !== 'string'
  ) {
    return false;
  }
  return timingSafeEqual(
    Buffer.from(storedHash, 'hex'),
    Buffer.from(digest(refreshCapability), 'hex'),
  );
}

async function assertCurrentFirebaseSession(auth, uid, firebaseAuthTimeMs) {
  let user;
  try {
    user = await auth.getUser(uid);
  } catch (error) {
    if (error?.code === 'auth/user-not-found') {
      throw new DeliveryWidgetActionError(401, 'authorization_expired');
    }
    throw new DeliveryWidgetActionError(503, 'authorization_unavailable');
  }

  if (user.uid !== uid || user.disabled) {
    throw new DeliveryWidgetActionError(401, 'authorization_expired');
  }

  if (user.tokensValidAfterTime == null) return;

  const tokensValidAfterMs = Date.parse(user.tokensValidAfterTime);
  if (!Number.isFinite(tokensValidAfterMs)) {
    throw new DeliveryWidgetActionError(503, 'authorization_unavailable');
  }
  if (!Number.isSafeInteger(firebaseAuthTimeMs) || firebaseAuthTimeMs < tokensValidAfterMs) {
    throw new DeliveryWidgetActionError(401, 'authorization_expired');
  }
}

module.exports = {
  ACTION_SCOPE,
  MAX_AUTHORIZATION_AGE_MS,
  SESSION_COLLECTION,
  createDeliveryWidgetActionsHandler,
  projectCompleteDay,
  businessDate,
  digest,
};
