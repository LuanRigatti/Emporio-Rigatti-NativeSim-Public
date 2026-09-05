import { NativeBottomSheet } from '@/components/native';
import { registrarDeliveryDarkLiquidGlassTint, useAppTheme } from '@/theme';

import {
  DEFAULT_REGISTRAR_DELIVERY_BUCKET_PRICE,
  type RegistrarDeliverySheetController,
} from '../hooks/useRegistrarDeliverySheet';

export function RegistrarDeliverySheet({
  controller,
  initialPage = 0,
}: {
  controller: RegistrarDeliverySheetController;
  initialPage?: 0 | 1;
}) {
  const { resolvedMode } = useAppTheme();
  const useDarkGlassSurface = resolvedMode === 'dark';

  return (
    <NativeBottomSheet
      bucketPrice={DEFAULT_REGISTRAR_DELIVERY_BUCKET_PRICE}
      hostSizing="viewport"
      items={controller.clientItems}
      onConfirm={controller.handleConfirm}
      onDismiss={controller.handleDismiss}
      onPageSettled={controller.handlePageSettled}
      onSelect={controller.handleSelect}
      onVisibleChange={controller.handleVisibleChange}
      glassSurface={useDarkGlassSurface}
      glassTint={useDarkGlassSurface ? registrarDeliveryDarkLiquidGlassTint : undefined}
      initialPage={initialPage}
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
