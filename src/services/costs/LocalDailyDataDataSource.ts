import {
  costSettingsStorage,
  type CostSettings,
  type CostSettingsStorage,
} from './CostSettingsStorage';
import type { DailyDataDataSource } from './DailyDataDataSource';

export class LocalDailyDataDataSource implements DailyDataDataSource {
  public constructor(private readonly storage: Pick<CostSettingsStorage, 'load' | 'save'>) {}

  public load(): Promise<CostSettings> {
    return this.storage.load();
  }

  public save(settings: CostSettings): Promise<void> {
    return this.storage.save(settings);
  }
}

export const localDailyDataDataSource = new LocalDailyDataDataSource(costSettingsStorage);
