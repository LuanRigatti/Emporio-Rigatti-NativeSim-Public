import { getFirebaseConfig } from '@/config';
import type { Auth } from 'firebase/auth';

import type { RouteCoordinate, RouteOptimizationMode } from '@/types/route';

interface GeocodePayload {
  address: string;
}

interface GeocodeResponse {
  location: RouteCoordinate;
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

type RouteProxyResponse = GeocodeResponse | ComputeRoutesResponse;

function defaultFunctionUrl(): string {
  const projectId = getFirebaseConfig().projectId;
  if (!projectId) throw new Error('Projeto Firebase não configurado para o proxy de rotas.');
  return `https://us-central1-${projectId}.cloudfunctions.net/routeProxy`;
}

function getRouteProxyUrl(): string {
  return process.env.EXPO_PUBLIC_ROUTE_FUNCTION_URL?.trim() || defaultFunctionUrl();
}

export class RouteApiClient {
  private async request<T extends RouteProxyResponse>(
    operation: 'geocode' | 'computeRoutes',
    payload: GeocodePayload | ComputeRoutesPayload,
  ): Promise<T> {
    // The Firebase facade is loaded lazily so pure route calculations remain testable.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const firebaseModule = require('../firebase') as {
      getFirebaseAuth: () => Auth;
    };
    const user = firebaseModule.getFirebaseAuth().currentUser;
    if (!user) throw new Error('Sessão não disponível para calcular a rota.');

    const token = await user.getIdToken();
    const response = await fetch(getRouteProxyUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ operation, payload }),
    });

    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const message =
        typeof body === 'object' &&
        body !== null &&
        'error' in body &&
        typeof body.error === 'string'
          ? body.error
          : 'Não foi possível consultar o serviço de rotas.';
      throw new Error(message);
    }

    return body as T;
  }

  public geocode(address: string): Promise<GeocodeResponse> {
    return this.request<GeocodeResponse>('geocode', { address });
  }

  public computeRoutes(payload: ComputeRoutesPayload): Promise<ComputeRoutesResponse> {
    return this.request<ComputeRoutesResponse>('computeRoutes', payload);
  }
}

export const routeApiClient = new RouteApiClient();
