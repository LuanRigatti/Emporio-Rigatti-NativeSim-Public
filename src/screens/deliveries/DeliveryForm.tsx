import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, ScrollView, Text } from 'react-native';

import {
  BottomSheet,
  ClientSelector,
  CurrencyInput,
  DateInput,
  FormError,
  Input,
  KeyboardScreen,
  LargeTitleHeader,
  PaymentMethodSelector,
  PrimaryButton,
  QuantityInput,
  SecondaryButton,
  SelectableListItem,
  SegmentedControl,
  StatusSelector,
  SwitchField,
} from '@/components';
import { useClients } from '@/hooks/useClients';
import { useDeliveries } from '@/hooks/useDeliveries';
import type { DeliveriesStackParamList } from '@/navigation/types';
import { deliveryPricingService } from '@/services/deliveries';
import { useAppTheme } from '@/theme';
import type { Delivery, DeliveryDraft, InvoiceStatus, PaymentMethod } from '@/types/data';
import { normalizeMoney } from '@/utils/data';

type NewProps = NativeStackScreenProps<DeliveriesStackParamList, 'NewDelivery'>;
type EditProps = NativeStackScreenProps<DeliveriesStackParamList, 'EditDelivery'>;
type Props = NewProps | EditProps;

const invoiceOptions = [
  { value: 'a_emitir' as const, label: 'A emitir' },
  { value: 'emitido' as const, label: 'Emitido' },
];

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDate(value: string): Date {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function getInitialDelivery(props: Props, deliveries: Delivery[]): Delivery | undefined {
  if (props.route.name !== 'EditDelivery') return undefined;
  const deliveryId = props.route.params.deliveryId;
  return deliveries.find((delivery) => delivery.id === deliveryId);
}

export function DeliveryForm(props: Props) {
  const { navigation, route } = props;
  const { theme } = useAppTheme();
  const editing = route.name === 'EditDelivery';
  const { clients } = useClients();
  const { allDeliveries, snapshot, loading, create, update } = useDeliveries(
    editing ? { mode: 'all', deliveryId: route.params.deliveryId } : { mode: 'all' },
  );
  const delivery = getInitialDelivery(props, allDeliveries);
  const [clientName, setClientName] = useState(
    route.name === 'NewDelivery' ? (route.params?.clientName ?? '') : '',
  );
  const [address, setAddress] = useState('');
  const [addressConfirmed, setAddressConfirmed] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [value, setValue] = useState('0.00');
  const [manualValue, setManualValue] = useState(false);
  const [date, setDate] = useState(
    route.name === 'NewDelivery'
      ? (route.params?.date ?? formatDate(new Date()))
      : formatDate(new Date()),
  );
  const [status, setStatus] = useState<DeliveryDraft['status']>('Não Pago');
  const [delivered, setDelivered] = useState(false);
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatus>('a_emitir');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | undefined>();
  const [clientSheetVisible, setClientSheetVisible] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!delivery) return;
      setClientName(delivery.cliente);
      setAddress(delivery.endereco ?? '');
      setAddressConfirmed(Boolean(delivery.endereco?.trim()));
      setQuantity(String(delivery.quantidade));
      setValue(delivery.valor.toFixed(2));
      setManualValue(true);
      setDate(delivery.data);
      setStatus(delivery.status === 'Pago' ? 'Pago' : 'Não Pago');
      setDelivered(delivery.entregue);
      setInvoiceStatus(delivery.invoiceStatus ?? 'a_emitir');
      setPaymentMethod(delivery.metodoPagamento);
    }, 0);
    return () => clearTimeout(timer);
  }, [delivery]);

  const filteredClients = useMemo(() => {
    const query = clientSearch.trim().toLocaleLowerCase('pt-BR');
    return clients.filter(
      (client) => !query || client.canonicalName.toLocaleLowerCase('pt-BR').includes(query),
    );
  }, [clientSearch, clients]);

  useEffect(() => {
    if (manualValue || !clientName) return;
    const selected = clients.find((client) => client.canonicalName === clientName);
    const automatic = selected?.currentPrice !== undefined
      ? selected.currentPrice * (normalizeMoney(quantity) ?? 0)
      : snapshot
        ? deliveryPricingService.calculateAutomaticValue({
            clientName,
            date,
            quantity,
            customClients: snapshot.clientesCustom,
            fallbackValue: value,
          })
        : undefined;
    if (automatic === undefined) return;
    const timer = setTimeout(() => setValue(automatic.toFixed(2)), 0);
    return () => clearTimeout(timer);
  }, [clientName, clients, date, manualValue, quantity, snapshot, value]);

  const selectClient = (name: string) => {
    const selected = clients.find((client) => client.canonicalName === name);
    setClientName(name);
    setAddress(selected?.address ?? '');
    setAddressConfirmed(false);
    setClientSheetVisible(false);
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setDatePickerVisible(Platform.OS !== 'ios' && event.type !== 'dismissed');
    if (selectedDate) setDate(formatDate(selectedDate));
  };

  const save = async () => {
    setSaving(true);
    setError(undefined);
    try {
      const normalizedQuantity = normalizeMoney(quantity) ?? 0;
      const normalizedValue = normalizeMoney(value) ?? 0;
      const selectedClient = clients.find((client) => client.canonicalName === clientName);
      const automaticUnitPrice =
        !manualValue && clientName && selectedClient?.currentPrice !== undefined
          ? selectedClient.currentPrice
          : !manualValue && clientName && snapshot
            ? deliveryPricingService.resolveUnitPrice({
              clientName,
              date,
              quantity,
              customClients: snapshot.clientesCustom,
              fallbackValue: value,
            })
            : undefined;
      const draft: DeliveryDraft = {
        id: delivery?.id,
        clientId: selectedClient?.clientId ?? delivery?.clientId,
        clientName,
        address,
        addressConfirmed,
        quantity: normalizedQuantity,
        value: normalizedValue,
        valueWasManuallyChanged: manualValue,
        historicalUnitPrice:
          automaticUnitPrice ??
          (normalizedQuantity > 0
            ? Number((normalizedValue / normalizedQuantity).toFixed(2))
            : undefined),
        date,
        status,
        delivered,
        invoiceStatus,
        paymentMethod: status === 'Pago' ? paymentMethod : undefined,
      };
      if (editing && delivery) await update(delivery.id, draft);
      else await create(draft);
      navigation.goBack();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Não foi possível salvar a entrega.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardScreen>
      <LargeTitleHeader
        onBack={() => navigation.goBack()}
        title={editing ? 'Editar entrega' : 'Nova entrega'}
      />
      <ScrollView
        contentContainerStyle={{ gap: theme.spacing.md, padding: theme.spacing.md }}
        keyboardShouldPersistTaps="handled"
      >
        {loading && editing && !delivery ? <Text>Carregando entrega...</Text> : null}
        <ClientSelector
          required
          value={clientName}
          onPress={() => setClientSheetVisible(true)}
          onClear={() => {
            setClientName('');
            setAddress('');
            setAddressConfirmed(false);
          }}
        />
        <Input
          required
          label="Endereço"
          value={address}
          onChangeText={(next) => {
            setAddress(next);
            setAddressConfirmed(false);
          }}
          helperText="O endereço precisa ser confirmado antes de salvar."
        />
        <SwitchField
          label="Endereço confirmado"
          value={addressConfirmed}
          onValueChange={setAddressConfirmed}
          helperText="Confirme que o endereço está correto para permitir a entrega."
        />
        <QuantityInput
          required
          label="Quantidade de baldes"
          value={quantity}
          onChangeText={setQuantity}
        />
        <CurrencyInput
          required
          label="Valor da entrega"
          value={value}
          onChangeText={(next) => {
            setValue(next);
            setManualValue(true);
          }}
          helperText="O valor é preenchido pela tabela aplicável e pode ser ajustado manualmente."
        />
        <DateInput
          required
          label="Data"
          value={date}
          onPress={() => setDatePickerVisible(true)}
          onClear={() => setDate('')}
        />
        {datePickerVisible && Platform.OS !== 'web' ? (
          <DateTimePicker value={parseDate(date)} mode="date" onChange={handleDateChange} />
        ) : null}
        {Platform.OS === 'web' ? (
          <Input label="Data (AAAA-MM-DD)" value={date} onChangeText={setDate} />
        ) : null}
        <StatusSelector
          required
          label="Status do pagamento"
          options={['Pago', 'Não Pago']}
          value={status}
          onChange={(next) => {
            const nextStatus = next as DeliveryDraft['status'];
            setStatus(nextStatus);
            if (nextStatus !== 'Pago') setPaymentMethod(undefined);
          }}
        />
        {status === 'Pago' ? (
          <PaymentMethodSelector
            required
            value={paymentMethod}
            onChange={setPaymentMethod}
            error={!paymentMethod ? 'Escolha Dinheiro ou Pix.' : undefined}
          />
        ) : null}
        <SwitchField label="Entrega realizada" value={delivered} onValueChange={setDelivered} />
        <SegmentedControl
          options={invoiceOptions}
          value={invoiceStatus}
          onChange={setInvoiceStatus}
        />
        <FormError message={error} />
        <SecondaryButton fullWidth onPress={() => navigation.goBack()}>
          Cancelar
        </SecondaryButton>
        <PrimaryButton fullWidth loading={saving} onPress={() => void save()}>
          Salvar entrega
        </PrimaryButton>
      </ScrollView>
      <BottomSheet
        title="Selecionar cliente"
        visible={clientSheetVisible}
        onClose={() => setClientSheetVisible(false)}
      >
        <Input
          clearable
          label="Buscar cliente"
          value={clientSearch}
          onChangeText={setClientSearch}
          onClear={() => setClientSearch('')}
        />
        <FlatList
          data={filteredClients}
          keyExtractor={(item) => item.clientId}
          renderItem={({ item }) => (
            <SelectableListItem
              selected={item.canonicalName === clientName}
              title={item.canonicalName}
              subtitle={item.address ?? 'Endereço pendente'}
              onSelect={() => selectClient(item.canonicalName)}
            />
          )}
          style={{ maxHeight: 320 }}
        />
      </BottomSheet>
    </KeyboardScreen>
  );
}
