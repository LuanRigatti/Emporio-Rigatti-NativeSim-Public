import {
  mapCustomClients,
  mapDailyExpenses,
  mapDeliveries,
  mapFactoryReceipts,
  mapMonthlyExpenses,
} from '@/mappers/firebase';
import type { BackupData, BackupPreview, BackupSourceFormat, UnknownRecord } from '@/types/data';
import { DataError } from '@/services/data/DataError';
import { isRecord } from '@/utils/data';

export interface BackupValidationResult {
  data: BackupData;
  preview: BackupPreview;
}

const KNOWN_FIELDS = new Set([
  'entregas',
  'gastosDiarios',
  'gastosMensais',
  'recebimentoBaldes',
  'recebimentosFabrica',
  'clientesCustom',
]);

function parseJson(serialized: string): unknown {
  try {
    return JSON.parse(serialized) as unknown;
  } catch (error) {
    throw new DataError('serialization', 'O arquivo selecionado não contém um JSON válido.', error);
  }
}

function emptyData(): BackupData {
  return {
    clientesCustom: {},
    entregas: [],
    gastosDiarios: {},
    gastosMensais: {},
    recebimentoBaldes: [],
  };
}

function countPayments(data: BackupData): number {
  return data.recebimentoBaldes.reduce((total, receipt) => total + receipt.pagamentos.length, 0);
}

function legacyId(value: UnknownRecord, index: number): string {
  const serialized = JSON.stringify(value);
  let hash = 0;
  for (let position = 0; position < serialized.length; position += 1) {
    hash = (hash * 31 + serialized.charCodeAt(position)) >>> 0;
  }
  return `legacy-${index}-${hash.toString(36)}`;
}

function normalizeLegacyDeliveries(value: unknown): { generatedIds: number; value: unknown } {
  if (!Array.isArray(value)) return { generatedIds: 0, value };
  let generatedIds = 0;
  const normalized = value.map((item, index) => {
    if (!isRecord(item)) return item;
    const next: UnknownRecord = { ...item };
    if (next.cliente === undefined && typeof next.nome === 'string') next.cliente = next.nome;
    if (next.valor === undefined && next.valorTotal !== undefined) next.valor = next.valorTotal;
    if (next.id === undefined) {
      next.id = legacyId(next, index);
      generatedIds += 1;
    }
    return next;
  });
  return { generatedIds, value: normalized };
}

function previewFor(
  data: BackupData,
  sourceFormat: BackupSourceFormat,
  warnings: string[],
): BackupPreview {
  return {
    conflicts: [],
    customClients: Object.keys(data.clientesCustom ?? {}).length,
    dailyExpenses: Object.keys(data.gastosDiarios).length,
    deliveries: data.entregas.length,
    factoryPayments: countPayments(data),
    factoryReceipts: data.recebimentoBaldes.length,
    monthlyExpenses: Object.keys(data.gastosMensais).length,
    sourceFormat,
    warnings,
  };
}

function fromRecord(raw: UnknownRecord): BackupValidationResult {
  const warnings: string[] = [];
  const unknownFields = Object.keys(raw).filter((key) => !KNOWN_FIELDS.has(key));
  if (unknownFields.length > 0) {
    warnings.push(`Campos não reconhecidos foram ignorados: ${unknownFields.join(', ')}.`);
  }

  const hasCanonicalFactory = raw.recebimentoBaldes !== undefined;
  const hasLegacyFactory = raw.recebimentosFabrica !== undefined;
  if (hasCanonicalFactory && hasLegacyFactory) {
    warnings.push(
      'O arquivo contém recebimentoBaldes e recebimentosFabrica; o campo canônico foi utilizado.',
    );
  } else if (hasLegacyFactory) {
    warnings.push('O campo legado recebimentosFabrica foi convertido para recebimentoBaldes.');
  }

  const hasKnownField = Object.keys(raw).some((key) => KNOWN_FIELDS.has(key));
  if (!hasKnownField) {
    throw new DataError('validation', 'O JSON não contém nenhuma coleção de backup reconhecida.');
  }

  const factoryValue = hasCanonicalFactory ? raw.recebimentoBaldes : raw.recebimentosFabrica;
  const normalizedDeliveries = normalizeLegacyDeliveries(raw.entregas);
  if (normalizedDeliveries.generatedIds > 0) {
    warnings.push(
      `${normalizedDeliveries.generatedIds} entrega(s) sem id receberam identificador compatível.`,
    );
  }

  const data: BackupData = {
    clientesCustom: raw.clientesCustom === undefined ? {} : mapCustomClients(raw.clientesCustom),
    entregas: raw.entregas === undefined ? [] : mapDeliveries(normalizedDeliveries.value),
    gastosDiarios: raw.gastosDiarios === undefined ? {} : mapDailyExpenses(raw.gastosDiarios),
    gastosMensais: raw.gastosMensais === undefined ? {} : mapMonthlyExpenses(raw.gastosMensais),
    recebimentoBaldes: factoryValue === undefined ? [] : mapFactoryReceipts(factoryValue),
  };
  const sourceFormat: BackupSourceFormat = hasLegacyFactory ? 'legacy-factory-alias' : 'canonical';

  if (raw.clientesCustom === undefined) {
    warnings.push('clientesCustom não foi encontrado; foi tratado como uma coleção vazia.');
  }

  return { data, preview: previewFor(data, sourceFormat, warnings) };
}

export class BackupValidationService {
  public parse(serialized: string): BackupValidationResult {
    const raw = parseJson(serialized);
    if (Array.isArray(raw)) {
      const normalizedDeliveries = normalizeLegacyDeliveries(raw);
      const warnings = ['O arquivo contém apenas entregas no formato legado.'];
      if (normalizedDeliveries.generatedIds > 0) {
        warnings.push(
          `${normalizedDeliveries.generatedIds} entrega(s) sem id receberam identificador compatível.`,
        );
      }
      const data: BackupData = {
        ...emptyData(),
        entregas: mapDeliveries(normalizedDeliveries.value),
      };
      return {
        data,
        preview: previewFor(data, 'legacy-deliveries-array', warnings),
      };
    }
    if (!isRecord(raw)) {
      throw new DataError('validation', 'A raiz do JSON deve ser um objeto ou um array legado.');
    }
    return fromRecord(raw);
  }
}

export const backupValidationService = new BackupValidationService();
