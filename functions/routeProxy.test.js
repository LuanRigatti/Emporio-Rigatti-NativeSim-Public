const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildRouteRequestBody,
  createRouteProxy,
  validateGeocodePayload,
  validateRoutePayload,
  validateRoutesRequestBody,
} = require('./routeProxy');

function responseMock() {
  return {
    body: undefined,
    headers: {},
    statusCode: 200,
    set(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
    send(value) {
      this.body = value;
      return this;
    },
  };
}

function requestMock({
  method = 'POST',
  origin = 'http://localhost:8091',
  body,
  authorization = 'Bearer emulator-token',
} = {}) {
  const headers = {
    authorization,
    origin,
  };
  return {
    body,
    method,
    get(name) {
      return headers[name.toLowerCase()] ?? '';
    },
  };
}

function coordinate(value) {
  return { latitude: -25.4 + value / 1000, longitude: -49.2 - value / 1000 };
}

function routePayload(intermediates = []) {
  return {
    origin: coordinate(0),
    destination: coordinate(1),
    intermediates,
    optimization: 'distance',
    optimizeWaypointOrder: false,
    finalRoute: true,
  };
}

test('validates a non-empty geocode address', () => {
  assert.deepEqual(validateGeocodePayload({ address: ' Rua das Flores ' }), {
    address: 'Rua das Flores',
  });
  assert.throws(() => validateGeocodePayload({ address: '   ' }), /endereço válido/i);
});

test('validates route coordinates and the 25-waypoint limit', () => {
  assert.doesNotThrow(() =>
    validateRoutePayload(routePayload(Array.from({ length: 25 }, (_, index) => coordinate(index)))),
  );
  assert.throws(
    () =>
      validateRoutePayload(
        routePayload(Array.from({ length: 26 }, (_, index) => coordinate(index))),
      ),
    /25 paradas/i,
  );
  assert.throws(
    () => validateRoutePayload({ ...routePayload(), origin: { latitude: 95, longitude: 0 } }),
    /origem.*inválidas/i,
  );
});

test('does not combine waypoint optimization with SHORTER_DISTANCE', () => {
  const optimizedDistance = buildRouteRequestBody({
    ...routePayload(),
    optimizeWaypointOrder: true,
  });
  assert.equal(optimizedDistance.optimizeWaypointOrder, true);
  assert.equal('requestedReferenceRoutes' in optimizedDistance, false);

  const fixedDistance = buildRouteRequestBody({
    ...routePayload(),
    optimizeWaypointOrder: false,
  });
  assert.deepEqual(fixedDistance.requestedReferenceRoutes, ['SHORTER_DISTANCE']);
  assert.throws(
    () => validateRoutesRequestBody({ ...optimizedDistance, requestedReferenceRoutes: ['SHORTER_DISTANCE'] }),
    /reordenacao nao pode usar menor distancia/i,
  );
});

test('preserves the field mask required for optimized waypoint indexes', () => {
  const body = buildRouteRequestBody({
    ...routePayload(),
    optimizeWaypointOrder: true,
  });
  assert.doesNotThrow(() => validateRoutesRequestBody(body));
  assert.throws(
    () => validateRoutesRequestBody(body, 'routes.distanceMeters,routes.duration'),
    /FieldMask.*ordem otimizada/i,
  );
});

test('builds a valid optimized request with eight deliveries', () => {
  const body = buildRouteRequestBody({
    ...routePayload(Array.from({ length: 8 }, (_, index) => coordinate(index))),
    optimizeWaypointOrder: true,
  });
  assert.equal(body.intermediates.length, 8);
  assert.equal(body.optimizeWaypointOrder, true);
  assert.equal('requestedReferenceRoutes' in body, false);
});

test('builds valid distance and time requests without incompatible fields', () => {
  const distanceBody = buildRouteRequestBody({
    ...routePayload(),
    optimization: 'distance',
    optimizeWaypointOrder: false,
    finalRoute: true,
  });
  assert.equal(distanceBody.routingPreference, 'TRAFFIC_UNAWARE');
  assert.deepEqual(distanceBody.requestedReferenceRoutes, ['SHORTER_DISTANCE']);

  const timeBody = buildRouteRequestBody({
    ...routePayload(),
    optimization: 'time',
    optimizeWaypointOrder: true,
    finalRoute: false,
  });
  assert.equal(timeBody.routingPreference, 'TRAFFIC_AWARE');
  assert.equal('requestedReferenceRoutes' in timeBody, false);
});

test('answers OPTIONS without authentication or external calls', async () => {
  let externalCalls = 0;
  const handler = createRouteProxy({
    getApiKey: async () => 'test-key',
    verifyUser: async () => {
      throw new Error('should not authenticate OPTIONS');
    },
    fetchImpl: async () => {
      externalCalls += 1;
      throw new Error('should not call maps');
    },
  });
  const response = responseMock();

  await handler(requestMock({ method: 'OPTIONS' }), response);

  assert.equal(response.statusCode, 204);
  assert.equal(response.headers['Access-Control-Allow-Origin'], 'http://localhost:8091');
  assert.equal(externalCalls, 0);
});

test('rejects non-POST methods with JSON', async () => {
  const handler = createRouteProxy({ getApiKey: async () => 'test-key' });
  const response = responseMock();

  await handler(requestMock({ method: 'GET', body: {} }), response);

  assert.equal(response.statusCode, 405);
  assert.equal(response.body.error.code, 'method_not_allowed');
});

test('returns normalized geocode data', async () => {
  const handler = createRouteProxy({
    getApiKey: async () => 'test-key',
    verifyUser: async () => ({ uid: 'emulator-user' }),
    fetchImpl: async (url) => {
      assert.match(url, /^https:\/\/maps\.googleapis\.com\/maps\/api\/geocode\/json/);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'OK',
          results: [
            {
              formatted_address: 'Rua das Flores, Curitiba - PR, Brasil',
              geometry: { location: { lat: -25.4, lng: -49.2 } },
            },
          ],
        }),
      };
    },
  });
  const response = responseMock();

  await handler(
    requestMock({ body: { operation: 'geocode', payload: { address: 'Rua das Flores' } } }),
    response,
  );

  assert.deepEqual(response.body, {
    latitude: -25.4,
    longitude: -49.2,
    formattedAddress: 'Rua das Flores, Curitiba - PR, Brasil',
  });
});

