import type { UnknownRecord } from '@/types/data';

import { isBoolean, isRecord, isString, readNumber, readString } from './guards';
import { isValidIsoDate } from './dates';

export class DataValidationError extends Error {
  public readonly path: string;

  public constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'DataValidationError';
    this.path = path;
  }
}

function requireRecord(value: unknown, path: string): UnknownRecord {
  if (!isRecord(value)) throw new DataValidationError(path, 'esperado um objeto');
  return value;
}

function requireString(value: unknown, path: string): string {
  const result = readString(value);
  if (!result) throw new DataValidationError(path, 'esperada uma string não vazia');
  return result;
}

function requireNumber(value: unknown, path: string): number {
  const result = readNumber(value);
  if (result === undefined) throw new DataValidationError(path, 'esperado um número válido');
  return result;
}

function requireDate(value: unknown, path: string): string {
  const result = requireString(value, path);
  if (!isValidIsoDate(result) && !/^\d{2}\/\d{2}\/\d{4}$/.test(result)) {
    throw new DataValidationError(path, 'esperada uma data ISO ou legada válida');
  }
  return result;
}

export function validateDeliveryRecord(value: unknown, path: string): void {
  const record = requireRecord(value, path);
  requireString(record.id, `${path}.id`);
  requireString(record.cliente, `${path}.cliente`);
  requireNumber(record.quantidade, `${path}.quantidade`);
  requireNumber(record.valor, `${path}.valor`);
  requireString(record.status, `${path}.status`);
  if (!isBoolean(record.entregue)) {
    throw new DataValidationError(`${path}.entregue`, 'esperado boolean');
  }
  requireDate(record.data, `${path}.data`);
  if (
    record.invoiceStatus !== undefined &&
    !['emitido', 'a_emitir'].includes(String(record.invoiceStatus))
  ) {
    throw new DataValidationError(`${path}.invoiceStatus`, 'status de nota inválido');
  }
  if (
    record.metodoPagamento !== undefined &&
    !['Dinheiro', 'Pix'].includes(String(record.metodoPagamento))
  ) {
    throw new DataValidationError(`${path}.metodoPagamento`, 'método de pagamento inválido');
  }
  if (record.endereco !== undefined && !isString(record.endereco)) {
    throw new DataValidationError(`${path}.endereco`, 'esperada uma string');
  }
}

export function validateDeliveryArray(value: unknown, path = 'entregas'): void {
  if (!Array.isArray(value)) throw new DataValidationError(path, 'esperado um array completo');
  value.forEach((item, index) => validateDeliveryRecord(item, `${path}[${index}]`));
}

export function validateDailyExpenses(value: unknown, path = 'gastosDiarios'): void {
  const map = requireRecord(value, path);
  Object.entries(map).forEach(([date, expense]) => {
    requireDate(date, `${path}.${date}`);
    const record = requireRecord(expense, `${path}.${date}`);
    for (const key of ['estar', 'gasolina', 'km', 'precoGasolina']) {
      if (record[key] !== undefined) requireNumber(record[key], `${path}.${date}.${key}`);
    }
    if (record.tipoCombustivel !== undefined && !isString(record.tipoCombustivel)) {
      throw new DataValidationError(`${path}.${date}.tipoCombustivel`, 'esperada uma string');
    }
  });
}

export function validateMonthlyExpenses(value: unknown, path = 'gastosMensais'): void {
  const map = requireRecord(value, path);
  Object.entries(map).forEach(([month, expense]) => {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new DataValidationError(`${path}.${month}`, 'mês inválido');
    }
    if (readNumber(expense) !== undefined) return;
    const record = requireRecord(expense, `${path}.${month}`);
    if (record.luz !== undefined) requireNumber(record.luz, `${path}.${month}.luz`);
  });
}

export function validateFactoryReceipts(value: unknown, path = 'recebimentoBaldes'): void {
  if (!Array.isArray(value)) throw new DataValidationError(path, 'esperado um array completo');
}

export function validateFactoryReceiptsForWrite(value: unknown, path = 'recebimentoBaldes'): void {
  if (!Array.isArray(value)) throw new DataValidationError(path, 'esperado um array completo');
  value.forEach((item, index) => {
    const record = requireRecord(item, `${path}[${index}]`);
    requireString(record.id, `${path}[${index}].id`);
    requireNumber(record.quantidade, `${path}[${index}].quantidade`);
    requireDate(record.data, `${path}[${index}].data`);
    requireNumber(record.valorTotal, `${path}[${index}].valorTotal`);
    if (!isBoolean(record.concluido)) {
      throw new DataValidationError(`${path}[${index}].concluido`, 'esperado boolean');
    }
    if (!Array.isArray(record.pagamentos)) {
      throw new DataValidationError(`${path}[${index}].pagamentos`, 'esperado array');
    }
    record.pagamentos.forEach((payment, paymentIndex) => {
      const paymentRecord = requireRecord(payment, `${path}[${index}].pagamentos[${paymentIndex}]`);
      requireString(paymentRecord.id, `${path}[${index}].pagamentos[${paymentIndex}].id`);
      requireDate(paymentRecord.data, `${path}[${index}].pagamentos[${paymentIndex}].data`);
      requireNumber(paymentRecord.valor, `${path}[${index}].pagamentos[${paymentIndex}].valor`);
    });
  });
}

export function validateCustomClients(value: unknown, path = 'clientesCustom'): void {
  const map = requireRecord(value, path);
  Object.entries(map).forEach(([name, client]) => {
    requireString(name, `${path}.${name}`);
    const record = requireRecord(client, `${path}.${name}`);
    requireNumber(record.preco, `${path}.${name}.preco`);
    if (record.endereco !== undefined && !isString(record.endereco)) {
      throw new DataValidationError(`${path}.${name}.endereco`, 'esperada uma string');
    }
  });
}

export function validatePushToken(value: unknown, path = 'pushToken'): void {
  if (value !== null && value !== undefined && !isString(value)) {
    throw new DataValidationError(path, 'esperada uma string ou ausência');
  }
}
