import {
  COST_SETTINGS_DEFAULT_SCOPE,
  costSettingsStorage,
  type CostSettings,
  type CostSettingsOperationOptions,
  type CostSettingsStorage,
} from './CostSettingsStorage';
import type { DailyDataDataSource } from './DailyDataDataSource';

export class LocalDailyDataDataSource implements DailyDataDataSource {
  public constructor(private readonly storage: Pick<CostSettingsStorage, 'load' | 'save'>) {}

  public load(
    scope = COST_SETTINGS_DEFAULT_SCOPE,
    options?: CostSettingsOperationOptions,
  ): Promise<CostSettings> {
    return this.storage.load(scope, options);
  }

  public save(
    settings: CostSettings,
    scope = COST_SETTINGS_DEFAULT_SCOPE,
    options?: CostSettingsOperationOptions,
  ): Promise<void> {
    return this.storage.save(settings, scope, options);
  }
}

export const localDailyDataDataSource = new LocalDailyDataDataSource(costSettingsStorage);
