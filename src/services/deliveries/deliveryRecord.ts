import type { Delivery, DeliveryDraft } from '@/types/data';
import { formatClientName } from '@/utils/data';

function createDeliveryId(): string {
  return `delivery-${Date.now().toString(36)}-${Math.floor(Math.random() * 1_000_000).toString(36)}`;
}

export function validateDeliveryDraft(draft: DeliveryDraft): void {
  if (!draft.clientName.trim()) throw new Error('Selecione um cliente.');
  if (!draft.address.trim() || !draft.addressConfirmed) {
    throw new Error('Confirme o endereço antes de salvar a entrega.');
  }
  if (!Number.isFinite(draft.quantity) || draft.quantity < 1) {
    throw new Error('A quantidade deve ser maior ou igual a 1.');
  }
  if (!draft.date) throw new Error('Informe a data da entrega.');
  if (!Number.isFinite(draft.value) || draft.value < 0) {
    throw new Error('Informe um valor válido para a entrega.');
  }
  if (draft.status === 'Pago' && !draft.paymentMethod) {
    throw new Error('Escolha Dinheiro ou Pix para quitar a entrega.');
  }
}

export function createDeliveryFromDraft(draft: DeliveryDraft, previous?: Delivery): Delivery {
  validateDeliveryDraft(draft);
  const historicalUnitPrice = previous
    ? previous.precoUnitarioHistorico
    : draft.historicalUnitPrice !== undefined
      ? Number(draft.historicalUnitPrice.toFixed(2))
      : draft.quantity > 0
        ? Number((draft.value / draft.quantity).toFixed(2))
        : undefined;
  const known: Delivery = {
    ...(previous ?? {}),
    ...(draft.clientId ? { clientId: draft.clientId } : {}),
    id: previous?.id ?? draft.id ?? createDeliveryId(),
    cliente: formatClientName(draft.clientName),
    quantidade: Number(draft.quantity),
    valor: Number(draft.value.toFixed(2)),
    precoUnitarioHistorico: historicalUnitPrice,
    status: draft.status,
    entregue: draft.delivered,
    data: draft.date,
    invoiceStatus: draft.invoiceStatus,
    endereco: draft.address.trim(),
  };
  if (draft.paymentMethod) known.metodoPagamento = draft.paymentMethod;
  else if (draft.status !== 'Pago') delete known.metodoPagamento;
  return known;
}
