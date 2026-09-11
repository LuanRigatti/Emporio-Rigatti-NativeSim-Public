const { onValueWritten } = require('firebase-functions/v2/database');
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

admin.initializeApp();

const { createRouteProxy } = require('./routeProxy');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const APP_WEB_URL = 'https://venda-e-faturamento.web.app';
const googleMapsServerKey = defineSecret('GOOGLE_MAPS_SERVER_API_KEY');

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  return Object.values(value);
}

function asString(value) {
  return typeof value === 'string' ? value : String(value ?? '');
}

function safeNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return 0;
  const normalized = value.trim().replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isExpoToken(token) {
  return token.startsWith('ExpoPushToken[') || token.startsWith('ExponentPushToken[');
}

function notificationData(data) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, asString(value)]));
}

// Keep the route proxy declaration isolated from the remaining notification functions.
exports.routeProxy = onRequest(
  {
    region: 'us-central1',
    timeoutSeconds: 30,
    cors: false,
    secrets: [googleMapsServerKey],
  },
  createRouteProxy({ getApiKey: () => googleMapsServerKey.value() }),
);

async function sendNotification(token, message) {
  if (isExpoToken(token)) {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: token,
        title: message.title,
        body: message.body,
        data: message.data,
        sound: 'default',
      }),
    });
    const payload = await response.json();
    const result = Array.isArray(payload.data) ? payload.data[0] : payload.data;
    if (!response.ok || result?.status === 'error') {
      throw new Error('Expo Push Service rejeitou a notificação.');
    }
    return result?.id ?? 'expo-push';
  }

  return admin.messaging().send({
    token,
    notification: { title: message.title, body: message.body },
    data: notificationData(message.data),
    webpush: {
      fcmOptions: { link: message.webLink ?? APP_WEB_URL },
    },
  });
}

async function sendToUser(usuarioId, message) {
  const snapshot = await admin.database().ref(`usuarios/${usuarioId}/pushToken`).once('value');
  const token = snapshot.val();
  if (typeof token !== 'string' || token.trim() === '') return null;
  return sendNotification(token, message);
}

function newDeliveries(beforeValue, afterValue, beforeExists) {
  const current = asArray(afterValue).filter((item) => item && typeof item === 'object');
  if (!beforeExists) return current.length === 1 ? current : [];

  const previousIds = new Set(
    asArray(beforeValue)
      .filter((item) => item && typeof item === 'object')
      .map((item) => asString(item.id))
      .filter(Boolean),
  );
  return current.filter((item) => {
    const id = asString(item.id);
    return id !== '' && !previousIds.has(id);
  });
}

exports.notificarNovaEntrega = onValueWritten('/usuarios/{usuarioId}/entregas', async (event) => {
  const before = event.data.before;
  const after = event.data.after;
  const deliveries = newDeliveries(before.val(), after.val(), before.exists());
  if (!deliveries.length) return null;

  const results = [];
  for (const delivery of deliveries) {
    results.push(
      await sendToUser(event.params.usuarioId, {
        title: 'Nova entrega registrada',
        body: `Você registrou ${safeNumber(delivery.quantidade)} baldes para ${asString(delivery.cliente)}.`,
        data: {
          kind: 'new_delivery',
          deliveryId: asString(delivery.id),
          url: `pareact://entregas/${encodeURIComponent(asString(delivery.id))}`,
        },
        webLink: `${APP_WEB_URL}/entregas/${encodeURIComponent(asString(delivery.id))}`,
      }),
    );
  }
  return results;
});

async function executeCollectionReminder() {
  const usersSnapshot = await admin.database().ref('usuarios').once('value');
  const users = usersSnapshot.val();
  if (!users || typeof users !== 'object') return 'Nenhum usuário encontrado no banco de dados.';

  let sent = 0;
  for (const [usuarioId, usuario] of Object.entries(users)) {
    if (!usuario || typeof usuario !== 'object') continue;
    const pendingByClient = {};
    for (const delivery of asArray(usuario.entregas)) {
      if (!delivery || delivery.status !== 'Não Pago') continue;
      const client = asString(delivery.cliente) || 'Desconhecido';
      pendingByClient[client] = (pendingByClient[client] ?? 0) + safeNumber(delivery.valor);
    }
    const clients = Object.entries(pendingByClient);
    if (!clients.length) continue;

    const total = clients.reduce((sum, [, value]) => sum + value, 0);
    const details = clients
      .map(([client, value]) => `${client} (R$ ${value.toFixed(2).replace('.', ',')})`)
      .join(', ');
    const result = await sendToUser(usuarioId, {
      title: `Valores a receber: ${clients.length} clientes pendentes`,
      body: `Total a cobrar: R$ ${total.toFixed(2).replace('.', ',')}. Enviar mensagem para: ${details}.`,
      data: {
        kind: 'collection_reminder',
        url: `pareact://entregas?status=${encodeURIComponent('Não Pago')}`,
      },
      webLink: `${APP_WEB_URL}/entregas?status=${encodeURIComponent('Não Pago')}`,
    });
    if (result) sent += 1;
  }
  return `Processo finalizado. ${sent} notificações enviadas.`;
}

function isAuthorizedTestRequest(request, response) {
  const expected = process.env.FUNCTIONS_TEST_SECRET;
  if (!expected || request.get('x-functions-test-secret') !== expected) {
    response.status(401).send('Não autorizado.');
    return false;
  }
  return true;
}

exports.testarPush = onRequest(async (request, response) => {
  if (!isAuthorizedTestRequest(request, response)) return;
  const usuarioId = request.query.usuarioId;
  if (typeof usuarioId !== 'string' || usuarioId.trim() === '') {
    response.status(400).send('Forneça o parâmetro usuarioId.');
    return;
  }
  try {
    const result = await sendToUser(usuarioId, {
      title: 'Teste de notificação',
      body: 'A integração de notificações está funcionando.',
      data: { kind: 'test', url: 'pareact://mais/notificacoes' },
      webLink: `${APP_WEB_URL}/mais/notificacoes`,
    });
    if (!result) {
      response.status(404).send('Nenhum token encontrado.');
      return;
    }
    response.status(200).send('Notificação enviada.');
  } catch (error) {
    console.error('Erro ao enviar notificação de teste:', error);
    response.status(500).send('Não foi possível enviar a notificação.');
  }
});

exports.lembreteCobranca = onSchedule(
  { schedule: '0 15 * * 1-5', timeZone: 'America/Sao_Paulo' },
  async () => executeCollectionReminder(),
);

exports.testarLembreteCobranca = onRequest(async (request, response) => {
  if (!isAuthorizedTestRequest(request, response)) return;
  try {
    response.status(200).send(await executeCollectionReminder());
  } catch (error) {
    console.error('Erro ao executar lembrete de cobrança:', error);
    response.status(500).send('Não foi possível executar o lembrete.');
  }
});
