import { useCallback, useMemo, useRef, useState } from 'react';

import type { NativeBottomSheetConfirmation, NativeBottomSheetItem } from '@/components/native';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import type { ClientModel } from '@/types/data';

import {
  createRegistrarDeliveryFromConfirmation,
  toRegistrarDeliverySheetItem,
  type CreateRegistrarDelivery,
} from '../utils/registrarDelivery';

export const DEFAULT_REGISTRAR_DELIVERY_BUCKET_PRICE = 49.8;

export type RegistrarDeliverySheetPhase = 'closed' | 'presented' | 'dismissing';

type UseRegistrarDeliverySheetOptions = {
  clients: readonly ClientModel[];
  create: CreateRegistrarDelivery;
  onDismiss?: () => void;
  preserveSelectedClientOnDismiss?: boolean;
};

export type RegistrarDeliverySheetController = {
  clientItems: NativeBottomSheetItem[];
  markRecentlyAddedDeliveryIds: (deliveryIds: readonly string[]) => void;
  dismissSheet: () => void;
  getSheetPhase: () => RegistrarDeliverySheetPhase;
  handleConfirm: (confirmation: NativeBottomSheetConfirmation) => void;
  handleDismiss: () => void;
  handlePageSettled: (page: number) => void;
  handleSelect: (item: NativeBottomSheetItem) => void;
  handleVisibleChange: (visible: boolean) => void;
  openSheet: () => void;
  openSelectedClientSheet: () => void;
  recentlyAddedDeliveryIds: readonly string[];
  selectedClient: NativeBottomSheetItem | null;
  sheetDismissing: boolean;
  sheetVisible: boolean;
};

export function useRegistrarDeliverySheet({
  clients,
  create,
  onDismiss,
  preserveSelectedClientOnDismiss = false,
}: UseRegistrarDeliverySheetOptions): RegistrarDeliverySheetController {
  const { enabled: testModeEnabled } = useTestModePresentation();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetDismissing, setSheetDismissing] = useState(false);
  const [selectedClient, setSelectedClient] = useState<NativeBottomSheetItem | null>(null);
  const [recentlyAddedDeliveryIds, setRecentlyAddedDeliveryIds] = useState<readonly string[]>([]);
  const sheetPhaseRef = useRef<RegistrarDeliverySheetPhase>('closed');

  const clientItems = useMemo<NativeBottomSheetItem[]>(
    () => clients.map(toRegistrarDeliverySheetItem),
    [clients],
  );

  const markRecentlyAddedDeliveryIds = useCallback((deliveryIds: readonly string[]) => {
    if (deliveryIds.length === 0) return;
    setRecentlyAddedDeliveryIds((current) => [
      ...deliveryIds,
      ...current.filter((deliveryId) => !deliveryIds.includes(deliveryId)),
    ]);
  }, []);

  const presentSheet = useCallback((clearSelection: boolean) => {
    if (sheetPhaseRef.current === 'dismissing') return;

    if (clearSelection) {
      triggerLightImpactHaptic();
      setSelectedClient(null);
    }
    sheetPhaseRef.current = 'presented';
    setSheetDismissing(false);
    setSheetVisible(true);
  }, []);

  const openSheet = useCallback(() => presentSheet(true), [presentSheet]);

  const openSelectedClientSheet = useCallback(() => {
    if (!selectedClient || !clients.some((client) => client.clientId === selectedClient.id)) return;

    presentSheet(false);
  }, [clients, presentSheet, selectedClient]);

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
      void createRegistrarDeliveryFromConfirmation({
        clients,
        confirmation,
        create,
        testModeEnabled,
      })
        .then((created) => {
          if (!created) return;
          markRecentlyAddedDeliveryIds([created.id]);
        })
        .catch(() => undefined);

      dismissSheet();
    },
    [clients, create, dismissSheet, markRecentlyAddedDeliveryIds, testModeEnabled],
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

  const handleVisibleChange = useCallback(
    (visible: boolean) => {
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
      if (!preserveSelectedClientOnDismiss) setSelectedClient(null);
    },
    [preserveSelectedClientOnDismiss],
  );

  const handleDismiss = useCallback(() => {
    if (sheetPhaseRef.current === 'closed') return;

    sheetPhaseRef.current = 'closed';
    onDismiss?.();
    setSheetDismissing(false);
    setSheetVisible(false);
    if (!preserveSelectedClientOnDismiss) setSelectedClient(null);
  }, [onDismiss, preserveSelectedClientOnDismiss]);

  const handlePageSettled = useCallback(
    (page: number) => {
      if (page === 0 && !preserveSelectedClientOnDismiss) setSelectedClient(null);
    },
    [preserveSelectedClientOnDismiss],
  );

  return {
    clientItems,
    dismissSheet,
    getSheetPhase,
    handleConfirm,
    handleDismiss,
    handlePageSettled,
    handleSelect,
    handleVisibleChange,
    markRecentlyAddedDeliveryIds,
    openSheet,
    openSelectedClientSheet,
    recentlyAddedDeliveryIds,
    selectedClient,
    sheetDismissing,
    sheetVisible,
  };
}
