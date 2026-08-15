import {
  countOpenDocuments,
  formatOpenDocumentsLabel,
} from '@/features/invoices/utils/invoiceCountUtils';
import type { BoletoStatus, ClientModel, Delivery, InvoiceStatus } from '@/types/data';

function mockClient(name: string, usesInvoice: boolean, usesBoleto: boolean): ClientModel {
  return {
    address: 'Rua Teste, 123',
    canonicalName: name,
    clientId: `client:${name.toLowerCase()}`,
    hasIncompleteAddress: false,
    normalizedName: name.toLowerCase().trim(),
    sources: ['custom'],
    usesBoleto,
    usesInvoice,
  };
}

function mockDelivery(
  id: string,
  cliente: string,
  invoiceStatus?: InvoiceStatus,
  boletoStatus?: BoletoStatus,
): Delivery {
  return {
    cliente,
    data: '2026-08-15',
    entregue: true,
    id,
    ...(invoiceStatus !== undefined ? { invoiceStatus } : {}),
    ...(boletoStatus !== undefined ? { boletoStatus } : {}),
    metodoPagamento: 'Pix',
    precoUnitarioHistorico: 10,
    quantidade: 2,
    status: 'Não Pago',
    valor: 20,
  };
}

describe('countOpenDocuments', () => {
  const clientInvoiceOnly = mockClient('Cliente Nota', true, false);
  const clientBoletoOnly = mockClient('Cliente Boleto', false, true);
  const clientBoth = mockClient('Cliente Ambos', true, true);
  const clientNeither = mockClient('Cliente Nenhum', false, false);
  const clients = [clientInvoiceOnly, clientBoletoOnly, clientBoth, clientNeither];

  it('1. returns 0 when there are no deliveries', () => {
    expect(countOpenDocuments([], clients)).toBe(0);
  });

  it('2. returns 0 when deliveries are for clients with neither invoice nor boleto', () => {
    const deliveries = [mockDelivery('d-1', 'Cliente Nenhum', 'a_emitir', 'a_emitir')];
    expect(countOpenDocuments(deliveries, clients)).toBe(0);
  });

  it('3. counts 1 document for client with only invoice open', () => {
    const deliveries = [mockDelivery('d-1', 'Cliente Nota', 'a_emitir')];
    expect(countOpenDocuments(deliveries, clients)).toBe(1);
    expect(formatOpenDocumentsLabel(countOpenDocuments(deliveries, clients))).toBe(
      '1 documento em aberto',
    );
  });

  it('4. counts 1 document for client with only boleto open', () => {
    const deliveries = [mockDelivery('d-1', 'Cliente Boleto', undefined, 'a_emitir')];
    expect(countOpenDocuments(deliveries, clients)).toBe(1);
    expect(formatOpenDocumentsLabel(countOpenDocuments(deliveries, clients))).toBe(
      '1 documento em aberto',
    );
  });

  it('5. counts 2 documents when client has both invoice and boleto open', () => {
    const deliveries = [mockDelivery('d-1', 'Cliente Ambos', 'a_emitir', 'a_emitir')];
    expect(countOpenDocuments(deliveries, clients)).toBe(2);
    expect(formatOpenDocumentsLabel(countOpenDocuments(deliveries, clients))).toBe(
      '2 documentos em aberto',
    );
  });

  it('6. counts 1 document when only boleto is emitted for client with both', () => {
    const deliveries = [mockDelivery('d-1', 'Cliente Ambos', 'a_emitir', 'emitido')];
    expect(countOpenDocuments(deliveries, clients)).toBe(1);
    expect(formatOpenDocumentsLabel(countOpenDocuments(deliveries, clients))).toBe(
      '1 documento em aberto',
    );
  });

  it('7. counts 1 document when only invoice is emitted for client with both', () => {
    const deliveries = [mockDelivery('d-1', 'Cliente Ambos', 'emitido', 'a_emitir')];
    expect(countOpenDocuments(deliveries, clients)).toBe(1);
    expect(formatOpenDocumentsLabel(countOpenDocuments(deliveries, clients))).toBe(
      '1 documento em aberto',
    );
  });

  it('8. counts 0 documents when both invoice and boleto are emitted', () => {
    const deliveries = [mockDelivery('d-1', 'Cliente Ambos', 'emitido', 'emitido')];
    expect(countOpenDocuments(deliveries, clients)).toBe(0);
    expect(formatOpenDocumentsLabel(countOpenDocuments(deliveries, clients))).toBe('Documentos');
  });

  it('9. legacy delivery without boletoStatus and invoiceStatus = a_emitir counts both as open', () => {
    const deliveries = [mockDelivery('d-1', 'Cliente Ambos', 'a_emitir', undefined)];
    expect(countOpenDocuments(deliveries, clients)).toBe(2);
  });

  it('10. legacy delivery without boletoStatus and invoiceStatus = emitido treats both as emitted', () => {
    const deliveries = [mockDelivery('d-1', 'Cliente Ambos', 'emitido', undefined)];
    expect(countOpenDocuments(deliveries, clients)).toBe(0);
    expect(formatOpenDocumentsLabel(countOpenDocuments(deliveries, clients))).toBe('Documentos');
  });

  it('11. simulates emitting boleto first, then invoice later', () => {
    const initial = [mockDelivery('d-1', 'Cliente Ambos', 'a_emitir', 'a_emitir')];
    expect(countOpenDocuments(initial, clients)).toBe(2);
    expect(formatOpenDocumentsLabel(countOpenDocuments(initial, clients))).toBe(
      '2 documentos em aberto',
    );

    const afterBoletoEmitted = [mockDelivery('d-1', 'Cliente Ambos', 'a_emitir', 'emitido')];
    expect(countOpenDocuments(afterBoletoEmitted, clients)).toBe(1);
    expect(formatOpenDocumentsLabel(countOpenDocuments(afterBoletoEmitted, clients))).toBe(
      '1 documento em aberto',
    );

    const afterBothEmitted = [mockDelivery('d-1', 'Cliente Ambos', 'emitido', 'emitido')];
    expect(countOpenDocuments(afterBothEmitted, clients)).toBe(0);
    expect(formatOpenDocumentsLabel(countOpenDocuments(afterBothEmitted, clients))).toBe(
      'Documentos',
    );
  });
});

describe('formatOpenDocumentsLabel', () => {
  it('formats zero documents as "Documentos"', () => {
    expect(formatOpenDocumentsLabel(0)).toBe('Documentos');
    expect(formatOpenDocumentsLabel(-1)).toBe('Documentos');
  });

  it('formats 1 document in singular as "1 documento em aberto"', () => {
    expect(formatOpenDocumentsLabel(1)).toBe('1 documento em aberto');
  });

  it('formats 2 or more documents in plural as "X documentos em aberto"', () => {
    expect(formatOpenDocumentsLabel(2)).toBe('2 documentos em aberto');
    expect(formatOpenDocumentsLabel(5)).toBe('5 documentos em aberto');
    expect(formatOpenDocumentsLabel(10)).toBe('10 documentos em aberto');
  });
});
