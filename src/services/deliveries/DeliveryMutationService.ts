import type {
  Delivery,
  DeliveryBulkPatch,
  DeliveryDraft,
  InvoiceStatus,
  PaymentMethod,
} from '@/types/data';
import type { UserDataSnapshot } from '@/services/data';
import { asyncStorageCacheService } from '@/services/cache';
import { userDataService } from '@/services/data';
import { formatClientName } from '@/utils/data';
import { DeliveryRepository } from '@/repositories/DeliveryRepository';

import { deliveryNormalizationService } from './DeliveryNormalizationService';

function createDeliveryId(): string {
  return `delivery-${Date.now().toString(36)}-${Math.floor(Math.random() * 1_000_000).toString(36)}`;
}

function validateDraft(draft: DeliveryDraft): void {
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

function draftToDelivery(draft: DeliveryDraft, previous?: Delivery): Delivery {
  validateDraft(draft);
  const known: Delivery = {
    ...(previous ?? {}),
    id: previous?.id ?? draft.id ?? createDeliveryId(),
    cliente: formatClientName(draft.clientName),
    quantidade: Number(draft.quantity),
    valor: Number(draft.value.toFixed(2)),
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

export class DeliveryMutationService {
  public constructor(
    private readonly uid: string,
    private readonly readSnapshot: () => Promise<UserDataSnapshot> = () =>
      userDataService.readFromFirebase(uid),
  ) {}

  private async replace(
    snapshot: UserDataSnapshot,
    deliveries: Delivery[],
  ): Promise<UserDataSnapshot> {
    await new DeliveryRepository(this.uid).replace(deliveries);
    const nextSnapshot = { ...snapshot, entregas: deliveries };
    await asyncStorageCacheService.write(this.uid, nextSnapshot);
    return nextSnapshot;
  }

  public async create(draft: DeliveryDraft): Promise<Delivery> {
    const snapshot = await this.readSnapshot();
    const delivery = draftToDelivery(draft);
    await this.replace(snapshot, [...snapshot.entregas, delivery]);
    return delivery;
  }

  public async update(deliveryId: string, draft: DeliveryDraft): Promise<Delivery> {
    const snapshot = await this.readSnapshot();
    const previous = snapshot.entregas.find((delivery) => delivery.id === deliveryId);
    if (!previous) throw new Error('Entrega não encontrada.');
    const delivery = draftToDelivery(draft, previous);
    await this.replace(
      snapshot,
      snapshot.entregas.map((item) => (item.id === deliveryId ? delivery : item)),
    );
    return delivery;
  }

  public async remove(deliveryId: string): Promise<void> {
    const snapshot = await this.readSnapshot();
    if (!snapshot.entregas.some((delivery) => delivery.id === deliveryId)) {
      throw new Error('Entrega não encontrada.');
    }
    await this.replace(
      snapshot,
      snapshot.entregas.filter((delivery) => delivery.id !== deliveryId),
    );
  }

  public async toggleDelivered(deliveryId: string): Promise<void> {
    const snapshot = await this.readSnapshot();
    const deliveries = snapshot.entregas.map((delivery) =>
      delivery.id === deliveryId ? { ...delivery, entregue: !delivery.entregue } : delivery,
    );
    await this.replace(snapshot, deliveries);
  }

  public async setDelivered(deliveryId: string, delivered: boolean): Promise<void> {
    const snapshot = await this.readSnapshot();
    const previous = snapshot.entregas.find((delivery) => delivery.id === deliveryId);
    if (!previous) throw new Error('Entrega não encontrada.');
    if (previous.entregue === delivered) return;
    await this.replace(
      snapshot,
      snapshot.entregas.map((delivery) =>
        delivery.id === deliveryId ? { ...delivery, entregue: delivered } : delivery,
      ),
    );
  }

  public async updateInvoiceStatus(
    deliveryId: string,
    invoiceStatus: InvoiceStatus,
  ): Promise<void> {
    const snapshot = await this.readSnapshot();
    const deliveries = snapshot.entregas.map((delivery) =>
      delivery.id === deliveryId ? { ...delivery, invoiceStatus } : delivery,
    );
    await this.replace(snapshot, deliveries);
  }

  public async settle(deliveryIds: readonly string[], method: PaymentMethod): Promise<void> {
    if (deliveryIds.length === 0) {
      throw new Error('Selecione ao menos uma entrega para quitar.');
    }
    if (!method || !['Dinheiro', 'Pix'].includes(method)) {
      throw new Error('Escolha Dinheiro ou Pix para quitar as entregas.');
    }
    const snapshot = await this.readSnapshot();
    const selected = new Set(deliveryIds);
    const eligible = snapshot.entregas.filter(
      (delivery) => selected.has(delivery.id) && delivery.status !== 'Pago' && delivery.entregue,
    );
    if (eligible.length !== selected.size) {
      throw new Error('Somente entregas não pagas e entregues podem ser quitadas.');
    }
    await this.replace(
      snapshot,
      snapshot.entregas.map((delivery) =>
        selected.has(delivery.id)
          ? { ...delivery, status: 'Pago', metodoPagamento: method }
          : delivery,
      ),
    );
  }

  public async editMany(deliveryIds: readonly string[], patch: DeliveryBulkPatch): Promise<void> {
    const snapshot = await this.readSnapshot();
    const selected = new Set(deliveryIds);
    const deliveries = snapshot.entregas.map((delivery) =>
      selected.has(delivery.id) ? { ...delivery, ...patch } : delivery,
    );
    await this.replace(snapshot, deliveries);
  }

  public async normalizePastDeliveries(today: string): Promise<void> {
    const snapshot = await this.readSnapshot();
    const result = deliveryNormalizationService.normalize(snapshot.entregas, today);
    if (result.changed) await this.replace(snapshot, result.deliveries);
  }
}
