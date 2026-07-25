import type { Delivery, CustomClient } from './data';

export const ROUTE_BASE_ADDRESS = 'Rua Francisco Balchak, 83 - Boa Vista, Curitiba - PR';
export const ROUTE_FLAMBOYANT_ADDRESS = 'Rua Flamboyant, 111 - Cachoeira, Curitiba - PR';
export const ROUTE_PLAV_ADDRESS =
  'Rua Cyro Correia Pereira, 2000 - Cidade Industrial de Curitiba, Curitiba - PR, 81460-050';

export type RoutePreset = 'flamboyant-plav' | 'plav-flamboyant' | 'custom';
export type RouteOptimizationMode = 'distance' | 'time';
export type RouteAddressStatus = 'resolved' | 'invalid' | 'manualConfirmed';
export type RouteStopKind = 'origin' | 'mandatory' | 'delivery' | 'destination';

export interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

export interface RouteLocationDraft {
  id: string;
  label: string;
  address: string;
  kind: RouteStopKind;
}

export interface RoutePlanDraft {
  date: string;
  preset: RoutePreset;
  optimization: RouteOptimizationMode;
  origin: RouteLocationDraft;
  mandatoryBeforeDeliveries: RouteLocationDraft[];
  mandatoryAfterDeliveries: RouteLocationDraft[];
  destination: RouteLocationDraft;
}

export interface RouteAddressResolution {
  address: string;
  status: RouteAddressStatus;
  coordinates?: RouteCoordinate;
  source: 'delivery' | 'customClient' | 'knownClient' | 'manual' | 'geocoding';
  error?: string;
  deliveryId?: string;
  clientName?: string;
}

export interface RouteStop {
  id: string;
  kind: RouteStopKind;
  label: string;
  address: string;
  deliveryId?: string;
  clientName?: string;
  mandatory: boolean;
  coordinates: RouteCoordinate;
  addressResolution: RouteAddressResolution;
  sequence: number;
  delivered?: boolean;
}

export interface RouteSegmentSummary {
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline?: string;
  decodedPolyline: RouteCoordinate[];
}

export interface RouteSummary {
  distanceKm: number;
  durationMinutes: number;
  segments: RouteSegmentSummary[];
}

export interface RouteSession {
  id: string;
  plan: RoutePlanDraft;
  deliveries: Delivery[];
  customClients: RouteClientAddresses;
  manualCoordinates: Readonly<Record<string, RouteCoordinate>>;
  addressOverrides: Readonly<Record<string, string>>;
  stops: RouteStop[];
  unresolvedAddresses: RouteAddressResolution[];
  summary: RouteSummary;
  currentStopIndex: number;
  status: 'ready' | 'inProgress' | 'completed';
}

export interface RouteAddressCandidate {
  delivery: Delivery;
  address: string;
  source: RouteAddressResolution['source'];
}

export type RouteClientAddresses = Record<string, CustomClient>;
