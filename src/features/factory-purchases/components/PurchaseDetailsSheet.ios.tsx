import { Button, HStack, List, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  background,
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  font,
  foregroundColor,
  frame,
  listStyle,
  listRowInsets,
  listRowSeparator,
  padding,
  scrollContentBackground,
  shapes,
} from '@expo/ui/swift-ui/modifiers';

import { NativeBottomSheet } from '@/components/native';
import { factoryPurchaseCalculationService } from '@/services/factory-purchases';
import { darkModeInsetSurface, spacing, useAppTheme } from '@/theme';
import {
  APPROVED_DARK_SHEET_GLASS_TINT,
  APPROVED_LIGHT_SHEET_GLASS_TINT,
} from '@/theme/sheetGlassTints';
import { formatPtBrDate } from '@/utils/data';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import type { Purchase } from '../types';

type PurchaseDetailsSheetProps = {
  purchase: Purchase | null;
  visible: boolean;
  onRequestAddPayment: (purchaseId: string) => void;
  onVisibleChange: (visible: boolean) => void;
  onDismiss: () => void;
};

export function PurchaseDetailsSheet({
  onRequestAddPayment,
  onDismiss,
  onVisibleChange,
  purchase,
  visible,
}: PurchaseDetailsSheetProps) {
  const { resolvedMode, theme } = useAppTheme();
  const {
    currency: maskCurrency,
    number: maskNumber,
    enabled: testModeEnabled,
  } = useTestModePresentation();

  const paidAmount = purchase ? factoryPurchaseCalculationService.paidAmount(purchase) : 0;
  const remainingAmount = purchase
    ? factoryPurchaseCalculationService.remainingAmount(purchase)
    : 0;
  const isPaid = purchase ? factoryPurchaseCalculationService.isPaid(purchase) : false;

  const details = purchase ? (
    <VStack
      alignment="leading"
      spacing={16}
      modifiers={[
        frame({ maxWidth: Infinity, alignment: 'topLeading' }),
        padding({ top: spacing.sm }),
      ]}
    >
      <HStack alignment="center" modifiers={[frame({ maxWidth: 1000, alignment: 'center' })]}>
        <Text modifiers={[font({ size: 17, weight: 'bold' })]}>Detalhes da compra</Text>
      </HStack>
      <VStack
        alignment="leading"
        spacing={16}
        modifiers={[
          frame({ maxWidth: Infinity, alignment: 'topLeading' }),
          padding({ all: spacing.md }),
          background(
            resolvedMode === 'dark' ? darkModeInsetSurface : theme.colors.background,
            shapes.roundedRectangle({ cornerRadius: 36, roundedCornerStyle: 'continuous' }),
          ),
        ]}
      >
        <DetailRow label="Data" value={formatPtBrDate(purchase.date)} />
        <DetailRow label="Baldes" value={maskNumber(purchase.bucketQuantity)} />
        <DetailRow label="Valor do balde" value={maskCurrency(purchase.bucketUnitPrice)} />
        <DetailRow label="Valor total" value={maskCurrency(purchase.totalAmount)} />
        <DetailRow label="Total pago" value={maskCurrency(paidAmount)} />
        <DetailRow label="Saldo restante" value={maskCurrency(remainingAmount)} />
        <DetailRow label="Status" value={isPaid ? 'Pago' : 'Em aberto'} />
      </VStack>

      <HStack alignment="center" modifiers={[frame({ maxWidth: 1000, alignment: 'center' })]}>
        <Text modifiers={[font({ size: 15, weight: 'semibold' })]}>Histórico de pagamentos</Text>
      </HStack>
      <VStack
        alignment="leading"
        spacing={16}
        modifiers={[
          frame({ maxWidth: Infinity, alignment: 'topLeading' }),
          padding({ all: spacing.md }),
          background(
            resolvedMode === 'dark' ? darkModeInsetSurface : theme.colors.background,
            shapes.roundedRectangle({ cornerRadius: 36, roundedCornerStyle: 'continuous' }),
          ),
        ]}
      >
        {purchase.payments.length > 0 ? (
          purchase.payments.map((payment) => (
            <DetailRow
              key={payment.id}
              label={formatPtBrDate(payment.date)}
              value={maskCurrency(payment.amount)}
            />
          ))
        ) : (
          <Text modifiers={[foregroundColor('#8E8E93'), font({ size: 15 })]}>
            Nenhum pagamento registrado.
          </Text>
        )}

        {!isPaid ? (
          <VStack alignment="leading" spacing={12} modifiers={[padding({ top: 4 })]}>
            <HStack alignment="center">
              <Spacer />
              <Button
                label="Adicionar pagamento"
                modifiers={[
                  buttonStyle('glassProminent'),
                  controlSize('large'),
                  ...(testModeEnabled ? [disabledModifier(true)] : []),
                ]}
                onPress={() => onRequestAddPayment(purchase.id)}
              />
            </HStack>
          </VStack>
        ) : null}
      </VStack>
    </VStack>
  ) : null;

  return (
    <NativeBottomSheet
      content={
        <List modifiers={[listStyle('plain'), scrollContentBackground('hidden')]}>
          <VStack
            alignment="leading"
            spacing={0}
            modifiers={[
              frame({ maxWidth: 1000, alignment: 'topLeading' }),
              listRowInsets({ top: 0, bottom: 0, leading: 0, trailing: 0 }),
              listRowSeparator('hidden'),
              padding({
                horizontal: spacing.md,
                top: 12,
                bottom: 28,
              }),
            ]}
          >
            {details}
          </VStack>
        </List>
      }
      items={[]}
      hostSizing="viewport"
      onDismiss={onDismiss}
      onVisibleChange={onVisibleChange}
      glassSurface
      glassTint={
        resolvedMode === 'dark' ? APPROVED_DARK_SHEET_GLASS_TINT : APPROVED_LIGHT_SHEET_GLASS_TINT
      }
      presentationBackgroundInteraction="disabled"
      presentationBackgroundMode="native"
      title="Detalhes da compra"
      visible={visible}
    />
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <HStack alignment="center" spacing={12} modifiers={[padding({ vertical: 2 })]}>
      <Text modifiers={[foregroundColor('#8E8E93'), font({ size: 15 })]}>{label}</Text>
      <Spacer />
      <Text modifiers={[font({ size: 15 })]}>{value}</Text>
    </HStack>
  );
}
