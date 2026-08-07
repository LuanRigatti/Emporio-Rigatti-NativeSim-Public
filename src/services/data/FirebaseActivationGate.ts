import {
  ENABLE_FIREBASE_APP_DATA,
  ENABLE_FIREBASE_AUTH,
  ENABLE_FIREBASE_WRITES,
  ENABLE_MOCK_CLIENT_DATA,
} from '@/config/featureFlags';
import type { FirebaseReadinessDependencies } from './FirebaseReadinessGate';
import { getFirebaseReadiness } from './FirebaseReadinessGate';

export interface FirebaseSchemaContract {
  domain: string;
  firebasePath: string;
  readMapper: string;
  writeMapper: string;
  key: string;
  legacyCompatible: boolean;
  readReady: boolean;
  writeEnabled: boolean;
  notes: string;
}

export const FIREBASE_SCHEMA_CONTRACTS: readonly FirebaseSchemaContract[] = [
  {
    domain: 'Auth',
    firebasePath: 'Firebase Auth user',
    readMapper: 'FirebaseAuthDataSource/AuthService',
    writeMapper: 'Firebase Auth provider',
    key: 'uid',
    legacyCompatible: true,
    readReady: true,
    writeEnabled: false,
    notes: 'The Auth UID is the only user scope; mock-user-1 is rejected by RTDB paths.',
  },
  {
    domain: 'Clientes',
    firebasePath: 'usuarios/{uid}/clientesCustom',
    readMapper: 'mapCustomClients',
    writeMapper: 'toFirebaseCustomClients',
    key: 'client name (legacy key)',
    legacyCompatible: true,
    readReady: true,
    writeEnabled: false,
    notes: 'Historical names/priceTables remain compatible; no ID migration is performed.',
  },
  {
    domain: 'Entregas',
    firebasePath: 'usuarios/{uid}/entregas',
    readMapper: 'mapDeliveries',
    writeMapper: 'toFirebaseDeliveries',
    key: 'id',
    legacyCompatible: true,
    readReady: true,
    writeEnabled: false,
    notes:
      'Legacy value, optional historical unit price, dates and unknown legacy fields are preserved.',
  },
  {
    domain: 'Fábrica/Compras',
    firebasePath: 'usuarios/{uid}/recebimentoBaldes',
    readMapper: 'mapFactoryReceipts',
    writeMapper: 'toFirebaseFactoryReceipts',
    key: 'receipt id; nested payment id',
    legacyCompatible: true,
    readReady: true,
    writeEnabled: false,
    notes: 'FactoryReceipt/FactoryPayment map to the legacy receipt and payment shape.',
  },
  {
    domain: 'Dados diários',
    firebasePath: 'usuarios/{uid}/gastosDiarios',
    readMapper: 'mapDailyExpenses',
    writeMapper: 'toFirebaseDailyExpenses',
    key: 'date',
    legacyCompatible: true,
    readReady: true,
    writeEnabled: false,
    notes: 'Only legacy fields are supported; local-only fields are stripped.',
  },
  {
    domain: 'Dados mensais',
    firebasePath: 'usuarios/{uid}/gastosMensais',
    readMapper: 'mapMonthlyExpenses',
    writeMapper: 'toFirebaseMonthlyExpenses',
    key: 'yyyy-MM',
    legacyCompatible: true,
    readReady: true,
    writeEnabled: false,
    notes: 'Legacy numeric and object light formats remain readable.',
  },
  {
    domain: 'Push token',
    firebasePath: 'usuarios/{uid}/pushToken',
    readMapper: 'PushTokenRepository.read',
    writeMapper: 'PushTokenRepository.replace',
    key: 'single node',
    legacyCompatible: true,
    readReady: true,
    writeEnabled: false,
    notes: 'Writing is explicitly blocked in the first read-only activation.',
  },
  {
    domain: 'StockSnapshot futuro',
    firebasePath: 'usuarios/{uid}/stockSnapshots/{yyyy-MM}',
    readMapper: 'mapStockSnapshots',
    writeMapper: 'toFirebaseStockSnapshots',
    key: 'yyyy-MM',
    legacyCompatible: false,
    readReady: false,
    writeEnabled: false,
    notes: 'Prepared materialization only; it does not participate in stock calculation.',
  },
];

export interface FirebaseActivationGateReport {
  status: 'READY_FOR_READ_ONLY_FIREBASE' | 'BLOCKED';
  blockers: string[];
  warnings: string[];
  schema: readonly FirebaseSchemaContract[];
  identity: {
    status: 'READY' | 'BLOCKED';
    source: string;
    scope: string;
    blockers: string[];
  };
  rollback: {
    ready: boolean;
    procedure: readonly string[];
  };
  flags: {
    enableFirebaseAuth: boolean;
    enableFirebaseAppData: boolean;
    enableFirebaseWrites: boolean;
    enableMockClientData: boolean;
  };
}

export function getFirebaseActivationReadiness(
  dependencies?: FirebaseReadinessDependencies,
): FirebaseActivationGateReport {
  const readiness = getFirebaseReadiness(dependencies);
  const blockers = [...readiness.blockers];
  const warnings: string[] = [];
  const identityBlockers: string[] = [];

  if (ENABLE_FIREBASE_WRITES) {
    blockers.push('ENABLE_FIREBASE_WRITES must remain false during read-only activation.');
  }
  if (ENABLE_MOCK_CLIENT_DATA) {
    warnings.push('Mock client data remains active until the real Firebase comparison phase.');
  }
  if (!ENABLE_FIREBASE_AUTH) {
    warnings.push('Firebase Auth remains disabled; Phase A has not been executed.');
  }
  if (!ENABLE_FIREBASE_APP_DATA) {
    warnings.push('Firebase app data remains disabled; no remote data is being read.');
  }
  warnings.push(
    'DailyData legacy km currently maps the persisted kilometers field; automatic route km remains local-only and must be explicitly materialized before write activation.',
  );

  return {
    blockers,
    flags: {
      enableFirebaseAppData: ENABLE_FIREBASE_APP_DATA,
      enableFirebaseAuth: ENABLE_FIREBASE_AUTH,
      enableFirebaseWrites: ENABLE_FIREBASE_WRITES,
      enableMockClientData: ENABLE_MOCK_CLIENT_DATA,
    },
    identity: {
      blockers: identityBlockers,
      scope: 'usuarios/{uid}',
      source: 'Firebase Auth uid',
      status: identityBlockers.length === 0 ? 'READY' : 'BLOCKED',
    },
    rollback: {
      procedure: [
        'Desativar ENABLE_FIREBASE_APP_DATA e ENABLE_FIREBASE_AUTH.',
        'Manter ENABLE_FIREBASE_WRITES como false.',
        'Reabrir o app com os datasources mock/local.',
        'Não apagar AsyncStorage nem executar migração automática.',
      ],
      ready: true,
    },
    schema: FIREBASE_SCHEMA_CONTRACTS,
    status: blockers.length === 0 ? 'READY_FOR_READ_ONLY_FIREBASE' : 'BLOCKED',
    warnings,
  };
}

export function canStartFirebaseReadOnlyPhase(
  dependencies?: FirebaseReadinessDependencies,
): boolean {
  return getFirebaseActivationReadiness(dependencies).status === 'READY_FOR_READ_ONLY_FIREBASE';
}
