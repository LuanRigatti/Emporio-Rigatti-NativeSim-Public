import type { NativeBottomSheetConfirmation, NativeBottomSheetItem } from '@/components/native';
import type { ClientModel, Delivery, DeliveryDraft } from '@/types/data';
import { todayIso } from '@/utils/data';

export type CreateRegistrarDelivery = (draft: DeliveryDraft) => Promise<Delivery>;

let pendingRecentlyAddedDeliveryIds: string[] = [];

export function queueRecentlyAddedRegistrarDelivery(deliveryId: string): void {
  pendingRecentlyAddedDeliveryIds = [
    deliveryId,
    ...pendingRecentlyAddedDeliveryIds.filter((pendingId) => pendingId !== deliveryId),
  ];
}

export function consumeRecentlyAddedRegistrarDeliveryIds(): string[] {
  const deliveryIds = pendingRecentlyAddedDeliveryIds;
  pendingRecentlyAddedDeliveryIds = [];
  return deliveryIds;
}

export function toRegistrarDeliverySheetItem(client: ClientModel): NativeBottomSheetItem {
  return {
    bucketPrice: client.currentPrice,
    id: client.clientId,
    title: client.canonicalName,
    systemImage: 'person.crop.circle.fill',
  };
}

export function calculateRegistrarDeliveryTotal(bucketPrice: number, quantity: number): number {
  return bucketPrice * quantity;
}

export async function createRegistrarDeliveryFromConfirmation({
  clients,
  confirmation,
  create,
  testModeEnabled,
}: {
  clients: readonly ClientModel[];
  confirmation: NativeBottomSheetConfirmation;
  create: CreateRegistrarDelivery;
  testModeEnabled: boolean;
}): Promise<Delivery | undefined> {
  if (testModeEnabled) return undefined;

  const currentClient = clients.find((client) => client.clientId === confirmation.client.id);
  if (!currentClient?.clientId || !currentClient.address) return undefined;

  const bucketPrice = currentClient.currentPrice ?? confirmation.bucketPrice;

  return create({
    address: currentClient.address,
    addressConfirmed: true,
    clientId: currentClient.clientId,
    clientName: confirmation.client.title,
    date: todayIso(confirmation.date),
    delivered: false,
    invoiceStatus: 'a_emitir',
    quantity: confirmation.quantity,
    status: 'Não Pago',
    value: calculateRegistrarDeliveryTotal(bucketPrice, confirmation.quantity),
    valueWasManuallyChanged: false,
    historicalUnitPrice: bucketPrice,
  });
}
