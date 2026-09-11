import { getFirebaseConfig } from '@/config';
import type { Auth } from 'firebase/auth';

import type { RouteCoordinate, RouteOptimizationMode } from '@/types/route';

interface GeocodePayload {
  address: string;
}

interface GeocodeResponse {
  location: RouteCoordinate;
  formattedAddress?: string;
}

interface ComputeRoutesPayload {
  origin: RouteCoordinate;
  destination: RouteCoordinate;
  intermediates: RouteCoordinate[];
  optimization: RouteOptimizationMode;
  optimizeWaypointOrder: boolean;
  finalRoute: boolean;
}

export interface ComputeRoutesResponse {
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline?: string;
  optimizedIntermediateWaypointIndex?: number[];
}

type RouteOperation = 'geocode' | 'route';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isCoordinate(value: unknown): value is RouteCoordinate {
  return (
    isRecord(value) &&
    typeof value.latitude === 'number' &&
    typeof value.longitude === 'number' &&
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude)
  );
}

function errorMessageFromBody(body: unknown): string | undefined {
  if (!isRecord(body)) return undefined;
  if (typeof body.error === 'string') return body.error;
  if (isRecord(body.error) && typeof body.error.message === 'string') return body.error.message;
  return undefined;
}

function parseGeocodeResponse(body: unknown): GeocodeResponse {
  if (!isRecord(body)) {
    throw new Error('O serviço de geocodificação retornou uma resposta inválida.');
  }
  const location = isCoordinate(body.location)
    ? body.location
    : isCoordinate(body)
      ? { latitude: body.latitude, longitude: body.longitude }
      : undefined;
  if (!location) {
    throw new Error('O serviço de geocodificação retornou coordenadas inválidas.');
  }
  return {
    formattedAddress: typeof body.formattedAddress === 'string' ? body.formattedAddress : undefined,
    location,
  };
}

function defaultFunctionUrl(): string {
  const projectId = getFirebaseConfig().projectId;
  if (!projectId) throw new Error('Projeto Firebase não configurado para o proxy de rotas.');
  return `https://us-central1-${projectId}.cloudfunctions.net/routeProxy`;
}

function getRouteProxyUrl(): string {
  return process.env.EXPO_PUBLIC_ROUTE_FUNCTION_URL?.trim() || defaultFunctionUrl();
}

export class RouteApiClient {
  private async request(
    operation: RouteOperation,
    payload: GeocodePayload | ComputeRoutesPayload,
  ): Promise<unknown> {
    // The Firebase facade is loaded lazily so pure route calculations remain testable.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const firebaseModule = require('../firebase') as {
      getFirebaseAuth: () => Auth;
    };
    const user = firebaseModule.getFirebaseAuth().currentUser;
    if (!user) throw new Error('Sessão não disponível para calcular a rota.');

    const token = await user.getIdToken();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let response: Response;
    try {
      response = await fetch(getRouteProxyUrl(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ operation, payload }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('O serviço de rotas demorou demais para responder.');
      }
      throw new Error(
        'Não foi possível conectar ao serviço de rotas. Verifique a conexão e tente novamente.',
      );
    } finally {
      clearTimeout(timeout);
    }

    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const message =
        errorMessageFromBody(body) ?? 'Não foi possível consultar o serviço de rotas.';
      throw new Error(message);
    }

    return body;
  }

  public geocode(address: string): Promise<GeocodeResponse> {
    return this.request('geocode', { address }).then(parseGeocodeResponse);
  }

  public computeRoutes(payload: ComputeRoutesPayload): Promise<ComputeRoutesResponse> {
    return this.request('route', payload) as Promise<ComputeRoutesResponse>;
  }
}

export const routeApiClient = new RouteApiClient();
