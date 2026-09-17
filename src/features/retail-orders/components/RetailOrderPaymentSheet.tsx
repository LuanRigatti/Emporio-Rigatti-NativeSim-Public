import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  NativeButton,
  NativeDatePicker,
  NativeDropdown,
  NativeSheet,
  NativeTextField,
} from '@/components/native';
import { PremiumCard } from '@/components/premium';
import { useAppTheme } from '@/theme';
import type { RetailPaymentDraft, RetailPaymentMethod } from '@/types/data';
import { formatCurrency, normalizeMoney, parseIsoCalendarDate, todayIso } from '@/utils/data';

import { RETAIL_PAYMENT_METHOD_OPTIONS } from '@/services/retail-orders';

type RetailOrderPaymentSheetProps = {
  outstandingAmount: number;
  onRegister: (input: RetailPaymentDraft) => Promise<string>;
  onVisibleChange: (visible: boolean) => void;
  visible: boolean;
};

const CARD_PAYMENT_METHODS: readonly RetailPaymentMethod[] = ['Crédito', 'Débito'];

export function RetailOrderPaymentSheet({
  onRegister,
  onVisibleChange,
  outstandingAmount,
  visible,
}: RetailOrderPaymentSheetProps) {
  const { theme } = useAppTheme();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<RetailPaymentMethod>('Pix');
  const [paidAt, setPaidAt] = useState(todayIso());
  const [cardFee, setCardFee] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (visible) {
      setAmount(formatCurrency(outstandingAmount));
      setMethod('Pix');
      setPaidAt(todayIso());
      setCardFee('');
      setNotes('');
      setError(undefined);
      setSubmitting(false);
      submittingRef.current = false;
      return;
    }

    setAmount('');
    setMethod('Pix');
    setPaidAt(todayIso());
    setCardFee('');
    setNotes('');
    setError(undefined);
    setSubmitting(false);
    submittingRef.current = false;
    // Reset only when the sheet opens/closes; keep user edits during an open session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const usesCardFee = CARD_PAYMENT_METHODS.includes(method);

  const handleMethodChange = (nextMethod: RetailPaymentMethod) => {
    setMethod(nextMethod);
    if (!CARD_PAYMENT_METHODS.includes(nextMethod)) setCardFee('');
  };

  const handleSubmit = async () => {
    if (submittingRef.current) return;

    const normalizedAmount = normalizeMoney(amount);
    if (normalizedAmount === undefined || normalizedAmount <= 0) {
      setError('Informe um valor de pagamento maior que zero.');
      return;
    }
    if (normalizedAmount > outstandingAmount) {
      setError('O pagamento não pode superar o saldo em aberto do pedido.');
      return;
    }

    let normalizedCardFee: number | undefined;
    if (usesCardFee && cardFee.trim()) {
      normalizedCardFee = normalizeMoney(cardFee);
      if (normalizedCardFee === undefined || normalizedCardFee < 0) {
        setError('Informe uma taxa de cartão válida.');
        return;
      }
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError(undefined);
    try {
      await onRegister({
        amount: normalizedAmount,
        method,
        paidAt: paidAt.trim(),
        ...(normalizedCardFee === undefined ? {} : { cardFee: normalizedCardFee }),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        status: 'posted',
      });
      setAmount('');
      setMethod('Pix');
      setPaidAt(todayIso());
      setCardFee('');
      setNotes('');
      setError(undefined);
      onVisibleChange(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Não foi possível registrar o pagamento.',
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <NativeSheet
      accessibilityLabel="Adicionar pagamento ao pedido Varejo"
      detents={[{ fraction: 0.7 }, 'large']}
      onVisibleChange={onVisibleChange}
      presentationBackgroundInteraction="enabled"
      presentationBackgroundColor="systemBackground"
      title="Adicionar pagamento"
      visible={visible}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
          Adicionar pagamento
        </Text>
        <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
          Saldo em aberto: {formatCurrency(outstandingAmount)}
        </Text>

        <PremiumCard style={[styles.card, { gap: theme.spacing.md }]}>
          <View style={styles.field}>
            <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
              Valor
            </Text>
            <NativeTextField
              accessibilityLabel="Valor do pagamento"
              disabled={submitting}
              keyboardType="decimal-pad"
              onChangeText={setAmount}
              placeholder="R$ 0,00"
              value={amount}
            />
          </View>

          <NativeDropdown
            accessibilityLabel="Método do pagamento"
            disabled={submitting}
            items={RETAIL_PAYMENT_METHOD_OPTIONS}
            label="Método do pagamento"
            onValueChange={(value) => handleMethodChange(value as RetailPaymentMethod)}
            selectedValue={method}
          />

          {usesCardFee ? (
            <View style={styles.field}>
              <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
                Taxa do cartão (opcional)
              </Text>
              <NativeTextField
                accessibilityLabel="Taxa do cartão"
                disabled={submitting}
                keyboardType="decimal-pad"
                onChangeText={setCardFee}
                placeholder="R$ 0,00"
                value={cardFee}
              />
            </View>
          ) : null}

          <View style={styles.dateRow}>
            <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
              Data do pagamento
            </Text>
            <NativeDatePicker
              accessibilityLabel="Data do pagamento"
              mode="date"
              onChange={(date) => setPaidAt(todayIso(date))}
              style="compact"
              value={parseIsoCalendarDate(paidAt) ?? new Date()}
            />
          </View>

          <View style={styles.field}>
            <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
              Observações (opcional)
            </Text>
            <NativeTextField
              accessibilityLabel="Observações do pagamento"
              disabled={submitting}
              onChangeText={setNotes}
              placeholder="Observação"
              value={notes}
            />
          </View>

          {error ? (
            <Text style={[theme.typography.footnote, { color: theme.colors.danger }]}>{error}</Text>
          ) : null}

          <NativeButton
            accessibilityLabel="Adicionar pagamento"
            disabled={submitting}
            haptic="light"
            label={submitting ? 'Salvando pagamento…' : 'Adicionar pagamento'}
            onPress={() => void handleSubmit()}
            variant="primary"
          />
        </PremiumCard>
      </ScrollView>
    </NativeSheet>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%' },
  content: { gap: 12, paddingBottom: 24 },
  dateRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  field: { gap: 4 },
});
