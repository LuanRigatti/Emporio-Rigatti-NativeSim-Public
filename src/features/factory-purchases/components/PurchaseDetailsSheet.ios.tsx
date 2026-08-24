import {
  Button,
  DatePicker,
  HStack,
  List,
  Spacer,
  Text,
  TextField,
  type TextFieldRef,
  VStack,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  autocorrectionDisabled,
  background,
  buttonStyle,
  controlSize,
  cornerRadius,
  disabled as disabledModifier,
  font,
  foregroundColor,
  frame,
  keyboardType,
  listStyle,
  listRowInsets,
  listRowSeparator,
  onTapGesture,
  padding,
  scrollContentBackground,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useRef, useState } from 'react';

import { NativeBottomSheet } from '@/components/native';
import { factoryPurchaseCalculationService } from '@/services/factory-purchases';
import { spacing, useAppTheme } from '@/theme';
import { formatPtBrDate, normalizeMoney, todayIso } from '@/utils/data';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import type { Purchase } from '../types';

type PurchaseDetailsSheetProps = {
  purchase: Purchase | null;
  visible: boolean;
  onAddPayment: (
    purchaseId: string,
    payment: { date: string; amount: number },
  ) => void | Promise<void>;
  onVisibleChange: (visible: boolean) => void;
};

type NativeTextState = NonNullable<Parameters<typeof TextField>[0]['text']>;

export function PurchaseDetailsSheet({
  onAddPayment,
  onVisibleChange,
  purchase,
  visible,
}: PurchaseDetailsSheetProps) {
  const { resolvedMode, theme } = useAppTheme();
  const { currency: maskCurrency, number: maskNumber, enabled: testModeEnabled } =
    useTestModePresentation();
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [paymentAmount, setPaymentAmount] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const isAddingPaymentRef = useRef(false);
  const paymentAmountState = useNativeState('') as NativeTextState;
  const paymentAmountRef = useRef<TextFieldRef>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!visible || !purchase) return;
    setPaymentDate(new Date());
    setPaymentAmount('');
    setError(undefined);
  }, [purchase, visible]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    paymentAmountState.set(paymentAmount);
  }, [paymentAmount, paymentAmountState]);

  const paidAmount = purchase ? factoryPurchaseCalculationService.paidAmount(purchase) : 0;
  const remainingAmount = purchase
    ? factoryPurchaseCalculationService.remainingAmount(purchase)
    : 0;
  const isPaid = purchase ? factoryPurchaseCalculationService.isPaid(purchase) : false;

  const handleAddPayment = async () => {
    if (!purchase || isAddingPaymentRef.current || testModeEnabled) return;

    const amount = normalizeMoney(paymentAmount);
    const date = todayIso(paymentDate);
    if (amount === undefined) {
      setError('Informe um valor de pagamento maior que zero.');
      return;
    }

    isAddingPaymentRef.current = true;
    setIsAddingPayment(true);
    try {
      await onAddPayment(purchase.id, { amount, date });
      setPaymentAmount('');
      setError(undefined);
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : 'Não foi possível adicionar o pagamento.',
      );
    } finally {
      isAddingPaymentRef.current = false;
      setIsAddingPayment(false);
    }
  };

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
            resolvedMode === 'dark' ? theme.colors.surface : theme.colors.background,
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
            resolvedMode === 'dark' ? theme.colors.surface : theme.colors.background,
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
            <Text modifiers={[font({ size: 15, weight: 'semibold' })]}>Novo pagamento</Text>
            <HStack alignment="center" spacing={12}>
              <Text modifiers={[font({ size: 15 })]}>Data</Text>
              <Spacer />
              <DatePicker
                displayedComponents={['date']}
                onDateChange={setPaymentDate}
                selection={paymentDate}
              />
            </HStack>
            <TextField
              axis="horizontal"
              modifiers={[
                autocorrectionDisabled(true),
                background('systemGray6'),
                cornerRadius(12),
                frame({ height: 42 }),
                keyboardType('decimal-pad'),
                padding({ horizontal: 10 }),
              ]}
              onTextChange={setPaymentAmount}
              placeholder="Valor pago"
              ref={paymentAmountRef}
              text={paymentAmountState}
            />
            {error ? (
              <Text modifiers={[foregroundColor('#FF3B30'), font({ size: 14 })]}>{error}</Text>
            ) : null}
            <HStack alignment="center">
              <Spacer />
              <Button
                label="Adicionar pagamento"
                modifiers={[
                  buttonStyle('glassProminent'),
                  controlSize('large'),
                  ...(isAddingPayment || testModeEnabled ? [disabledModifier(true)] : []),
                ]}
                onPress={() => {
                  void handleAddPayment();
                }}
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
        <List
          modifiers={[
            listStyle('plain'),
            scrollContentBackground('hidden'),
            background('systemBackground'),
            // The native tap callback reads this ref only when the sheet is tapped.
            // eslint-disable-next-line react-hooks/refs
            onTapGesture(() => {
              void paymentAmountRef.current?.blur();
            }),
          ]}
        >
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
      onVisibleChange={onVisibleChange}
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
