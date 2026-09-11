import { useCallback, useMemo, useRef, useState } from 'react';

import type { NativeBottomSheetConfirmation, NativeBottomSheetItem } from '@/components/native';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { todayIso } from '@/utils/data';
import type { ClientModel, Delivery, DeliveryDraft } from '@/types/data';

export const DEFAULT_REGISTRAR_DELIVERY_BUCKET_PRICE = 49.8;

type CreateDelivery = (draft: DeliveryDraft) => Promise<Delivery>;

export type RegistrarDeliverySheetPhase = 'closed' | 'presented' | 'dismissing';

type UseRegistrarDeliverySheetOptions = {
  clients: readonly ClientModel[];
  create: CreateDelivery;
  onDismiss?: () => void;
};

export type RegistrarDeliverySheetController = {
  clientItems: NativeBottomSheetItem[];
  dismissSheet: () => void;
  getSheetPhase: () => RegistrarDeliverySheetPhase;
  handleConfirm: (confirmation: NativeBottomSheetConfirmation) => void;
  handleDismiss: () => void;
  handlePageSettled: (page: number) => void;
  handleSelect: (item: NativeBottomSheetItem) => void;
  handleVisibleChange: (visible: boolean) => void;
  openSheet: () => void;
  recentlyAddedDeliveryIds: readonly string[];
  selectedClient: NativeBottomSheetItem | null;
  sheetDismissing: boolean;
  sheetVisible: boolean;
};

export function useRegistrarDeliverySheet({
  clients,
  create,
  onDismiss,
}: UseRegistrarDeliverySheetOptions): RegistrarDeliverySheetController {
  const { enabled: testModeEnabled } = useTestModePresentation();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetDismissing, setSheetDismissing] = useState(false);
  const [selectedClient, setSelectedClient] = useState<NativeBottomSheetItem | null>(null);
  const [recentlyAddedDeliveryIds, setRecentlyAddedDeliveryIds] = useState<readonly string[]>([]);
  const sheetPhaseRef = useRef<RegistrarDeliverySheetPhase>('closed');

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
    if (sheetPhaseRef.current === 'dismissing') return;

    triggerLightImpactHaptic();
    setSelectedClient(null);
    sheetPhaseRef.current = 'presented';
    setSheetDismissing(false);
    setSheetVisible(true);
  }, []);

  const dismissSheet = useCallback(() => {
    if (sheetPhaseRef.current !== 'presented') return;

    sheetPhaseRef.current = 'dismissing';
    setSheetDismissing(true);
    setSheetVisible(false);
  }, []);

  const getSheetPhase = useCallback(() => sheetPhaseRef.current, []);

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

      dismissSheet();
    },
    [clients, create, dismissSheet, testModeEnabled],
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
    if (visible) {
      if (sheetPhaseRef.current === 'dismissing') return;

      sheetPhaseRef.current = 'presented';
      setSheetDismissing(false);
      setSheetVisible(true);
      return;
    }

    if (sheetPhaseRef.current === 'closed') return;

    sheetPhaseRef.current = 'dismissing';
    setSheetDismissing(true);
    setSheetVisible(false);
    setSelectedClient(null);
  }, []);

  const handleDismiss = useCallback(() => {
    if (sheetPhaseRef.current === 'closed') return;

    sheetPhaseRef.current = 'closed';
    onDismiss?.();
    setSheetDismissing(false);
    setSheetVisible(false);
    setSelectedClient(null);
  }, [onDismiss]);

  const handlePageSettled = useCallback((page: number) => {
    if (page === 0) setSelectedClient(null);
  }, []);

  return {
    clientItems,
    dismissSheet,
    getSheetPhase,
    handleConfirm,
    handleDismiss,
    handlePageSettled,
    handleSelect,
    handleVisibleChange,
    openSheet,
    recentlyAddedDeliveryIds,
    selectedClient,
    sheetDismissing,
    sheetVisible,
  };
}
