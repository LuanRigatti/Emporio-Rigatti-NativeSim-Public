const admin = require('firebase-admin');

const ROUTE_TIMEOUT_MS = 25_000;
const MAX_INTERMEDIATES = 25;
const ROUTES_FIELD_MASK =
  'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.optimizedIntermediateWaypointIndex';
const PRODUCTION_ORIGINS = new Set([
  'https://venda-e-faturamento.web.app',
  'https://venda-e-faturamento.firebaseapp.com',
]);

class RouteProxyError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.name = 'RouteProxyError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isCoordinate(value) {
  return (
    isRecord(value) &&
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude) &&
    value.latitude >= -90 &&
    value.latitude <= 90 &&
    value.longitude >= -180 &&
    value.longitude <= 180
  );
}

function validateGeocodePayload(payload) {
  if (!isRecord(payload) || typeof payload.address !== 'string' || !payload.address.trim()) {
    throw new RouteProxyError(400, 'invalid_address', 'Informe um endereço válido.');
  }
  return { address: payload.address.trim() };
}

function validateRoutePayload(payload) {
  if (!isRecord(payload)) {
    throw new RouteProxyError(400, 'invalid_route_payload', 'Informe os dados da rota.');
  }
  if (!isCoordinate(payload.origin)) {
    throw new RouteProxyError(400, 'invalid_origin', 'A origem possui coordenadas inválidas.');
  }
  if (!isCoordinate(payload.destination)) {
    throw new RouteProxyError(
      400,
      'invalid_destination',
      'O destino possui coordenadas inválidas.',
    );
  }
  if (!Array.isArray(payload.intermediates)) {
    throw new RouteProxyError(400, 'invalid_waypoints', 'As paradas intermediárias são inválidas.');
  }
  if (payload.intermediates.length > MAX_INTERMEDIATES) {
    throw new RouteProxyError(
      400,
      'too_many_waypoints',
      `A rota aceita no máximo ${MAX_INTERMEDIATES} paradas intermediárias por trecho.`,
    );
  }
  if (payload.intermediates.some((item) => !isCoordinate(item))) {
    throw new RouteProxyError(
      400,
      'invalid_waypoint',
      'Uma ou mais paradas intermediárias possuem coordenadas inválidas.',
    );
  }
  if (payload.optimization !== 'distance' && payload.optimization !== 'time') {
    throw new RouteProxyError(400, 'invalid_optimization', 'O modo de otimização é inválido.');
  }
  if (typeof payload.optimizeWaypointOrder !== 'boolean') {
    throw new RouteProxyError(400, 'invalid_waypoint_order', 'A ordenação das paradas é inválida.');
  }
  if (typeof payload.finalRoute !== 'boolean') {
    throw new RouteProxyError(
      400,
      'invalid_final_route',
      'A indicação do trecho final é inválida.',
    );
  }
  return payload;
}

function routePoint(coordinate) {
  return { location: { latLng: coordinate } };
}

function sanitizeUpstreamMessage(value) {
  const sanitized = String(value ?? '')
    .replace(/AIza[\w-]+/gi, '[redacted]')
    .replace(/https?:\/\/\S+/gi, '[url redacted]')
    .replace(/(?:rua|r\.|avenida|av\.|travessa|tv\.)[^,.;\n]{0,160}/gi, '[address redacted]')
    .replace(/\s+/g, ' ')
    .trim();
  return sanitized.slice(0, 240) || 'Resposta upstream sem mensagem.';
}

function upstreamErrorDetails(endpoint, response, body, operation) {
  const error = isRecord(body?.error) ? body.error : {};
  const upstreamStatusText =
    typeof error.status === 'string'
      ? error.status
      : typeof body?.status === 'string'
        ? body.status
        : 'UPSTREAM_ERROR';
  return {
    endpoint,
    operation,
    upstreamStatus: response.status,
    upstreamCode: typeof error.code === 'number' ? error.code : undefined,
    upstreamStatusText,
    upstreamMessage: sanitizeUpstreamMessage(error.message ?? body?.error_message),
  };
}

function mapsUpstreamError(endpoint, response, body, operation) {
  const details = upstreamErrorDetails(endpoint, response, body, operation);
  const statusText = details.upstreamStatusText;
  if (response.status === 400 || statusText === 'INVALID_ARGUMENT' || statusText === 'INVALID_REQUEST') {
    return new RouteProxyError(400, 'maps_invalid_request', 'A solicitacao de mapas e invalida.', details);
  }
  if (response.status === 403 || statusText === 'PERMISSION_DENIED' || statusText === 'REQUEST_DENIED') {
    return new RouteProxyError(403, 'maps_permission_denied', 'O servico de mapas recusou a solicitacao.', details);
  }
  if (response.status === 429 || statusText === 'RESOURCE_EXHAUSTED' || statusText === 'OVER_QUERY_LIMIT') {
    return new RouteProxyError(429, 'maps_rate_limited', 'O servico de mapas atingiu o limite de consultas.', details);
  }
  if (response.status >= 500 && response.status <= 599) {
    return new RouteProxyError(503, 'maps_unavailable', 'O servico de mapas esta temporariamente indisponivel.', details);
  }
  return new RouteProxyError(502, 'maps_request_failed', 'O servico de mapas nao respondeu corretamente.', details);
}

