/**
 * Biometric unlock is prepared but intentionally disabled until the login flow
 * is explicitly migrated to use it.
 */
export const ENABLE_BIOMETRIC_UNLOCK = false;

/**
 * Enables the prepared ProgressiveBlur layer on the Home screen.
 */
export const ENABLE_PROGRESSIVE_BLUR = true;

/**
 * Keeps the Clientes screen on its existing fictitious development data until
 * Firebase Auth and the definitive client database are connected.
 */
export const ENABLE_MOCK_CLIENT_DATA = true;

/**
 * Keeps the shared app data source on deterministic local fixtures until the
 * Firebase data migration is explicitly enabled.
 */
export const ENABLE_FIREBASE_APP_DATA = false;

/**
 * Keeps Firebase app-data writes disabled during the first controlled
 * activation. Read-only Firebase can be tested without mutating the database.
 */
export const ENABLE_FIREBASE_WRITES = false;

/**
 * Keeps authentication on the local mock until the Firebase Auth migration is
 * explicitly enabled.
 */
export const ENABLE_FIREBASE_AUTH = true;

/**
 * Etapa 1: clientes e entregas usam documentos do Firestore novo. O mock
 * permanece disponível como fallback; o RTDB legado não participa deste fluxo.
 */
export const ENABLE_FIRESTORE_CLIENTS_DELIVERIES = true;

/** Etapa 2: compras da fÃ¡brica usam documentos Firestore com pagamentos separados. */
export const ENABLE_FIRESTORE_FACTORY_RECEIPTS = true;

/** Etapa 3: custos manuais usam documentos Firestore por dia/mês. */
export const ENABLE_FIRESTORE_DAILY_MONTHLY = true;

/** Etapa 4: a configuraÃ§Ã£o vigente do valor do balde usa um documento Firestore. */
export const ENABLE_FIRESTORE_FACTORY_SETTINGS = true;

/** Etapa 5: as autonomias configuráveis do carro usam um documento Firestore. */
export const ENABLE_FIRESTORE_CAR_SETTINGS = true;

/** Etapa 6: os dados editáveis da empresa usam um documento Firestore. */
export const ENABLE_FIRESTORE_COMPANY_PROFILE = true;
