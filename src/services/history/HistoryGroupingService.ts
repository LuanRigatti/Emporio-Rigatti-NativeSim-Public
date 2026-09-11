import type { Delivery, HistoryGroupingInput, HistoryMonthGroup } from '@/types/data';

import { historyQueryService } from './HistoryQueryService';

export class HistoryGroupingService {
  public group(deliveries: Delivery[], input: HistoryGroupingInput): HistoryMonthGroup[] {
    return historyQueryService.group(deliveries, input);
  }
}

export const historyGroupingService = new HistoryGroupingService();