test('distinguishes an address not found from an external failure', async () => {
  const handler = createRouteProxy({
    getApiKey: async () => 'test-key',
    verifyUser: async () => ({ uid: 'emulator-user' }),
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ZERO_RESULTS', results: [] }),
    }),
  });
  const response = responseMock();

  await handler(
    requestMock({ body: { operation: 'geocode', payload: { address: 'Endereco inexistente' } } }),
    response,
  );

  assert.equal(response.statusCode, 404);
  assert.equal(response.body.error.code, 'address_not_found');
});

test('forwards a validated route request and preserves its response shape', async () => {
  const handler = createRouteProxy({
    getApiKey: async () => 'test-key',
    verifyUser: async () => ({ uid: 'emulator-user' }),
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://routes.googleapis.com/directions/v2:computeRoutes');
      const body = JSON.parse(options.body);
      assert.equal(body.intermediates.length, 1);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          routes: [
            {
              distanceMeters: 1200,
              duration: '600s',
              polyline: { encodedPolyline: 'encoded' },
              optimizedIntermediateWaypointIndex: [0],
            },
          ],
        }),
      };
    },
  });
  const response = responseMock();

  await handler(
    requestMock({
      body: {
        operation: 'route',
        payload: routePayload([coordinate(2)]),
      },
    }),
    response,
  );

  assert.deepEqual(response.body, {
    distanceMeters: 1200,
    durationSeconds: 600,
    encodedPolyline: 'encoded',
    optimizedIntermediateWaypointIndex: [0],
  });
});

test('returns a stable client error for upstream INVALID_ARGUMENT', async () => {
  const handler = createRouteProxy({
    getApiKey: async () => 'test-key',
    verifyUser: async () => ({ uid: 'emulator-user' }),
    fetchImpl: async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          code: 400,
          status: 'INVALID_ARGUMENT',
          message: 'FieldMask contains an incompatible option.',
        },
      }),
    }),
  });
  const response = responseMock();

  await handler(
    requestMock({
      body: {
        operation: 'route',
        payload: routePayload([coordinate(2)]),
      },
    }),
    response,
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.code, 'maps_invalid_request');
  assert.equal(response.body.error.message.includes('FieldMask'), false);
});

test('returns clear timeout errors without logging request data', async () => {
  const originalError = console.error;
  const logs = [];
  console.error = (...args) => logs.push(args);
  try {
    const handler = createRouteProxy({
      getApiKey: async () => 'test-key',
      verifyUser: async () => ({ uid: 'emulator-user' }),
      fetchImpl: async () => {
        const error = new Error('timeout');
        error.name = 'AbortError';
        throw error;
      },
    });
    const response = responseMock();

    await handler(
      requestMock({ body: { operation: 'geocode', payload: { address: 'Rua privada' } } }),
      response,
    );

    assert.equal(response.statusCode, 504);
    assert.equal(response.body.error.code, 'maps_timeout');
    assert.equal(JSON.stringify(logs).includes('Rua privada'), false);
  } finally {
    console.error = originalError;
  }
});
