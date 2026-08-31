import { NativeBottomSheet } from '@/components/native';

import {
  DEFAULT_REGISTRAR_DELIVERY_BUCKET_PRICE,
  type RegistrarDeliverySheetController,
} from '../hooks/useRegistrarDeliverySheet';

export function RegistrarDeliverySheet({
  controller,
}: {
  controller: RegistrarDeliverySheetController;
}) {
  return (
    <NativeBottomSheet
      bucketPrice={DEFAULT_REGISTRAR_DELIVERY_BUCKET_PRICE}
      hostSizing="viewport"
      items={controller.clientItems}
      onConfirm={controller.handleConfirm}
      onPageSettled={controller.handlePageSettled}
      onSelect={controller.handleSelect}
      onVisibleChange={controller.handleVisibleChange}
      presentationBackgroundInteraction="enabled"
      presentationBackgroundMode="native"
      selectedItem={controller.selectedClient}
      subtitle="Escolha o cliente"
      title="Adicionar entrega"
      titleSystemImage="plus"
      visible={controller.sheetVisible}
    />
  );
}
