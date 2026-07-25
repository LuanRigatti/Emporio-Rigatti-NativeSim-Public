import {
  ROUTE_BASE_ADDRESS,
  ROUTE_FLAMBOYANT_ADDRESS,
  ROUTE_PLAV_ADDRESS,
  type RouteLocationDraft,
  type RoutePlanDraft,
  type RoutePreset,
  type RouteOptimizationMode,
} from '@/types/route';

export function createRouteLocation(
  id: string,
  label: string,
  address: string,
  kind: RouteLocationDraft['kind'],
): RouteLocationDraft {
  return { id, label, address, kind };
}

export function createRoutePlanFromPreset(
  date: string,
  preset: RoutePreset,
  optimization: RouteOptimizationMode,
): RoutePlanDraft {
  const destination = createRouteLocation(
    'destination-base',
    'Francisco Balchak',
    ROUTE_BASE_ADDRESS,
    'destination',
  );

  if (preset === 'flamboyant-plav') {
    return {
      date,
      preset,
      optimization,
      origin: createRouteLocation(
        'origin-flamboyant',
        'Flamboyant',
        ROUTE_FLAMBOYANT_ADDRESS,
        'origin',
      ),
      mandatoryBeforeDeliveries: [
        createRouteLocation('mandatory-plav', 'PLAV', ROUTE_PLAV_ADDRESS, 'mandatory'),
      ],
      mandatoryAfterDeliveries: [],
      destination,
    };
  }

  if (preset === 'plav-flamboyant') {
    return {
      date,
      preset,
      optimization,
      origin: createRouteLocation('origin-plav', 'PLAV', ROUTE_PLAV_ADDRESS, 'origin'),
      mandatoryBeforeDeliveries: [],
      mandatoryAfterDeliveries: [
        createRouteLocation(
          'mandatory-flamboyant',
          'Flamboyant',
          ROUTE_FLAMBOYANT_ADDRESS,
          'mandatory',
        ),
      ],
      destination,
    };
  }

  return {
    date,
    preset,
    optimization,
    origin: createRouteLocation('origin-custom', 'Origem', '', 'origin'),
    mandatoryBeforeDeliveries: [],
    mandatoryAfterDeliveries: [],
    destination,
  };
}
