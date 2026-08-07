import type { FactoryReceipt } from '@/types/data';
import { normalizeClientKey, normalizeLegacyDate } from '@/utils/data';

import type { UserDataSnapshot } from './UserDataSnapshot';

export type FirebaseDataValidationCode =
  | 'duplicate-id'
  | 'invalid-date'
  | 'invalid-number'
  | 'negative-quantity'
  | 'unrecognized-client'
  | 'payment-over-total'
  | 'historical-value-mismatch'
  | 'status-inconsistent';

export interface FirebaseDataValidationIssue {
  code: FirebaseDataValidationCode;
  message: string;
  path: string;
}

export interface FirebaseDataValidationOptions {
  recognizedClientNames?: readonly string[];
}

function issue(
  issues: FirebaseDataValidationIssue[],
  code: FirebaseDataValidationCode,
  path: string,
  message: string,
): void {
  issues.push({ code, message, path });
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateDate(issues: FirebaseDataValidationIssue[], value: unknown, path: string): void {
  if (!normalizeLegacyDate(value)) {
    issue(issues, 'invalid-date', path, 'Data ausente ou inválida.');
  }
}

function validateNumber(
  issues: FirebaseDataValidationIssue[],
  value: unknown,
  path: string,
  allowNegative = false,
): void {
  if (!isFiniteNumber(value)) {
    issue(issues, 'invalid-number', path, 'Valor numérico inválido.');
  } else if (!allowNegative && value < 0) {
    issue(issues, 'negative-quantity', path, 'Quantidade/valor negativo.');
  }
}

function validateUniqueId(
  issues: FirebaseDataValidationIssue[],
  ids: Set<string>,
  id: unknown,
  path: string,
): void {
  if (typeof id !== 'string' || id.trim() === '') {
    issue(issues, 'duplicate-id', path, 'ID ausente.');
    return;
  }
  if (ids.has(id)) issue(issues, 'duplicate-id', path, `ID duplicado: ${id}.`);
  ids.add(id);
}

function validateFactoryReceipt(
  issues: FirebaseDataValidationIssue[],
  receipt: FactoryReceipt,
  receiptIndex: number,
  receiptIds: Set<string>,
  paymentIds: Set<string>,
): void {
  const path = `recebimentoBaldes[${receiptIndex}]`;
  validateUniqueId(issues, receiptIds, receipt.id, `${path}.id`);
  validateDate(issues, receipt.data, `${path}.data`);
  validateNumber(issues, receipt.quantidade, `${path}.quantidade`);
  validateNumber(issues, receipt.valorTotal, `${path}.valorTotal`);

  const paid = receipt.pagamentos.reduce((total, payment, paymentIndex) => {
    const paymentPath = `${path}.pagamentos[${paymentIndex}]`;
    validateUniqueId(issues, paymentIds, payment.id, `${paymentPath}.id`);
    validateDate(issues, payment.data, `${paymentPath}.data`);
    validateNumber(issues, payment.valor, `${paymentPath}.valor`);
    return total + (isFiniteNumber(payment.valor) ? payment.valor : 0);
  }, 0);

  if (paid > receipt.valorTotal + 0.01) {
    issue(issues, 'payment-over-total', path, 'Pagamentos excedem o valor total da compra.');
  }
  if (receipt.concluido && paid + 0.01 < receipt.valorTotal) {
    issue(issues, 'status-inconsistent', path, 'Compra marcada como concluída com saldo aberto.');
  }
}

export class FirebaseDataValidationService {
  public validate(
    snapshot: UserDataSnapshot,
    options: FirebaseDataValidationOptions = {},
  ): FirebaseDataValidationIssue[] {
    const issues: FirebaseDataValidationIssue[] = [];
    const deliveryIds = new Set<string>();
    const receiptIds = new Set<string>();
    const paymentIds = new Set<string>();
    const recognizedClients = options.recognizedClientNames
      ? new Set(options.recognizedClientNames.map(normalizeClientKey))
      : null;

    snapshot.entregas.forEach((delivery, index) => {
      const path = `entregas[${index}]`;
      validateUniqueId(issues, deliveryIds, delivery.id, `${path}.id`);
      validateDate(issues, delivery.data, `${path}.data`);
      validateNumber(issues, delivery.quantidade, `${path}.quantidade`);
      validateNumber(issues, delivery.valor, `${path}.valor`);

      if (typeof delivery.cliente !== 'string' || delivery.cliente.trim() === '') {
        issue(issues, 'unrecognized-client', `${path}.cliente`, 'Cliente ausente.');
      } else if (
        recognizedClients &&
        !recognizedClients.has(normalizeClientKey(delivery.cliente))
      ) {
        issue(
          issues,
          'unrecognized-client',
          `${path}.cliente`,
          `Cliente não reconhecido: ${delivery.cliente}.`,
        );
      }

      if (delivery.precoUnitarioHistorico !== undefined) {
        validateNumber(issues, delivery.precoUnitarioHistorico, `${path}.precoUnitarioHistorico`);
        if (
          isFiniteNumber(delivery.precoUnitarioHistorico) &&
          isFiniteNumber(delivery.valor) &&
          isFiniteNumber(delivery.quantidade) &&
          delivery.quantidade > 0 &&
          Math.abs(delivery.quantidade * delivery.precoUnitarioHistorico - delivery.valor) > 0.02
        ) {
          issue(
            issues,
            'historical-value-mismatch',
            path,
            'Valor total e preço unitário histórico não correspondem.',
          );
        }
      }
    });

    snapshot.recebimentoBaldes.forEach((receipt, index) => {
      validateFactoryReceipt(issues, receipt, index, receiptIds, paymentIds);
    });

    Object.entries(snapshot.gastosDiarios).forEach(([date, expense]) => {
      validateDate(issues, date, `gastosDiarios.${date}`);
      validateDate(issues, expense.data, `gastosDiarios.${date}.data`);
      for (const [field, value] of Object.entries(expense)) {
        if (['data', 'legacyFields'].includes(field) || value === undefined) continue;
        if (typeof value === 'number')
          validateNumber(issues, value, `gastosDiarios.${date}.${field}`);
      }
    });

    Object.entries(snapshot.gastosMensais).forEach(([month, expense]) => {
      if (!/^\d{4}-\d{2}$/.test(month)) {
        issue(issues, 'invalid-date', `gastosMensais.${month}`, 'Período mensal inválido.');
      }
      if (typeof expense === 'number') validateNumber(issues, expense, `gastosMensais.${month}`);
      else if (expense.luz !== undefined) {
        validateNumber(issues, expense.luz, `gastosMensais.${month}.luz`);
      }
    });

    return issues;
  }
}

export const firebaseDataValidationService = new FirebaseDataValidationService();
