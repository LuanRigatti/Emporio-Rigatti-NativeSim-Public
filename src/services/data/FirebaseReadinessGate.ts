import {
  ENABLE_FIREBASE_APP_DATA,
  ENABLE_FIREBASE_AUTH,
  ENABLE_MOCK_CLIENT_DATA,
} from '@/config/featureFlags';
import {
  mapCustomClients,
  mapDailyExpenses,
  mapDeliveries,
  mapFactoryReceipts,
  toFirebaseCustomClients,
  toFirebaseDailyExpenses,
  toFirebaseDeliveries,
  toFirebaseFactoryReceipts,
} from '@/mappers/firebase';
import type {
  DataDomain,
  DataDomainDefinition,
  DataReadinessStatus,
} from '@/types/data/domainPolicy';
import { DATA_DOMAIN_POLICY, readinessStatusForClassification } from '@/types/data/domainPolicy';

type MethodName = string;

export interface FirebaseReadinessDependencies {
  authAdapter?: unknown | null;
  clientsAdapter?: unknown | null;
  deliveriesAdapter?: unknown | null;
  factoryAdapter?: unknown | null;
  dailyDataAdapter?: unknown | null;
  mappers?: Partial<Record<'clients' | 'deliveries' | 'factory' | 'dailyData', unknown>>;
  localOnlyPolicy?: boolean;
}

export interface FirebaseReadinessDomain extends DataDomainDefinition {
  status: DataReadinessStatus;
}

export interface FirebaseReadinessReport {
  canEnable: boolean;
  status: 'READY' | 'BLOCKED';
  blockers: string[];
  domains: FirebaseReadinessDomain[];
  flags: {
    enableFirebaseAppData: boolean;
    enableFirebaseAuth: boolean;
    enableMockClientData: boolean;
  };
}

/**
 * These are registrations of prepared contracts, not datasource instances.
 * The gate is deliberately side-effect free: it must be safe to inspect while
 * Firebase is disabled and must not initialize Firebase SDK modules.
 */
const defaultDependencies: FirebaseReadinessDependencies & {
  mappers: Record<string, unknown>;
  localOnlyPolicy: boolean;
} = {
  authAdapter: true,
  clientsAdapter: true,
  deliveriesAdapter: true,
  factoryAdapter: true,
  dailyDataAdapter: true,
  mappers: {
    clients: [mapCustomClients, toFirebaseCustomClients],
    deliveries: [mapDeliveries, toFirebaseDeliveries],
    factory: [mapFactoryReceipts, toFirebaseFactoryReceipts],
    dailyData: [mapDailyExpenses, toFirebaseDailyExpenses],
  },
  localOnlyPolicy: true,
};

const REQUIRED_METHODS: Record<
  'auth' | 'clients' | 'deliveries' | 'factory' | 'dailyData',
  readonly MethodName[]
> = {
  auth: ['getCurrentUser', 'subscribe', 'signInWithGooglePopup', 'signOut'],
  clients: ['load', 'list'],
  deliveries: ['read', 'replace'],
  factory: ['read', 'replace'],
  dailyData: ['read', 'replace'],
};

function hasMethods(value: unknown, methods: readonly MethodName[]): boolean {
  if (value === true) return true;
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) return false;
  return methods.every(
    (method) => typeof (value as Record<string, unknown>)[method] === 'function',
  );
}

function hasMapperPair(value: unknown): boolean {
  return (
    Array.isArray(value) && value.length === 2 && value.every((item) => typeof item === 'function')
  );
}

function evaluateAdapterAvailability(
  dependencies: FirebaseReadinessDependencies,
): Record<'auth' | 'clients' | 'deliveries' | 'factory' | 'dailyData', boolean> {
  const authAdapter = dependencies.authAdapter ?? null;
  const clientsAdapter = dependencies.clientsAdapter ?? null;
  const deliveriesAdapter = dependencies.deliveriesAdapter ?? null;
  const factoryAdapter = dependencies.factoryAdapter ?? null;
  const dailyDataAdapter = dependencies.dailyDataAdapter ?? null;
  const mappers = dependencies.mappers ?? {};

  return {
    auth: hasMethods(authAdapter, REQUIRED_METHODS.auth),
    clients: hasMethods(clientsAdapter, REQUIRED_METHODS.clients) && hasMapperPair(mappers.clients),
    deliveries:
      hasMethods(deliveriesAdapter, REQUIRED_METHODS.deliveries) &&
      hasMapperPair(mappers.deliveries),
    factory: hasMethods(factoryAdapter, REQUIRED_METHODS.factory) && hasMapperPair(mappers.factory),
    dailyData:
      hasMethods(dailyDataAdapter, REQUIRED_METHODS.dailyData) && hasMapperPair(mappers.dailyData),
  };
}

const DOMAIN_ADAPTERS: Partial<
  Record<DataDomain, keyof ReturnType<typeof evaluateAdapterAvailability>>
> = {
  auth: 'auth',
  clients: 'clients',
  deliveries: 'deliveries',
  factory: 'factory',
  dailyData: 'dailyData',
  notifications: undefined,
};

export function getFirebaseReadiness(
  overrides: FirebaseReadinessDependencies = {},
): FirebaseReadinessReport {
  const dependencies = {
    ...defaultDependencies,
    ...overrides,
    mappers: { ...defaultDependencies.mappers, ...overrides.mappers },
  };
  const availability = evaluateAdapterAvailability(dependencies);
  const blockers: string[] = [];
  const domains = DATA_DOMAIN_POLICY.map((definition): FirebaseReadinessDomain => {
    const adapterKey = DOMAIN_ADAPTERS[definition.domain];
    const adapterAvailable = adapterKey ? availability[adapterKey] : true;
    const status = readinessStatusForClassification(definition.classification, adapterAvailable);

    if (status === 'BLOCKED') blockers.push(`${definition.domain}: adapter or mapper unavailable`);

    return { ...definition, status };
  });

  if (dependencies.localOnlyPolicy === false)
    blockers.push('local-only data policy is not formalized');

  return {
    blockers,
    canEnable: blockers.length === 0,
    domains,
    flags: {
      enableFirebaseAppData: ENABLE_FIREBASE_APP_DATA,
      enableFirebaseAuth: ENABLE_FIREBASE_AUTH,
      enableMockClientData: ENABLE_MOCK_CLIENT_DATA,
    },
    status: blockers.length === 0 ? 'READY' : 'BLOCKED',
  };
}

/** Architectural gate only. It never changes feature flags or selects Firebase. */
export function canEnableFirebaseAppData(dependencies?: FirebaseReadinessDependencies): boolean {
  return getFirebaseReadiness(dependencies).canEnable;
}

export const firebaseReadinessGate = {
  canEnable: canEnableFirebaseAppData,
  inspect: getFirebaseReadiness,
};
