import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import {
  BottomSheet,
  PrimaryButton,
  SecondaryButton,
  SegmentedControl,
  StatusSelector,
  SwitchField,
} from '@/components';
import { Screen } from '@/components/layout';
import { useDeliveries } from '@/hooks/useDeliveries';
import type { DeliveriesStackParamList } from '@/navigation/types';
import type { DeliveryBulkPatch, InvoiceStatus } from '@/types/data';
import { useAppTheme } from '@/theme';

type Props = NativeStackScreenProps<DeliveriesStackParamList, 'DeliveryBulkEdit'>;

export function DeliveryBulkEdit({ navigation, route }: Props) {
  const { theme } = useAppTheme();
  const [status, setStatus] = useState<'Pago' | 'Não Pago' | undefined>();
  const [delivered, setDelivered] = useState<boolean | undefined>();
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatus>('a_emitir');
  const [invoiceStatusChanged, setInvoiceStatusChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const { allDeliveries, editMany } = useDeliveries({
    mode: 'all',
    deliveryIds: route.params.deliveryIds,
  });

  const selectedInvoiceStatuses = useMemo(
    () =>
      new Set(
        allDeliveries
          .filter((delivery) => route.params.deliveryIds.includes(delivery.id))
          .map((delivery) => delivery.invoiceStatus),
      ),
    [allDeliveries, route.params.deliveryIds],
  );

  const displayedInvoiceStatus = invoiceStatusChanged
    ? invoiceStatus
    : ([...selectedInvoiceStatuses][0] ?? invoiceStatus);

  const save = async () => {
    setSaving(true);
    const patch: DeliveryBulkPatch = {};
    if (status) patch.status = status;
    if (delivered !== undefined) patch.entregue = delivered;
    if (invoiceStatusChanged) patch.invoiceStatus = invoiceStatus;
    try {
      await editMany(route.params.deliveryIds, patch);
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <BottomSheet
        title="Editar selecionadas"
        visible
        onClose={() => navigation.goBack()}
        footer={
          <View style={{ gap: theme.spacing.sm }}>
            <SecondaryButton fullWidth onPress={() => navigation.goBack()}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton fullWidth loading={saving} onPress={() => void save()}>
              Aplicar alterações
            </PrimaryButton>
          </View>
        }
      >
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          As alterações serão aplicadas às entregas selecionadas.
        </Text>
        <StatusSelector
          label="Status do pagamento"
          options={['Pago', 'Não Pago']}
          value={status}
          onChange={(next) => setStatus(next as 'Pago' | 'Não Pago')}
          style={{ marginTop: theme.spacing.md }}
        />
        <SwitchField
          label="Marcar como entregue"
          value={delivered ?? false}
          onValueChange={setDelivered}
          helperText={
            delivered === undefined
              ? 'Ative apenas se quiser aplicar este estado a todas.'
              : undefined
          }
        />
        <SegmentedControl
          options={[
            { value: 'a_emitir' as const, label: 'A emitir' },
            { value: 'emitido' as const, label: 'Emitido' },
          ]}
          value={displayedInvoiceStatus}
          onChange={(next) => {
            setInvoiceStatus(next);
            setInvoiceStatusChanged(true);
          }}
        />
      </BottomSheet>
    </Screen>
  );
}
