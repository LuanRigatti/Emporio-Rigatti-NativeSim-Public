import {
  Button,
  DatePicker,
  Divider,
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
  font,
  foregroundColor,
  frame,
  keyboardType,
  listStyle,
  listRowSeparator,
  onTapGesture,
  padding,
  scrollContentBackground,
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useRef, useState } from 'react';

import { NativeBottomSheet } from '@/components/native';
import { factoryPurchaseCalculationService } from '@/services/factory-purchases';
import { formatCurrency, formatPtBrDate, normalizeMoney, todayIso } from '@/utils/data';

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
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [paymentAmount, setPaymentAmount] = useState('');
  const [error, setError] = useState<string | undefined>();
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
    if (__DEV__) {
      console.log('[FactoryPayment] addPaymentPressed', {
        hasPurchase: Boolean(purchase),
        receiptId: purchase ? maskReceiptId(purchase.id) : null,
      });
    }
    if (!purchase) return;

    const amount = normalizeMoney(paymentAmount);
    const date = todayIso(paymentDate);
    if (__DEV__) {
      console.log('[FactoryPayment] paymentPayload', {
        amount,
        date,
        receiptId: maskReceiptId(purchase.id),
      });
    }
    if (amount === undefined) {
      setError('Informe um valor de pagamento maior que zero.');
      return;
    }

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
    }
  };

  const details = purchase ? (
    <VStack alignment="leading" spacing={16}>
      <HStack alignment="center" modifiers={[frame({ maxWidth: 1000, alignment: 'center' })]}>
        <Text modifiers={[font({ size: 17, weight: 'bold' })]}>Detalhes da compra</Text>
      </HStack>
      <DetailRow label="Data" value={formatPtBrDate(purchase.date)} />
      <DetailRow label="Baldes" value={String(purchase.bucketQuantity)} />
      <DetailRow label="Valor do balde" value={formatCurrency(purchase.bucketUnitPrice)} />
      <DetailRow label="Valor total" value={formatCurrency(purchase.totalAmount)} />
      <DetailRow label="Total pago" value={formatCurrency(paidAmount)} />
      <DetailRow label="Saldo restante" value={formatCurrency(remainingAmount)} />
      <DetailRow label="Status" value={isPaid ? 'Pago' : 'Em aberto'} />

      <Divider />
      <HStack alignment="center" modifiers={[frame({ maxWidth: 1000, alignment: 'center' })]}>
        <Text modifiers={[font({ size: 15, weight: 'semibold' })]}>Histórico de pagamentos</Text>
      </HStack>
      {purchase.payments.length > 0 ? (
        purchase.payments.map((payment) => (
          <DetailRow
            key={payment.id}
            label={formatPtBrDate(payment.date)}
            value={formatCurrency(payment.amount)}
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
              modifiers={[buttonStyle('glassProminent'), controlSize('large')]}
              onPress={() => {
                void handleAddPayment();
              }}
            />
          </HStack>
        </VStack>
      ) : null}
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
              listRowSeparator('hidden'),
              padding({
                horizontal: 20,
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
      onVisibleChange={onVisibleChange}
      title="Detalhes da compra"
      visible={visible}
    />
  );
}

function maskReceiptId(receiptId: string): string {
  return receiptId.length <= 8 ? receiptId : `${receiptId.slice(0, 4)}…${receiptId.slice(-4)}`;
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
