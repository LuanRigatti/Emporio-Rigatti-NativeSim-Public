import { useCallback, useMemo, useState } from 'react';

import type { NativeBottomSheetConfirmation, NativeBottomSheetItem } from '@/components/native';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { todayIso } from '@/utils/data';
import type { ClientModel, Delivery, DeliveryDraft } from '@/types/data';

export const DEFAULT_REGISTRAR_DELIVERY_BUCKET_PRICE = 49.8;

type CreateDelivery = (draft: DeliveryDraft) => Promise<Delivery>;

type UseRegistrarDeliverySheetOptions = {
  clients: readonly ClientModel[];
  create: CreateDelivery;
};

export type RegistrarDeliverySheetController = {
  clientItems: NativeBottomSheetItem[];
  handleConfirm: (confirmation: NativeBottomSheetConfirmation) => void;
  handlePageSettled: (page: number) => void;
  handleSelect: (item: NativeBottomSheetItem) => void;
  handleVisibleChange: (visible: boolean) => void;
  openSheet: () => void;
  recentlyAddedDeliveryIds: readonly string[];
  selectedClient: NativeBottomSheetItem | null;
  sheetVisible: boolean;
};

export function useRegistrarDeliverySheet({
  clients,
  create,
}: UseRegistrarDeliverySheetOptions): RegistrarDeliverySheetController {
  const { enabled: testModeEnabled } = useTestModePresentation();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [selectedClient, setSelectedClient] = useState<NativeBottomSheetItem | null>(null);
  const [recentlyAddedDeliveryIds, setRecentlyAddedDeliveryIds] = useState<readonly string[]>([]);

  const clientItems = useMemo<NativeBottomSheetItem[]>(
    () =>
      clients.map((client) => ({
        bucketPrice: client.currentPrice,
        id: client.clientId,
        title: client.canonicalName,
        systemImage: 'person.crop.circle.fill',
      })),
    [clients],
  );

  const openSheet = useCallback(() => {
    triggerLightImpactHaptic();
    setSelectedClient(null);
    setSheetVisible(true);
  }, []);

  const handleConfirm = useCallback(
    (confirmation: NativeBottomSheetConfirmation) => {
      if (testModeEnabled) return;
      const currentClient = clients.find((client) => client.clientId === confirmation.client.id);
      if (!currentClient?.clientId || !currentClient.address) return;
      const bucketPrice = currentClient.currentPrice ?? confirmation.bucketPrice;

      void create({
        address: currentClient.address,
        addressConfirmed: true,
        clientId: currentClient.clientId,
        clientName: confirmation.client.title,
        date: todayIso(confirmation.date),
        delivered: false,
        invoiceStatus: 'a_emitir',
        quantity: confirmation.quantity,
        status: 'Não Pago',
        value: bucketPrice * confirmation.quantity,
        valueWasManuallyChanged: false,
        historicalUnitPrice: bucketPrice,
      })
        .then((created) => {
          setRecentlyAddedDeliveryIds((current) => [
            created.id,
            ...current.filter((deliveryId) => deliveryId !== created.id),
          ]);
        })
        .catch(() => undefined);

      setSheetVisible(false);
    },
    [clients, create, testModeEnabled],
  );

  const handleSelect = useCallback(
    (item: NativeBottomSheetItem) => {
      const currentClient = clients.find((client) => client.clientId === item.id);
      setSelectedClient({
        ...item,
        bucketPrice: currentClient?.currentPrice ?? item.bucketPrice,
      });
    },
    [clients],
  );

  const handleVisibleChange = useCallback((visible: boolean) => {
    setSheetVisible(visible);
    if (!visible) setSelectedClient(null);
  }, []);

  const handlePageSettled = useCallback((page: number) => {
    if (page === 0) setSelectedClient(null);
  }, []);

  return {
    clientItems,
    handleConfirm,
    handlePageSettled,
    handleSelect,
    handleVisibleChange,
    openSheet,
    recentlyAddedDeliveryIds,
    selectedClient,
    sheetVisible,
  };
}
