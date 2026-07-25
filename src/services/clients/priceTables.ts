import type { CustomClient } from '@/types/data';
import { formatClientName, normalizeClientKey, normalizeMoney } from '@/utils/data';

export type HistoricalPriceTable = '2024_2025' | 'antigos' | 'atuais';

export const PRICE_CUTOFFS = {
  current: '2026-04-05',
  legacy: '2025-05-05',
} as const;

export const HISTORICAL_PRICE_TABLES: Record<HistoricalPriceTable, Record<string, number>> = {
  '2024_2025': {
    Guilherme: 40.5,
    Lu: 44.5,
    Luciano: 43.3,
    Sandro: 44.5,
    Elias: 42.9,
    Viana: 44.6,
    Helder: 44.5,
    Márcia: 44.7,
    Aldo: 44.9,
    Andre: 44.5,
    Vaticano: 45,
    Monique: 43.4,
    Didi: 44.5,
  },
  antigos: {
    Adri: 44.5,
    Aldo: 48.9,
    Andre: 48.5,
    Escola: 48,
    Familia: 55,
    Gilson: 44.5,
    Guilherme: 44.5,
    Helder: 48.5,
    Lu: 48.5,
    Luciano: 47.3,
    Márcia: 49,
    Monique: 47.4,
    Particular: 55,
    'Particular Antigo': 55,
    Sandro: 48.5,
    Elias: 46.9,
    Vaticano: 49,
    Viana: 48.6,
  },
  atuais: {
    Adri: 48.5,
    Aldo: 52,
    Andre: 49.8,
    Escola: 48,
    Familia: 60,
    Gilson: 48.5,
    Guilherme: 48.5,
    Helder: 50,
    Lu: 50,
    Luciano: 49.8,
    Márcia: 52,
    Monique: 49.8,
    Particular: 60,
    'Particular Antigo': 55,
    Sandro: 49.8,
    Elias: 49.8,
    Vaticano: 52,
    Viana: 49.8,
  },
};

function tableForDate(date?: string): HistoricalPriceTable {
  if (!date || date >= PRICE_CUTOFFS.current) return 'atuais';
  if (date >= PRICE_CUTOFFS.legacy) return 'antigos';
  return '2024_2025';
}

function findByNormalizedName(table: Record<string, number>, name: string): number | undefined {
  const key = normalizeClientKey(name);
  const entry = Object.entries(table).find(([tableName]) => normalizeClientKey(tableName) === key);
  return entry?.[1];
}

export function resolveClientPrice(
  name: string,
  date?: string,
  customClients: Record<string, CustomClient> = {},
): number | undefined {
  const normalizedName = normalizeClientKey(name);
  const customEntry = Object.entries(customClients).find(
    ([customName]) => normalizeClientKey(customName) === normalizedName,
  );
  if (customEntry) return normalizeMoney(customEntry[1].preco);

  return findByNormalizedName(HISTORICAL_PRICE_TABLES[tableForDate(date)], formatClientName(name));
}

export function historicalClientNames(): string[] {
  return Object.values(HISTORICAL_PRICE_TABLES).flatMap((table) => Object.keys(table));
}
