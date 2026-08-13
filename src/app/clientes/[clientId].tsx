import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassBackButton, NativeTextField, NativeToggle } from '@/components/native';
import { GlassCard, PremiumScreen } from '@/components/premium';
import { useClients } from '@/hooks/useClients';
import { useAppTheme } from '@/theme';
import { formatCurrency, normalizeMoney } from '@/utils/data';

const CLIENT_NAMES: Record<string, string> = {
  ana: 'Ana Costa',
  beatriz: 'Beatriz Martins',
  carlos: 'Carlos Souza',
  joao: 'João Silva',
  juliana: 'Juliana Alves',
  lucas: 'Lucas Ferreira',
  maria: 'Maria Oliveira',
  pedro: 'Pedro Santos',
  rafael: 'Rafael Lima',
  sofia: 'Sofia Rocha',
};

export default function ClientDetailsRoute() {
  const { theme } = useAppTheme();
  const router = useRouter();
  const { clients, updatePrice } = useClients();
  const { clientId, clientName: routeClientName } = useLocalSearchParams<{
    clientId?: string;
    clientName?: string;
  }>();
  const [bucketValue, setBucketValue] = useState('');
  const [address, setAddress] = useState('');
  const [usesInvoice, setUsesInvoice] = useState(false);
  const [usesBoleto, setUsesBoleto] = useState(false);
  const [error, setError] = useState<string>();
  const client = useMemo(
    () =>
      clients.find(
        (candidate) =>
          candidate.clientId === clientId || candidate.canonicalName === routeClientName,
      ),
    [clientId, clients, routeClientName],
  );
  const clientName = (clientId && CLIENT_NAMES[clientId]) || routeClientName || 'Cliente';

  const handleBack = useCallback(() => {
    if (!client) {
      router.back();
      return;
    }

    const price = normalizeMoney(bucketValue);
    if (price === undefined || price <= 0) {
      setError('Informe um preço maior que zero.');
      return;
    }

    setError(undefined);
    router.back();
    void updatePrice(client, price, usesInvoice, usesBoleto).catch((saveError) => {
      if (__DEV__) {
        console.error(
          '[ClientDetails] failed to persist changes after leaving the screen',
          saveError,
        );
      }
    });
  }, [bucketValue, client, router, updatePrice, usesBoleto, usesInvoice]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (client) {
      setAddress(client.address ?? '');
      setUsesInvoice(client.usesInvoice);
      setUsesBoleto(client.usesBoleto);
      setBucketValue(client.currentPrice === undefined ? '' : formatCurrency(client.currentPrice));
    }
  }, [client]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <PremiumScreen
      contentContainerStyle={[
        styles.content,
        { backgroundColor: theme.colors.background, gap: theme.spacing.lg },
      ]}
    >
      <View style={styles.headerRow}>
        <NativeGlassBackButton
          accessibilityLabel="Voltar para Clientes"
          color={theme.colors.textPrimary}
          containerSize={theme.sizes.touchTargetMinimum}
          onPress={handleBack}
          size={theme.sizes.iconMedium}
        />
      </View>
      <GlassCard style={[styles.card, { borderRadius: theme.radius.xl + theme.spacing.sm }]}>
        <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
          {clientName}
        </Text>
        <View style={styles.fieldGroup}>
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            Valor do balde
          </Text>
          <NativeTextField
            accessibilityLabel="Valor do balde"
            onChangeText={setBucketValue}
            value={bucketValue}
          />
          {error ? (
            <Text style={[theme.typography.footnote, { color: theme.colors.danger }]}>{error}</Text>
          ) : null}
        </View>
        <NativeToggle
          label="Usa nota fiscal"
          onValueChange={setUsesInvoice}
          value={usesInvoice}
        />
        <NativeToggle label="Usa boleto" onValueChange={setUsesBoleto} value={usesBoleto} />
        <View style={styles.fieldGroup}>
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            Endereço
          </Text>
          <NativeTextField
            accessibilityLabel="Endereço"
            onChangeText={setAddress}
            placeholder="Informe o endereço"
            value={address}
          />
        </View>
      </GlassCard>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 20 },
  content: { flexGrow: 1 },
  fieldGroup: { gap: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
