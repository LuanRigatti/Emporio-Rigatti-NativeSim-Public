import type {
  CustomClient,
  DailyExpense,
  DailyExpenses,
  Delivery,
  FactoryPayment,
  FactoryReceipt,
  MonthlyExpense,
  MonthlyExpenses,
  UnknownRecord,
} from '@/types/data';
import {
  collectDeliveryLegacyFields,
  collectLegacyFields,
  formatClientName,
  normalizeMoney,
} from '@/utils/data';
import { isRecord, readNumber } from '@/utils/data/guards';
import {
  validateCustomClients,
  validateDailyExpenses,
  validateDeliveryArray,
  validateDeliveryRecord,
  validateFactoryReceipts,
  validateMonthlyExpenses,
} from '@/utils/data/validators';

function compactRecord(record: UnknownRecord): UnknownRecord {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

function requireRecord(value: unknown): UnknownRecord {
  if (!isRecord(value)) throw new Error('Registro Firebase inválido.');
  return value;
}

function requiredString(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('Campo textual obrigatório ausente.');
  }
  return value;
}

function requiredNumber(value: unknown): number {
  const number = normalizeMoney(value);
  if (number === undefined) throw new Error('Campo numérico obrigatório inválido.');
  return number;
}

function optionalPaymentMethod(value: unknown): 'Dinheiro' | 'Pix' | undefined {
  if (value === 'Dinheiro' || value === 'Pix') return value;
  return undefined;
}

function optionalInvoiceStatus(value: unknown): 'emitido' | 'a_emitir' | undefined {
  if (value === 'emitido' || value === 'a_emitir') return value;
  return undefined;
}

export function mapDelivery(value: unknown, path = 'entregas[0]'): Delivery {
  validateDeliveryRecord(value, path);
  const record = requireRecord(value);

  return {
    id: requiredString(record.id),
    cliente: formatClientName(requiredString(record.cliente)),
    quantidade: requiredNumber(record.quantidade),
    valor: requiredNumber(record.valor),
    status: requiredString(record.status),
    entregue: record.entregue as boolean,
    data: requiredString(record.data),
    invoiceStatus: optionalInvoiceStatus(record.invoiceStatus),
    endereco: typeof record.endereco === 'string' ? record.endereco : undefined,
    metodoPagamento: optionalPaymentMethod(record.metodoPagamento),
    observacao: typeof record.observacao === 'string' ? record.observacao : undefined,
    legacyFields: collectDeliveryLegacyFields(record),
  };
}

export function mapDeliveries(value: unknown): Delivery[] {
  validateDeliveryArray(value);
  return (value as unknown[]).map((item, index) => mapDelivery(item, `entregas[${index}]`));
}

export function toFirebaseDelivery(delivery: Delivery): UnknownRecord {
  const { legacyFields = {}, ...knownFields } = delivery;
  return compactRecord({ ...legacyFields, ...knownFields });
}

export function toFirebaseDeliveries(deliveries: Delivery[]): UnknownRecord[] {
  return deliveries.map(toFirebaseDelivery);
}

export function mapDailyExpense(value: unknown, date: string): DailyExpense {
  const record = requireRecord(value);
  return {
    data: date,
    estar: readNumber(record.estar),
    gasolina: readNumber(record.gasolina),
    km: readNumber(record.km),
    precoGasolina: readNumber(record.precoGasolina),
    tipoCombustivel:
      typeof record.tipoCombustivel === 'string' ? record.tipoCombustivel : undefined,
    legacyFields: collectLegacyFields(
      record,
      new Set(['estar', 'gasolina', 'km', 'precoGasolina', 'tipoCombustivel']),
    ),
  };
}

export function mapDailyExpenses(value: unknown): DailyExpenses {
  validateDailyExpenses(value);
  const record = requireRecord(value);
  return Object.fromEntries(
    Object.entries(record).map(([date, expense]) => [date, mapDailyExpense(expense, date)]),
  );
}

export function toFirebaseDailyExpenses(expenses: DailyExpenses): UnknownRecord {
  return Object.fromEntries(
    Object.entries(expenses).map(([date, expense]) => {
      const { legacyFields = {}, data: _data, ...knownFields } = expense;
      return [date, compactRecord({ ...legacyFields, ...knownFields })];
    }),
  );
}

