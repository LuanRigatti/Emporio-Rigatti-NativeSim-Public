import { normalizeClientAlias, normalizeClientKey } from '@/utils/data';
import type { Delivery } from '@/types/data';
import type {
  RouteAddressResolution,
  RouteClientAddresses,
  RouteCoordinate,
  RouteLocationDraft,
  RoutePlanDraft,
  RouteSegmentSummary,
  RouteSession,
  RouteStop,
} from '@/types/route';

import { routeApiClient, type ComputeRoutesResponse } from './RouteApiClient';
import { getKnownClientAddress } from './knownAddresses';
import { routeSessionStore } from './RouteSessionStore';

const MAX_INTERMEDIATES_PER_REQUEST = 25;

function createSessionId(): string {
  return `route-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptySummary(): RouteSession['summary'] {
  return { distanceKm: 0, durationMinutes: 0, segments: [] };
}

function parseDuration(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function decodePolyline(encoded?: string): RouteCoordinate[] {
  if (!encoded) return [];
  const points: RouteCoordinate[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    latitude += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    longitude += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ latitude: latitude / 1e5, longitude: longitude / 1e5 });
  }

  return points;
}

function appendCuritiba(address: string): string {
  const value = address.trim();
  return /curitiba/i.test(value) ? value : `${value}, Curitiba - PR, Brasil`;
}

function findCustomAddress(
  clientName: string,
  customClients: RouteClientAddresses,
): string | undefined {
  const normalized = normalizeClientKey(clientName);
  const record = Object.entries(customClients).find(
    ([key, client]) =>
      normalizeClientKey(key) === normalized || normalizeClientKey(client.nome) === normalized,
  )?.[1];
  return record?.endereco?.trim() || undefined;
}

function deliveryAddress(
  delivery: Delivery,
  customClients: RouteClientAddresses,
): Pick<RouteAddressResolution, 'address' | 'source'> {
  if (delivery.endereco?.trim()) return { address: delivery.endereco.trim(), source: 'delivery' };

  const customAddress = findCustomAddress(delivery.cliente, customClients);
  if (customAddress) return { address: customAddress, source: 'customClient' };

  const knownAddress = getKnownClientAddress(delivery.cliente);
  if (knownAddress) return { address: knownAddress, source: 'knownClient' };

  return { address: delivery.cliente.trim(), source: 'geocoding' };
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function reorderByIndexes<T>(items: readonly T[], indexes?: readonly number[]): T[] {
  if (!indexes || indexes.length !== items.length) return [...items];
  return indexes.map((index) => items[index]).filter((item): item is T => item !== undefined);
}

function coordinatesOf(stop: RouteStop): RouteCoordinate {
  return stop.coordinates;
}

function locationResolution(
  location: RouteLocationDraft,
  coordinates: RouteCoordinate | undefined,
  source: RouteAddressResolution['source'],
  error?: string,
): RouteAddressResolution {
  return {
    address: location.address,
    status: coordinates ? 'resolved' : 'invalid',
    coordinates,
    source,
    error,
  };
}

export class RouteOptimizationService {
  public async createSession(
    plan: RoutePlanDraft,
    deliveries: readonly Delivery[],
    customClients: RouteClientAddresses,
    manualCoordinates: Readonly<Record<string, RouteCoordinate>> = {},
    addressOverrides: Readonly<Record<string, string>> = {},
  ): Promise<RouteSession> {
    const sessionId = createSessionId();
    const locations = [
      plan.origin,
      ...plan.mandatoryBeforeDeliveries,
      ...plan.mandatoryAfterDeliveries,
      plan.destination,
    ];

    const locationResults = await Promise.all(
      locations.map((location) =>
        this.resolveLocation(location, manualCoordinates, addressOverrides),
      ),
    );
    const deliveryResults = await Promise.all(
      deliveries.map((delivery) =>
        this.resolveDelivery(delivery, customClients, manualCoordinates, addressOverrides),
      ),
    );

    const unresolvedAddresses = [...locationResults, ...deliveryResults]
      .filter((item) => item.resolution.status === 'invalid')
      .map((item) => item.resolution);

    const baseSession: RouteSession = {
      id: sessionId,
      plan,
      deliveries: [...deliveries],
      customClients,
      manualCoordinates,
      addressOverrides,
      stops: [],
      unresolvedAddresses,
      summary: emptySummary(),
      currentStopIndex: 0,
      status: 'ready',
    };

    const fixedLocations = new Map(locationResults.map((item) => [item.location.id, item]));
    const deliveryLocations = new Map(deliveryResults.map((item) => [item.delivery.id, item]));
    const confirmedStops = [
      ...locationResults
        .filter((item) => item.resolution.coordinates)
        .map((item) => this.toStop(item.location, item.resolution, true, 0)),
      ...deliveryResults
        .filter((item) => item.resolution.coordinates)
        .map((item) =>
          this.toStop(
            {
              id: `delivery-${item.delivery.id}`,
              label: item.delivery.cliente,
              address: item.resolution.address,
              kind: 'delivery',
            },
            item.resolution,
            false,
            0,
            item.delivery,
          ),
        ),
    ].map((stop, index) => ({ ...stop, sequence: index + 1 }));
    baseSession.stops = confirmedStops;

    if (unresolvedAddresses.length > 0) {
      routeSessionStore.save(baseSession);
      return baseSession;
    }

    const prefix = [plan.origin, ...plan.mandatoryBeforeDeliveries].map((location) =>
      this.toStop(location, fixedLocations.get(location.id)?.resolution, true, 0),
    );
    const suffix = [...plan.mandatoryAfterDeliveries, plan.destination].map((location) =>
      this.toStop(location, fixedLocations.get(location.id)?.resolution, true, 0),
    );
    const deliveriesWithCoordinates = [...deliveries].map((delivery) =>
      this.toStop(
        {
          id: `delivery-${delivery.id}`,
          label: delivery.cliente,
          address: deliveryLocations.get(delivery.id)?.resolution.address ?? delivery.cliente,
          kind: 'delivery',
        },
        deliveryLocations.get(delivery.id)?.resolution,
        false,
        0,
        delivery,
      ),
    );

    const orderedDeliveries = await this.orderDeliveries(
      prefix[prefix.length - 1],
      suffix[0],
      deliveriesWithCoordinates,
      plan.optimization,
    );
    const orderedStops = [...prefix, ...orderedDeliveries, ...suffix].map((stop, index) => ({
      ...stop,
      sequence: index + 1,
    }));
    const segments = await this.buildTravelSegments(orderedStops, plan.optimization);
    const summary = {
      distanceKm: Number(
        (segments.reduce((total, segment) => total + segment.distanceMeters, 0) / 1000).toFixed(1),
      ),
      durationMinutes: Math.round(
        segments.reduce((total, segment) => total + segment.durationSeconds, 0) / 60,
      ),
      segments,
    };

    const session: RouteSession = {
      ...baseSession,
      stops: orderedStops,
      summary,
    };
    routeSessionStore.save(session);
    return session;
  }

  public async recreateSession(
    session: RouteSession,
    manualCoordinates: Readonly<Record<string, RouteCoordinate>>,
    addressOverrides: Readonly<Record<string, string>>,
  ): Promise<RouteSession> {
    return this.createSession(
      session.plan,
      session.deliveries,
      session.customClients,
      { ...session.manualCoordinates, ...manualCoordinates },
      { ...session.addressOverrides, ...addressOverrides },
    );
  }

  private async resolveLocation(
    location: RouteLocationDraft,
    manualCoordinates: Readonly<Record<string, RouteCoordinate>>,
    addressOverrides: Readonly<Record<string, string>>,
  ): Promise<{ location: RouteLocationDraft; resolution: RouteAddressResolution }> {
    const address = addressOverrides[location.id]?.trim() || location.address.trim();
    const manual = manualCoordinates[location.id];
    if (manual) {
      return {
        location: { ...location, address },
        resolution: locationResolution({ ...location, address }, manual, 'manual'),
      };
    }
    if (!address) {
      return {
        location: { ...location, address },
        resolution: locationResolution(
          { ...location, address },
          undefined,
          'geocoding',
          'Informe um endereço.',
        ),
      };
    }
    try {
      const result = await routeApiClient.geocode(appendCuritiba(address));
      return {
        location: { ...location, address },
        resolution: locationResolution({ ...location, address }, result.location, 'geocoding'),
      };
    } catch (error) {
      return {
        location: { ...location, address },
        resolution: locationResolution(
          { ...location, address },
          undefined,
          'geocoding',
          error instanceof Error ? error.message : 'Endereço não localizado.',
        ),
      };
    }
  }

  private async resolveDelivery(
    delivery: Delivery,
    customClients: RouteClientAddresses,
    manualCoordinates: Readonly<Record<string, RouteCoordinate>>,
    addressOverrides: Readonly<Record<string, string>>,
  ): Promise<{ delivery: Delivery; resolution: RouteAddressResolution }> {
    const candidate = deliveryAddress(delivery, customClients);
    const address = addressOverrides[delivery.id]?.trim() || candidate.address;
    const manual = manualCoordinates[delivery.id];
    if (manual) {
      return {
        delivery,
        resolution: {
          address,
          status: 'manualConfirmed',
          coordinates: manual,
          source: 'manual',
          deliveryId: delivery.id,
          clientName: delivery.cliente,
        },
      };
    }
    if (!address) {
      return {
        delivery,
        resolution: {
          address,
          status: 'invalid',
          source: candidate.source,
          error: 'O endereço do cliente está vazio.',
          deliveryId: delivery.id,
          clientName: delivery.cliente,
        },
      };
    }
    try {
      const result = await routeApiClient.geocode(appendCuritiba(address));
      return {
        delivery,
        resolution: {
          address,
          status: 'resolved',
          coordinates: result.location,
          source: candidate.source,
          deliveryId: delivery.id,
          clientName: delivery.cliente,
        },
      };
    } catch (error) {
      return {
        delivery,
        resolution: {
          address,
          status: 'invalid',
          source: candidate.source,
          error: error instanceof Error ? error.message : 'Endereço não localizado.',
          deliveryId: delivery.id,
          clientName: delivery.cliente,
        },
      };
    }
  }

  private toStop(
    location: RouteLocationDraft,
    resolution: RouteAddressResolution | undefined,
    mandatory: boolean,
    sequence: number,
    delivery?: Delivery,
  ): RouteStop {
    if (!resolution?.coordinates)
      throw new Error('Não é possível criar parada sem coordenadas confirmadas.');
    return {
      id: location.id,
      kind: location.kind,
      label: location.label,
      address: resolution.address,
      deliveryId: delivery?.id,
      clientName: delivery?.cliente,
      mandatory,
      coordinates: resolution.coordinates,
      addressResolution: resolution,
      sequence,
      delivered: delivery?.entregue,
    };
  }

  private async orderDeliveries(
    start: RouteStop,
    nextFixedStop: RouteStop | undefined,
    deliveries: RouteStop[],
    optimization: RoutePlanDraft['optimization'],
  ): Promise<RouteStop[]> {
    if (deliveries.length === 0) return [];

    const vianaMatches = deliveries.filter(
      (stop) => normalizeClientKey(normalizeClientAlias(stop.clientName ?? '')) === 'viana',
    );
    const viana = vianaMatches.at(-1);
    const vianaIds = new Set(vianaMatches.map((stop) => stop.id));
    const reorderable = viana ? deliveries.filter((stop) => !vianaIds.has(stop.id)) : deliveries;
    const target = viana ?? nextFixedStop ?? start;
    const ordered: RouteStop[] = [];
    let currentStart = start;

    for (const batch of chunk(reorderable, MAX_INTERMEDIATES_PER_REQUEST)) {
      const response = await routeApiClient.computeRoutes({
        origin: coordinatesOf(currentStart),
        destination: coordinatesOf(target),
        intermediates: batch.map(coordinatesOf),
        optimization,
        optimizeWaypointOrder: true,
        finalRoute: false,
      });
      const batchOrdered = reorderByIndexes(batch, response.optimizedIntermediateWaypointIndex);
      ordered.push(...batchOrdered);
      currentStart = batchOrdered.at(-1) ?? currentStart;
    }

    if (viana) ordered.push(viana);
    return ordered;
  }

  private async buildTravelSegments(
    stops: readonly RouteStop[],
    optimization: RoutePlanDraft['optimization'],
  ): Promise<RouteSegmentSummary[]> {
    if (stops.length < 2) return [];
    const segments: RouteSegmentSummary[] = [];
    let startIndex = 0;

    while (startIndex < stops.length - 1) {
      const endIndex = Math.min(startIndex + MAX_INTERMEDIATES_PER_REQUEST + 1, stops.length - 1);
      const response: ComputeRoutesResponse = await routeApiClient.computeRoutes({
        origin: coordinatesOf(stops[startIndex]),
        destination: coordinatesOf(stops[endIndex]),
        intermediates: stops.slice(startIndex + 1, endIndex).map(coordinatesOf),
        optimization,
        optimizeWaypointOrder: false,
        finalRoute: true,
      });
      segments.push({
        distanceMeters: Math.max(0, response.distanceMeters),
        durationSeconds: parseDuration(response.durationSeconds),
        encodedPolyline: response.encodedPolyline,
        decodedPolyline: decodePolyline(response.encodedPolyline),
      });
      startIndex = endIndex;
    }

    return segments;
  }
}

export const routeOptimizationService = new RouteOptimizationService();