function validateRoutesRequestBody(body, fieldMask = ROUTES_FIELD_MASK) {
  if (!isRecord(body)) {
    throw new RouteProxyError(400, 'invalid_routes_request', 'A solicitacao de rota e invalida.');
  }
  if (!isRecord(body.origin) || !isRecord(body.destination)) {
    throw new RouteProxyError(400, 'invalid_routes_endpoints', 'Origem e destino sao obrigatorios.');
  }
  if (!Array.isArray(body.intermediates) || body.intermediates.length > MAX_INTERMEDIATES) {
    throw new RouteProxyError(400, 'invalid_routes_waypoints', 'A quantidade de paradas e invalida.');
  }
  if (body.travelMode !== 'DRIVE') {
    throw new RouteProxyError(400, 'invalid_routes_travel_mode', 'O modo de transporte e invalido.');
  }
  if (!['TRAFFIC_UNAWARE', 'TRAFFIC_AWARE', 'TRAFFIC_AWARE_OPTIMAL'].includes(body.routingPreference)) {
    throw new RouteProxyError(400, 'invalid_routes_preference', 'A preferencia de rota e invalida.');
  }
  if (typeof body.optimizeWaypointOrder !== 'boolean') {
    throw new RouteProxyError(400, 'invalid_routes_waypoint_order', 'A ordenacao das paradas e invalida.');
  }
  const references = body.requestedReferenceRoutes;
  if (references !== undefined && (!Array.isArray(references) || references.some((item) => item !== 'SHORTER_DISTANCE'))) {
    throw new RouteProxyError(400, 'invalid_routes_reference', 'A rota de referencia e invalida.');
  }
  if (body.optimizeWaypointOrder && references?.length) {
    throw new RouteProxyError(400, 'incompatible_routes_options', 'A reordenacao nao pode usar menor distancia.');
  }
  if (body.optimizeWaypointOrder && body.routingPreference === 'TRAFFIC_AWARE_OPTIMAL') {
    throw new RouteProxyError(400, 'incompatible_routes_preference', 'A reordenacao nao pode usar esta preferencia.');
  }
  if (!fieldMask.includes('routes.distanceMeters') || !fieldMask.includes('routes.duration')) {
    throw new RouteProxyError(400, 'invalid_routes_field_mask', 'O FieldMask da rota e invalido.');
  }
  if (body.optimizeWaypointOrder && !fieldMask.includes('routes.optimizedIntermediateWaypointIndex')) {
    throw new RouteProxyError(400, 'missing_routes_field_mask', 'O FieldMask da ordem otimizada e obrigatorio.');
  }
  return body;
}

function buildRouteRequestBody(payload) {
  const validPayload = validateRoutePayload(payload);
  const requestBody = {
    origin: routePoint(validPayload.origin),
    destination: routePoint(validPayload.destination),
    intermediates: validPayload.intermediates.map(routePoint),
    travelMode: 'DRIVE',
    routingPreference:
      validPayload.optimization === 'time'
        ? validPayload.finalRoute
          ? 'TRAFFIC_AWARE_OPTIMAL'
          : 'TRAFFIC_AWARE'
        : 'TRAFFIC_UNAWARE',
    computeAlternativeRoutes: false,
    optimizeWaypointOrder: validPayload.optimizeWaypointOrder,
    ...(validPayload.optimization === 'distance' && !validPayload.optimizeWaypointOrder
      ? { requestedReferenceRoutes: ['SHORTER_DISTANCE'] }
      : {}),
  };
  return validateRoutesRequestBody(requestBody);
}

function routeApiStatus(status) {
  if (status === 429)
    return new RouteProxyError(
      429,
      'maps_rate_limited',
      'O serviço de mapas atingiu o limite de consultas.',
    );
  return new RouteProxyError(
    502,
    'maps_request_failed',
    'O serviço de mapas não respondeu corretamente.',
  );
}

async function requestJson(fetchImpl, url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ROUTE_TIMEOUT_MS);
  let response;
  try {
    response = await fetchImpl(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new RouteProxyError(
        504,
        'maps_timeout',
        'O serviço de mapas demorou demais para responder.',
      );
    }
    throw new RouteProxyError(
      502,
      'maps_unreachable',
      'Não foi possível acessar o serviço de mapas.',
    );
  } finally {
    clearTimeout(timeout);
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new RouteProxyError(
      502,
      'maps_invalid_response',
      'O serviço de mapas retornou uma resposta inválida.',
    );
  }
  return { response, body };
}

