export {
  ClientCatalogService,
  clientCatalogService,
  summarizeClient,
} from './ClientCatalogService';
export type { ClientCatalogQuery } from './ClientCatalogService';
export {
  FirebaseClientDataSource,
  clientDataSource,
  firebaseClientDataSource,
} from './ClientDataSource';
export type { ClientDataMode, ClientDataSource } from './ClientDataSource';
export {
  MOCK_CLIENT_ITEMS,
  MockClientDataSource,
  mockClientDataSource,
} from './MockClientDataSource';
export {
  MOCK_CLIENTS_STORAGE_KEY,
  MockClientStorage,
  mockClientStorage,
} from './MockClientStorage';
export { calculateClientImpact } from './ClientImpactService';
export type { ClientImpact } from './ClientImpactService';
export { clientBackupService, ClientBackupService } from './ClientBackupService';
export { clientIdentityRegistry, ClientIdentityRegistry } from './ClientIdentityRegistry';
export {
  HISTORICAL_PRICE_TABLES,
  PRICE_CUTOFFS,
  historicalClientNames,
  resolveClientPrice,
} from './priceTables';
export {
  FirestoreClientDataSource,
  firestoreClientDataSource,
} from './FirestoreClientDataSource';
