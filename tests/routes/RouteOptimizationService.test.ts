import { routeApiClient } from '@/services/routes/RouteApiClient';
import { RouteOptimizationService } from '@/services/routes/RouteOptimizationService';
import { createRoutePlanFromPreset } from '@/services/routes/routePlans';
import {
  ROUTE_BASE_ADDRESS,
  ROUTE_FLAMBOYANT_ADDRESS,
  ROUTE_PLAV_ADDRESS,
  type RouteCoordinate,
} from '@/types/route';
import type { Delivery } from '@/types/data';

const coordinate = (value: number): RouteCoordinate => ({
  latitude: -25.4 + value / 1000,
  longitude: -49.2 - value / 1000,
});

function delivery(id: string, client: string, address?: string): Delivery {
  return {
    id,
    cliente: client,
    quantidade: 1,
    valor: 50,
    status: 'Não Pago',
    entregue: false,
    data: '2026-07-25',
    endereco: address,
  };
}

describe('RouteOptimizationService', () => {
  const geocode = jest.spyOn(routeApiClient, 'geocode');
  const computeRoutes = jest.spyOn(routeApiClient, 'computeRoutes');
  const service = new RouteOptimizationService();

  beforeEach(() => {
    geocode.mockClear();
    computeRoutes.mockClear();
    geocode.mockImplementation(async (address) => ({
      location: coordinate(address.length),
    }));
    computeRoutes.mockImplementation(async ({ intermediates }) => ({
      distanceMeters: 1000 + intermediates.length * 100,
      durationSeconds: 600,
      encodedPolyline: undefined,
      optimizedIntermediateWaypointIndex: intermediates.map((_, index) => index).reverse(),
    }));
  });

  afterAll(() => {
    geocode.mockRestore();
    computeRoutes.mockRestore();
  });

  it('preserves the approved route presets and fixed destination', () => {
    const first = createRoutePlanFromPreset('2026-07-25', 'flamboyant-plav', 'distance');
    const second = createRoutePlanFromPreset('2026-07-25', 'plav-flamboyant', 'distance');

    expect(first.origin.address).toBe(ROUTE_FLAMBOYANT_ADDRESS);
    expect(first.mandatoryBeforeDeliveries).toEqual([]);
    expect(first.destination.address).toBe(ROUTE_BASE_ADDRESS);
    expect(second.origin.address).toBe(ROUTE_PLAV_ADDRESS);
    expect(second.mandatoryAfterDeliveries[0]?.address).toBe(ROUTE_FLAMBOYANT_ADDRESS);
  });

  it('blocks optimization when an address cannot be geocoded and never invents coordinates', async () => {
    geocode.mockImplementation(async (address) => {
      if (address.includes('Sem localização')) throw new Error('Endereço não localizado.');
      return { location: coordinate(address.length) };
    });
    const plan = createRoutePlanFromPreset('2026-07-25', 'flamboyant-plav', 'distance');
    const session = await service.createSession(
      plan,
      [delivery('delivery-1', 'Cliente sem localização', 'Sem localização')],
      {},
    );

    expect(session.unresolvedAddresses).toHaveLength(1);
    expect(session.stops.length).toBeGreaterThan(0);
    expect(session.stops.some((stop) => stop.deliveryId === 'delivery-1')).toBe(false);
    expect(computeRoutes).not.toHaveBeenCalled();
    expect(session.unresolvedAddresses[0]?.coordinates).toBeUndefined();
  });

  it('creates a route session without delivery stops when the selected day is empty', async () => {
    const plan = createRoutePlanFromPreset('2026-07-25', 'flamboyant-plav', 'distance');
    const session = await service.createSession(plan, [], {});

    expect(session.deliveries).toEqual([]);
    expect(session.stops.filter((stop) => stop.kind === 'delivery')).toEqual([]);
    expect(session.unresolvedAddresses).toEqual([]);
  });

  it('creates a route session with one delivery and a calculated summary', async () => {
    const plan = createRoutePlanFromPreset('2026-07-25', 'flamboyant-plav', 'distance');
    const session = await service.createSession(
      plan,
      [delivery('delivery-1', 'Cliente 1', 'Rua 1, Curitiba - PR')],
      {},
    );

    expect(session.stops.filter((stop) => stop.kind === 'delivery')).toHaveLength(1);
    expect(session.summary.distanceKm).toBeGreaterThan(0);
    expect(session.summary.durationMinutes).toBeGreaterThan(0);
  });

  it('accepts a manually confirmed coordinate only for the current session', async () => {
    geocode.mockImplementation(async (address) => {
      if (address.includes('Sem localização')) throw new Error('Endereço não localizado.');
      return { location: coordinate(address.length) };
    });
    const plan = createRoutePlanFromPreset('2026-07-25', 'flamboyant-plav', 'distance');
    const session = await service.createSession(
      plan,
      [delivery('delivery-1', 'Cliente sem localização', 'Sem localização')],
      {},
      { 'delivery-1': { latitude: -25.42, longitude: -49.27 } },
    );

    expect(session.unresolvedAddresses).toHaveLength(0);
    expect(
      session.stops.find((stop) => stop.deliveryId === 'delivery-1')?.addressResolution.status,
    ).toBe('manualConfirmed');
  });

  it('splits route requests internally when there are more than 25 deliveries', async () => {
    const plan = createRoutePlanFromPreset('2026-07-25', 'plav-flamboyant', 'distance');
    const deliveries = Array.from({ length: 26 }, (_, index) =>
      delivery(`delivery-${index}`, `Cliente ${index}`, `Rua ${index}, Curitiba - PR`),
    );
    const session = await service.createSession(plan, deliveries, {});

    expect(session.stops.filter((stop) => stop.kind === 'delivery')).toHaveLength(26);
    expect(computeRoutes.mock.calls.some(([payload]) => payload.intermediates.length === 25)).toBe(
      true,
    );
    expect(computeRoutes.mock.calls.every(([payload]) => payload.intermediates.length <= 25)).toBe(
      true,
    );
  });

  it('keeps the legacy Viana behavior by placing only the last Viana delivery in the special position', async () => {
    const plan = createRoutePlanFromPreset('2026-07-25', 'flamboyant-plav', 'distance');
    const deliveries = [
      delivery('viana-1', 'Viana'),
      delivery('other', 'Aldo'),
      delivery('viana-2', 'Vianna'),
    ];
    const session = await service.createSession(plan, deliveries, {});
    const routeDeliveryIds = session.stops
      .filter((stop) => stop.kind === 'delivery')
      .map((stop) => stop.deliveryId);

    expect(routeDeliveryIds).toContain('viana-2');
    expect(routeDeliveryIds).not.toContain('viana-1');
    expect(routeDeliveryIds.at(-1)).toBe('viana-2');
  });
});
