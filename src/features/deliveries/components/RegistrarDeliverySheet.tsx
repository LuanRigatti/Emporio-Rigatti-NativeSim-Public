import { NativeBottomSheet } from '@/components/native';
import { useAppTheme } from '@/theme';
import {
  APPROVED_DARK_SHEET_GLASS_TINT,
  APPROVED_LIGHT_SHEET_GLASS_TINT,
} from '@/theme/sheetGlassTints';

import {
  DEFAULT_REGISTRAR_DELIVERY_BUCKET_PRICE,
  type RegistrarDeliverySheetController,
} from '../hooks/useRegistrarDeliverySheet';

export function RegistrarDeliverySheet({
  controller,
  initialPage = 0,
  useClientPager = false,
}: {
  controller: RegistrarDeliverySheetController;
  initialPage?: 0 | 1;
  useClientPager?: boolean;
}) {
  const { resolvedMode } = useAppTheme();

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
      initialPage={useClientPager ? 0 : initialPage}
      glassSurface
      glassTint={
        resolvedMode === 'dark' ? APPROVED_DARK_SHEET_GLASS_TINT : APPROVED_LIGHT_SHEET_GLASS_TINT
      }
      presentationBackgroundInteraction="disabled"
      presentationBackgroundMode="native"
      selectedItem={controller.selectedClient}
      subtitle="Escolha o cliente"
      title="Adicionar entrega"
      titleSystemImage="plus"
      useClientPager={useClientPager}
      visible={controller.sheetVisible}
    />
  );
}
