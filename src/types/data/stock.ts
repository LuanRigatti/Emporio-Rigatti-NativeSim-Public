export interface StockSnapshot {
  period: string;
  openingBalance: number;
  purchased: number;
  delivered: number;
  closingBalance: number;
  calculatedAt: string;
}

export type StockSnapshotMap = Record<string, StockSnapshot>;