async function proxyGeocode(payload, apiKey, fetchImpl) {
  const { address } = validateGeocodePayload(payload);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    address,
  )}&language=pt-BR&region=br&key=${encodeURIComponent(apiKey)}`;
  const { response, body } = await requestJson(fetchImpl, url, { method: 'GET' });
  const location = body?.results?.[0]?.geometry?.location;
  if (body?.status === 'ZERO_RESULTS') {
    throw new RouteProxyError(404, 'address_not_found', 'Endereço não encontrado.');
  }
  if (!response.ok || body?.status !== 'OK' || !location) {
    throw mapsUpstreamError(
      'https://maps.googleapis.com/maps/api/geocode/json',
      response,
      body,
      'geocode',
    );
  }
  return {
    latitude: Number(location.lat),
    longitude: Number(location.lng),
    formattedAddress: String(body.results[0].formatted_address ?? address),
  };
}

async function proxyRoute(payload, apiKey, fetchImpl) {
  const requestBody = buildRouteRequestBody(payload);
  const { response, body } = await requestJson(
    fetchImpl,
    'https://routes.googleapis.com/directions/v2:computeRoutes',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': ROUTES_FIELD_MASK,
      },
      body: JSON.stringify(requestBody),
    },
  );
  const route = body?.routes?.[0];
  if (!response.ok || !route) {
    throw mapsUpstreamError(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      response,
      body,
      'route',
    );
  }
  const durationMatch =
    typeof route.duration === 'string' ? route.duration.match(/([0-9.]+)s/) : null;
  return {
    distanceMeters: Number(route.distanceMeters) || 0,
    durationSeconds: durationMatch ? Number(durationMatch[1]) : 0,
    encodedPolyline: route.polyline?.encodedPolyline,
    optimizedIntermediateWaypointIndex: Array.isArray(route.optimizedIntermediateWaypointIndex)
      ? route.optimizedIntermediateWaypointIndex
      : undefined,
  };
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  if (PRODUCTION_ORIGINS.has(origin)) return true;
  const configuredOrigins = String(process.env.ROUTE_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return configuredOrigins.includes(origin);
}

function setCors(request, response) {
  const origin = request.get('origin') || '';
  response.set('Vary', 'Origin');
  response.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  response.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (isAllowedOrigin(origin) && origin) {
    response.set('Access-Control-Allow-Origin', origin);
  }
  return origin;
}

function jsonError(response, error) {
  const safeError =
    error instanceof RouteProxyError
      ? error
      : new RouteProxyError(500, 'internal_error', 'Não foi possível processar a solicitação.');
  response.status(safeError.status).json({
    error: {
      code: safeError.code,
      message: safeError.message,
    },
  });
}

async function verifyRouteUser(request) {
  const header = request.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new RouteProxyError(401, 'unauthorized', 'Autenticação obrigatória.');
  try {
    return await admin.auth().verifyIdToken(token);
  } catch {
    throw new RouteProxyError(401, 'unauthorized', 'Autenticação inválida.');
  }
}

function createRouteProxy({ getApiKey, verifyUser = verifyRouteUser, fetchImpl = fetch }) {
  return async (request, response) => {
    const origin = setCors(request, response);
    if (origin && !isAllowedOrigin(origin)) {
      jsonError(response, new RouteProxyError(403, 'origin_not_allowed', 'Origem não autorizada.'));
      return;
    }
    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }
    if (request.method !== 'POST') {
      jsonError(response, new RouteProxyError(405, 'method_not_allowed', 'Método não permitido.'));
      return;
    }

    let operation = 'unknown';
    try {
      await verifyUser(request);
      if (!isRecord(request.body)) {
        throw new RouteProxyError(400, 'invalid_body', 'O corpo da solicitação é inválido.');
      }
      operation = request.body.operation;
      const payload = request.body.payload;
      if (operation !== 'geocode' && operation !== 'route') {
        throw new RouteProxyError(400, 'invalid_operation', 'Operação de rota inválida.');
      }
      let apiKey;
      try {
        apiKey = await getApiKey();
      } catch {
        throw new RouteProxyError(
          503,
          'maps_not_configured',
          'O serviço de mapas não está configurado.',
        );
      }
      if (typeof apiKey !== 'string' || !apiKey.trim()) {
        throw new RouteProxyError(
          503,
          'maps_not_configured',
          'O serviço de mapas não está configurado.',
        );
      }
      if (operation === 'geocode') {
        response.status(200).json(await proxyGeocode(payload, apiKey, fetchImpl));
        return;
      }
      if (operation === 'route') {
        response.status(200).json(await proxyRoute(payload, apiKey, fetchImpl));
        return;
      }
    } catch (error) {
      const safeError =
        error instanceof RouteProxyError
          ? error
          : new RouteProxyError(500, 'internal_error', 'Não foi possível processar a solicitação.');
      console.error('routeProxy request failed', {
        code: safeError.code,
        operation,
        status: safeError.status,
        upstreamStatus: safeError.details?.upstreamStatus,
        upstreamCode: safeError.details?.upstreamCode,
        upstreamStatusText: safeError.details?.upstreamStatusText,
        upstreamMessage: safeError.details?.upstreamMessage,
        endpoint: safeError.details?.endpoint,
      });
      jsonError(response, safeError);
    }
  };
}

module.exports = {
  RouteProxyError,
  createRouteProxy,
  isCoordinate,
  validateGeocodePayload,
  validateRoutePayload,
  validateRoutesRequestBody,
  buildRouteRequestBody,
};
