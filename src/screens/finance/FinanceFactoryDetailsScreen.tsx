import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import {
  BottomSheet,
  ConfirmationDialog,
  CurrencyInput,
  DateInput,
  DestructiveButton,
  EmptyState,
  FormError,
  IconButton,
  Input,
  LargeTitleHeader,
  ListItem,
  PrimaryButton,
  ProgressBar,
  ScrollScreen,
  Section,
  StatusChip,
  SwitchField,
} from '@/components';
import { useFactoryReceipts } from '@/hooks/useFactoryReceipts';
import { useFinancialPrivacy } from '@/hooks/useFinancialPrivacy';
import type { FinanceStackParamList } from '@/navigation/types';
import { factoryCalculationService } from '@/services/finance';
import { formatCurrency, normalizeMoney } from '@/utils/data';
import { useAppTheme } from '@/theme';

type Props = NativeStackScreenProps<FinanceStackParamList, 'FinanceFactoryDetails'>;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseDate(value: string): Date {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function FinanceFactoryDetailsScreen({ navigation, route }: Props) {
  const { theme } = useAppTheme();
  const { hidden } = useFinancialPrivacy();
  const data = useFactoryReceipts({ period: 'all' });
  const receipt = data.snapshot?.recebimentoBaldes.find(
    (item) => item.id === route.params?.receiptId,
  );
  const [paymentSheetVisible, setPaymentSheetVisible] = useState(false);
  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [paymentValue, setPaymentValue] = useState('');
  const [paymentDatePickerVisible, setPaymentDatePickerVisible] = useState(false);
  const [paymentError, setPaymentError] = useState<string | undefined>();
  const [savingPayment, setSavingPayment] = useState(false);
  const [removingPaymentId, setRemovingPaymentId] = useState<string | undefined>();
  const [removingReceipt, setRemovingReceipt] = useState(false);
  const [completionSaving, setCompletionSaving] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setPaymentDatePickerVisible(Platform.OS !== 'ios' && event.type !== 'dismissed');
    if (selectedDate) setPaymentDate(formatDate(selectedDate));
  };

  const openPaymentSheet = () => {
    if (!receipt) return;
    setPaymentError(undefined);
    setPaymentDate(todayIso());
    setPaymentValue('');
    setPaymentSheetVisible(true);
  };

  const addPayment = async () => {
    if (!receipt) return;
    setSavingPayment(true);
    setPaymentError(undefined);
    try {
      await data.addPayment(receipt.id, {
        date: paymentDate,
        amount: normalizeMoney(paymentValue) ?? 0,
      });
      setPaymentSheetVisible(false);
    } catch (saveError) {
      setPaymentError(
        saveError instanceof Error ? saveError.message : 'Não foi possível salvar o pagamento.',
      );
    } finally {
      setSavingPayment(false);
    }
  };

  const removePayment = async () => {
    if (!receipt || !removingPaymentId) return;
    setRemovingPaymentId(removingPaymentId);
    try {
      await data.removePayment(receipt.id, removingPaymentId);
    } finally {
      setRemovingPaymentId(undefined);
    }
  };

  const setCompleted = async (completed: boolean) => {
    if (!receipt) return;
    setCompletionSaving(true);
    try {
      await data.setCompleted(receipt.id, completed);
    } finally {
      setCompletionSaving(false);
    }
  };

  const removeReceipt = async () => {
    if (!receipt) return;
    setRemovingReceipt(true);
    try {
      await data.remove(receipt.id);
      navigation.goBack();
    } finally {
      setRemovingReceipt(false);
      setDeleteDialogVisible(false);
    }
  };

  return (
    <ScrollScreen onRefresh={() => void data.reload()} refreshing={data.refreshing}>
      <LargeTitleHeader onBack={() => navigation.goBack()} title="Detalhes da fábrica" />
      <View style={{ gap: theme.spacing.lg, padding: theme.spacing.md }}>
        {data.loading ? (
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
            Carregando...
          </Text>
        ) : data.error ? (
          <EmptyState description={data.error} title="Não foi possível carregar o recebimento" />
        ) : !receipt ? (
          <EmptyState
            description="O recebimento não foi encontrado."
            title="Registro indisponível"
          />
        ) : (
          <>
            <Section title="Recebimento">
              <ListItem
                title="Data"
                trailing={<Text style={{ color: theme.colors.textPrimary }}>{receipt.data}</Text>}
              />
              <ListItem
                title="Quantidade"
                trailing={
                  <Text style={{ color: theme.colors.textPrimary }}>
                    {receipt.quantidade} baldes
                  </Text>
                }
              />
              <ListItem
                title="Valor total"
                trailing={
                  <Text style={{ color: theme.colors.textPrimary }}>
                    {hidden ? '••••' : formatCurrency(receipt.valorTotal)}
                  </Text>
                }
              />
              <ListItem
                title="Total pago"
                trailing={
                  <Text style={{ color: theme.colors.textPrimary }}>
                    {hidden ? '••••' : formatCurrency(factoryCalculationService.totalPaid(receipt))}
                  </Text>
                }
              />
              <ListItem
                title="Saldo restante"
                trailing={
                  <Text style={{ color: theme.colors.textPrimary }}>
                    {hidden ? '••••' : formatCurrency(factoryCalculationService.openValue(receipt))}
                  </Text>
                }
              />
              <StatusChip
                label={receipt.concluido ? 'Concluído' : 'Em aberto'}
                status={receipt.concluido ? 'Pago' : 'Pendente'}
                style={{ marginTop: theme.spacing.sm }}
              />
              <ProgressBar
                label={`${Math.round(factoryCalculationService.paymentProgress(receipt) * 100)}% pago`}
                progress={factoryCalculationService.paymentProgress(receipt)}
                style={{ marginTop: theme.spacing.md }}
                tone="success"
              />
              <SwitchField
                accessibilityLabel="Marcar recebimento como concluído"
                disabled={completionSaving}
                helperText="A conclusão também é atualizada automaticamente ao quitar o saldo."
                label="Concluído"
                value={receipt.concluido}
                onValueChange={(value) => void setCompleted(value)}
                style={{ marginTop: theme.spacing.md }}
              />
            </Section>
            <Section title="Pagamentos">
              <PrimaryButton
                disabled={receipt.concluido}
                fullWidth
                icon={
                  <Ionicons
                    color={theme.colors.textInverse}
                    name="add"
                    size={theme.sizes.iconMedium}
                  />
                }
                onPress={openPaymentSheet}
              >
                Adicionar pagamento
              </PrimaryButton>
              {receipt.pagamentos.length ? (
                receipt.pagamentos.map((payment) => (
                  <ListItem
                    key={payment.id}
                    subtitle={hidden ? '••••' : formatCurrency(payment.valor)}
                    title={payment.data}
                    trailing={
                      <IconButton
                        accessibilityLabel="Remover pagamento"
                        disabled={removingPaymentId === payment.id}
                        icon={
                          <Ionicons
                            color={theme.colors.danger}
                            name="trash-outline"
                            size={theme.sizes.iconMedium}
                          />
                        }
                        onPress={() => setRemovingPaymentId(payment.id)}
                      />
                    }
                  />
                ))
              ) : (
                <EmptyState description="Nenhuma parcela registrada." title="Sem pagamentos" />
              )}
            </Section>
            <DestructiveButton
              fullWidth
              loading={removingReceipt}
              onPress={() => setDeleteDialogVisible(true)}
            >
              Excluir recebimento
            </DestructiveButton>
          </>
        )}
      </View>
      <BottomSheet
        onClose={() => setPaymentSheetVisible(false)}
        title="Novo pagamento parcial"
        visible={paymentSheetVisible}
      >
        <ScrollView contentContainerStyle={{ gap: theme.spacing.md }}>
          <DateInput
            label="Data do pagamento"
            required
            value={paymentDate}
            onPress={() => setPaymentDatePickerVisible(true)}
            onClear={() => setPaymentDate('')}
          />
          {paymentDatePickerVisible && Platform.OS !== 'web' ? (
            <DateTimePicker
              value={parseDate(paymentDate)}
              mode="date"
              onChange={handleDateChange}
            />
          ) : null}
          {Platform.OS === 'web' ? (
            <Input
              label="Data (AAAA-MM-DD)"
              required
              value={paymentDate}
              onChangeText={setPaymentDate}
            />
          ) : null}
          <CurrencyInput
            label="Valor pago"
            required
            value={paymentValue}
            onChangeText={setPaymentValue}
            helperText={
              receipt
                ? `Saldo máximo: ${hidden ? '••••' : formatCurrency(factoryCalculationService.openValue(receipt))}`
                : undefined
            }
          />
          <FormError message={paymentError} />
          <PrimaryButton fullWidth loading={savingPayment} onPress={() => void addPayment()}>
            Salvar pagamento
          </PrimaryButton>
        </ScrollView>
      </BottomSheet>
      <ConfirmationDialog
        confirmLabel="Remover pagamento"
        destructive
        message="A parcela será removida e o saldo será recalculado."
        onCancel={() => setRemovingPaymentId(undefined)}
        onConfirm={() => void removePayment()}
        title="Remover pagamento?"
        visible={Boolean(removingPaymentId)}
      />
      <ConfirmationDialog
        confirmLabel="Excluir recebimento"
        destructive
        loading={removingReceipt}
        message="O recebimento e todas as suas parcelas serão excluídos do histórico."
        onCancel={() => setDeleteDialogVisible(false)}
        onConfirm={() => void removeReceipt()}
        title="Excluir recebimento?"
        visible={deleteDialogVisible}
      />
    </ScrollScreen>
  );
}
