import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import {
  NativeRetailClientFormSheet,
  type NativeRetailClientFormValues,
} from '@/components/native';
import { PremiumCard, PremiumScreen } from '@/components/premium';
import { useRetailClients } from '@/hooks/useRetailClients';
import { formatCurrency, normalizeMoney } from '@/utils/data';
import { useAppTheme } from '@/theme';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import { retailClientFormValues } from '../clientes-varejo';

function toPatch(values: NativeRetailClientFormValues) {
  const feeText = values.defaultDeliveryFee.trim();
  const fee = feeText ? normalizeMoney(feeText) : undefined;
  if (feeText && (fee === undefined || fee < 0)) {
    throw new Error('A taxa padrão de entrega deve ser zero ou maior.');
  }

  return {
    address: values.address.trim() || null,
    defaultDeliveryFee: fee ?? null,
    name: values.name,
    phone: values.phone.trim() || null,
    referral: values.hasReferral
      ? {
          hasReferral: true,
          referredByName: values.referredByName,
          sourceType: values.sourceType,
        }
      : null,
  };
}

export default function RetailClientDetailsRoute() {
  const { theme } = useAppTheme();
  const { enabled: testModeEnabled } = useTestModePresentation();
  const { clientId } = useLocalSearchParams<{ clientId?: string }>();
  const { clients, error, loading, reload, update } = useRetailClients({ includeInactive: true });
  const [formVisible, setFormVisible] = useState(false);
  const client = useMemo(
    () => clients.find((candidate) => candidate.clientId === clientId),
    [clientId, clients],
  );

  const handleSubmit = useCallback(
    async (values: NativeRetailClientFormValues) => {
      if (!client || testModeEnabled) return;
      await update(client.clientId, toPatch(values));
    },
    [client, testModeEnabled, update],
  );

  const header = <NativeGlassHeader mode="transparent" title="Cliente" />;

  return (
    <>
      {client ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityLabel="Editar cliente"
            icon="pencil"
            onPress={() => setFormVisible(true)}
          />
        </Stack.Toolbar>
      ) : null}
      <PremiumScreen
        contentContainerStyle={[styles.content, { backgroundColor: theme.colors.background }]}
        overlayHeader={header}
        progressiveBlur
      >
        {loading ? (
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
            Carregando cliente...
          </Text>
        ) : error ? (
          <View style={styles.state}>
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
              {error}
            </Text>
            <Text
              accessibilityRole="button"
              onPress={() => void reload()}
              style={[theme.typography.body, { color: theme.colors.primary }]}
            >
              Tentar novamente
            </Text>
          </View>
        ) : client ? (
          <View style={{ marginTop: theme.spacing.xl }}>
            <PremiumCard
              style={[styles.card, { borderRadius: theme.radius.xl + theme.spacing.sm }]}
            >
              <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
                {client.name}
              </Text>
              <DetailRow label="Telefone" value={client.phone ?? 'Não informado'} />
              <DetailRow label="Endereço" value={client.address ?? 'Não informado'} />
              <DetailRow
                label="Indicação"
                value={
                  client.referral?.hasReferral
                    ? [client.referral.sourceType, client.referral.referredByName]
                        .filter(Boolean)
                        .join(' · ') || 'Sim'
                    : 'Não'
                }
              />
              <DetailRow
                label="Taxa padrão de entrega"
                value={
                  client.defaultDeliveryFee === undefined
                    ? 'Não definida'
                    : formatCurrency(client.defaultDeliveryFee)
                }
              />
            </PremiumCard>
          </View>
        ) : (
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
            Cliente não encontrado.
          </Text>
        )}
      </PremiumScreen>
      {client ? (
        <NativeRetailClientFormSheet
          initialValues={retailClientFormValues(client)}
          mode="edit"
          onSubmit={handleSubmit}
          onVisibleChange={setFormVisible}
          visible={formVisible}
        />
      ) : null}
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.detailRow}>
      <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
        {label}
      </Text>
      <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 20 },
  content: { flexGrow: 1 },
  detailRow: { gap: 4 },
  state: { alignItems: 'center', gap: 12 },
});
