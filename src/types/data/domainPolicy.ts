export type DataDomainClassification = 'firebase-supported' | 'local-only' | 'derived';

export type DataReadinessStatus = 'READY' | 'BLOCKED' | 'LOCAL_ONLY' | 'DERIVED';

export type DataDomain =
  | 'auth'
  | 'clients'
  | 'deliveries'
  | 'factory'
  | 'dailyData'
  | 'notifications'
  | 'location'
  | 'dailyLocalOnly'
  | 'carSettings'
  | 'companySettings'
  | 'localPreferences'
  | 'stock'
  | 'financialAggregates';

export interface DataDomainDefinition {
  domain: DataDomain;
  classification: DataDomainClassification;
  firebaseNodes?: readonly string[];
  fields: readonly string[];
  notes: string;
}

/**
 * Fields that are deliberately kept out of the legacy Firebase payload.
 * Keeping this list in one place prevents a local feature from silently
 * becoming part of the remote schema through a mapper's legacyFields object.
 */
export const LOCAL_ONLY_FIREBASE_FIELDS = [
  'activeSession',
  'activeRoute',
  'companyProfile',
  'durationDetails',
  'gpsSamples',
  'incrementalEntries',
  'kmAutomatico',
  'latitude',
  'locationData',
  'longitude',
  'outros',
  'points',
  'pontosGps',
  'rawLocationData',
  'routeHistory',
  'routeSessions',
] as const;

export const LOCAL_ONLY_DATA_POLICY = {
  location: [
    'active session',
    'detailed route history',
    'latitude/longitude',
    'GPS points',
    'detailed duration',
    'raw location data',
  ],
  dailyData: ['outros', 'incremental entries', 'detailed automatic route kilometers'],
  localPreferences: ['theme preferences', 'development settings', 'cache'],
} as const;

export const DATA_DOMAIN_POLICY: readonly DataDomainDefinition[] = [
  {
    classification: 'firebase-supported',
    domain: 'auth',
    fields: ['authenticated user'],
    notes: 'Firebase Auth adapter exists; the feature flag remains disabled.',
  },
  {
    classification: 'firebase-supported',
    domain: 'clients',
    fields: ['name', 'price', 'address', 'legacy client fields'],
    firebaseNodes: ['clientesCustom', 'entregas.client references'],
    notes: 'ClientDataSource selects the mock now and has a Firebase adapter prepared.',
  },
  {
    classification: 'firebase-supported',
    domain: 'deliveries',
    fields: [
      'id',
      'client',
      'date',
      'quantity',
      'value',
      'historical unit price',
      'status',
      'payment method',
    ],
    firebaseNodes: ['entregas'],
    notes: 'The legacy delivery mapper and repository preserve historical values.',
  },
  {
    classification: 'firebase-supported',
    domain: 'factory',
    fields: [
      'receipts',
      'quantities',
      'historical totals',
      'partial payments',
      'balances',
      'current bucket cost',
    ],
    firebaseNodes: ['users/{uid}/factoryReceipts', 'users/{uid}/settings/factory'],
    notes:
      'FactoryReceipt is canonical; payments remain nested and the bucket cost is a setting document.',
  },
  {
    classification: 'firebase-supported',
    domain: 'dailyData',
    fields: [
      'estar',
      'fuel value',
      'fuel price',
      'fuel type',
      'legacy kilometers',
      'monthly light',
    ],
    firebaseNodes: ['gastosDiarios', 'gastosMensais'],
    notes: 'Only fields supported by the legacy daily/monthly schema are mapped remotely.',
  },
  {
    classification: 'firebase-supported',
    domain: 'notifications',
    fields: ['push token'],
    firebaseNodes: ['pushToken'],
    notes: 'The existing user data contract includes the push token node.',
  },
  {
    classification: 'local-only',
    domain: 'location',
    fields: LOCAL_ONLY_DATA_POLICY.location,
    notes: 'RouteTrackingRepository persists detailed routes in device storage only.',
  },
  {
    classification: 'local-only',
    domain: 'dailyLocalOnly',
    fields: LOCAL_ONLY_DATA_POLICY.dailyData,
    notes: 'These fields are available locally but absent from the legacy Firebase schema.',
  },
  {
    classification: 'firebase-supported',
    domain: 'carSettings',
    fields: ['gasoline autonomy', 'alcohol autonomy'],
    firebaseNodes: ['users/{uid}/settings/car'],
    notes:
      'Car consumption settings are user-scoped configuration used by fuel calculations; historical delivery values are not recalculated.',
  },
  {
    classification: 'firebase-supported',
    domain: 'companySettings',
    fields: ['legal name', 'trade name', 'tax id', 'address'],
    firebaseNodes: ['users/{uid}/settings/company'],
    notes:
      'Company profile is user-scoped editable configuration; it is not a financial aggregate or derived value.',
  },
  {
    classification: 'local-only',
    domain: 'localPreferences',
    fields: LOCAL_ONLY_DATA_POLICY.localPreferences,
    notes: 'Device preferences, development settings and cache are not app data nodes.',
  },
  {
    classification: 'derived',
    domain: 'stock',
    fields: ['opening balance', 'purchased', 'delivered', 'closing balance'],
    notes:
      'Stock is recalculated from FactoryReceipt plus Delivery; snapshots are materialized only.',
  },
  {
    classification: 'derived',
    domain: 'financialAggregates',
    fields: ['stock balance', 'fuel cost', 'totals', 'monthly aggregates', 'total kilometers'],
    notes: 'Financial values are calculated from source data and daily route data.',
  },
];

export function readinessStatusForClassification(
  classification: DataDomainClassification,
  adapterAvailable = true,
): DataReadinessStatus {
  if (classification === 'local-only') return 'LOCAL_ONLY';
  if (classification === 'derived') return 'DERIVED';
  return adapterAvailable ? 'READY' : 'BLOCKED';
}

export function withoutLocalOnlyFields<T extends Record<string, unknown>>(value: T): Partial<T> {
  const localOnly = new Set<string>(LOCAL_ONLY_FIREBASE_FIELDS);
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !localOnly.has(key)),
  ) as Partial<T>;
}
