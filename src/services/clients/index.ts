export {
  ClientCatalogService,
  clientCatalogService,
  summarizeClient,
} from './ClientCatalogService';
export type { ClientCatalogQuery } from './ClientCatalogService';
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