export function mapMonthlyExpense(value: unknown): MonthlyExpense {
  const numeric = readNumber(value);
  if (numeric !== undefined) return numeric;

  const record = requireRecord(value);
  return {
    luz: readNumber(record.luz) ?? 0,
    legacyFields: collectLegacyFields(record, new Set(['luz'])),
  };
}

export function mapMonthlyExpenses(value: unknown): MonthlyExpenses {
  validateMonthlyExpenses(value);
  const record = requireRecord(value);
  return Object.fromEntries(
    Object.entries(record).map(([month, expense]) => [month, mapMonthlyExpense(expense)]),
  );
}

export function toFirebaseMonthlyExpenses(expenses: MonthlyExpenses): UnknownRecord {
  return Object.fromEntries(
    Object.entries(expenses).map(([month, expense]) => {
      if (typeof expense === 'number') return [month, expense];
      const { legacyFields = {}, ...knownFields } = expense;
      return [month, compactRecord({ ...legacyFields, ...knownFields })];
    }),
  );
}

function mapFactoryPayment(value: unknown, path: string): FactoryPayment {
  const record = requireRecord(value);
  return {
    id: requiredString(record.id),
    data: requiredString(record.data),
    valor: requiredNumber(record.valor),
    legacyFields: collectLegacyFields(record, new Set(['id', 'data', 'valor'])),
  };
}

export function mapFactoryReceipt(value: unknown, path = 'recebimentoBaldes[0]'): FactoryReceipt {
  validateFactoryReceipts([value], path);
  const record = requireRecord(value);
  const payments = Array.isArray(record.pagamentos)
    ? record.pagamentos.map((payment, index) =>
        mapFactoryPayment(payment, `${path}.pagamentos[${index}]`),
      )
    : [];

  return {
    id: requiredString(record.id),
    quantidade: requiredNumber(record.quantidade),
    data: requiredString(record.data),
    valorTotal: requiredNumber(record.valorTotal),
    concluido: record.concluido as boolean,
    pagamentos: payments,
    legacyFields: collectLegacyFields(
      record,
      new Set(['id', 'quantidade', 'data', 'valorTotal', 'concluido', 'pagamentos']),
    ),
  };
}

export function mapFactoryReceipts(value: unknown): FactoryReceipt[] {
  validateFactoryReceipts(value);
  return (value as unknown[]).map((item, index) =>
    mapFactoryReceipt(item, `recebimentoBaldes[${index}]`),
  );
}

export function toFirebaseFactoryReceipt(receipt: FactoryReceipt): UnknownRecord {
  const payments = receipt.pagamentos.map((payment) => {
    const { legacyFields = {}, ...knownFields } = payment;
    return compactRecord({ ...legacyFields, ...knownFields });
  });
  const { legacyFields = {}, pagamentos: _payments, ...knownFields } = receipt;
  return compactRecord({ ...legacyFields, ...knownFields, pagamentos: payments });
}

export function toFirebaseFactoryReceipts(receipts: FactoryReceipt[]): UnknownRecord[] {
  return receipts.map(toFirebaseFactoryReceipt);
}

export function mapCustomClient(value: unknown, name: string): CustomClient {
  const record = requireRecord(value);
  return {
    nome: name,
    preco: requiredNumber(record.preco),
    endereco: typeof record.endereco === 'string' ? record.endereco : undefined,
    legacyFields: collectLegacyFields(record, new Set(['preco', 'endereco'])),
  };
}

export function mapCustomClients(value: unknown): Record<string, CustomClient> {
  validateCustomClients(value);
  const record = requireRecord(value);
  return Object.fromEntries(
    Object.entries(record).map(([name, client]) => [name, mapCustomClient(client, name)]),
  );
}

export function toFirebaseCustomClients(clients: Record<string, CustomClient>): UnknownRecord {
  return Object.fromEntries(
    Object.entries(clients).map(([name, client]) => {
      const { nome: _name, legacyFields = {}, ...knownFields } = client;
      return [name, compactRecord({ ...legacyFields, ...knownFields })];
    }),
  );
}
