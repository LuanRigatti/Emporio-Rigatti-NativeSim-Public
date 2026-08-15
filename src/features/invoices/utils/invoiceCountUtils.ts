import type { ClientModel, Delivery } from '@/types/data';
import { normalizeClientKey } from '@/utils/data';

export function countOpenDocuments(
  deliveries: readonly Delivery[],
  clients: readonly ClientModel[],
): number {
  const invoiceClientNames = new Set(
    clients.filter((client) => client.usesInvoice).map((client) => client.normalizedName),
  );
  const boletoClientNames = new Set(
    clients.filter((client) => client.usesBoleto).map((client) => client.normalizedName),
  );

  let count = 0;
  for (const delivery of deliveries) {
    const clientKey = normalizeClientKey(delivery.cliente);

    const isInvoiceOpen =
      invoiceClientNames.has(clientKey) && (delivery.invoiceStatus ?? 'a_emitir') === 'a_emitir';

    const isBoletoOpen =
      boletoClientNames.has(clientKey) &&
      (delivery.boletoStatus ?? delivery.invoiceStatus ?? 'a_emitir') === 'a_emitir';

    if (isInvoiceOpen) count += 1;
    if (isBoletoOpen) count += 1;
  }
  return count;
}

export function formatOpenDocumentsLabel(count: number): string {
  if (count <= 0) return 'Documentos';
  if (count === 1) return '1 documento em aberto';
  return `${count} documentos em aberto`;
}
