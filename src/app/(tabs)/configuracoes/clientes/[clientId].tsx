import { useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove, type NavigationAction } from 'expo-router/react-navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NativeTextField, NativeToggle } from '@/components/native';
import { GlassCard, PremiumScreen } from '@/components/premium';
import { useClients } from '@/hooks/useClients';
import { useAppTheme } from '@/theme';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';
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

type ClientEditValues = {
  bucketValue: string;
  usesBoleto: boolean;
  usesInvoice: boolean;
};

export default function ClientDetailsRoute() {
  const { theme } = useAppTheme();
  const { enabled: testModeEnabled } = useTestModePresentation();
  const navigation = useNavigation();
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
  const [initialValues, setInitialValues] = useState<ClientEditValues | null>(null);
  const pendingRemoveActionRef = useRef<NavigationAction | null>(null);
  const isSavingRef = useRef(false);
  const [allowNextRemove, setAllowNextRemove] = useState(false);
  const client = useMemo(
    () =>
      clients.find(
        (candidate) =>
          candidate.clientId === clientId || candidate.canonicalName === routeClientName,
      ),
    [clientId, clients, routeClientName],
  );
  const clientName = (clientId && CLIENT_NAMES[clientId]) || routeClientName || 'Cliente';

  const hasPendingChanges = Boolean(
    client &&
    !testModeEnabled &&
    initialValues &&
    (bucketValue !== initialValues.bucketValue ||
      usesInvoice !== initialValues.usesInvoice ||
      usesBoleto !== initialValues.usesBoleto),
  );

  const handleBeforeRemove = useCallback(
    ({ data: { action } }: { data: { action: NavigationAction } }) => {
      if (!client || isSavingRef.current) return;

      const price = normalizeMoney(bucketValue);
      if (price === undefined || price <= 0) {
        setError('Informe um preço maior que zero.');
        return;
      }

      isSavingRef.current = true;
      setError(undefined);
      void updatePrice(client, price, usesInvoice, usesBoleto)
        .then(() => {
          pendingRemoveActionRef.current = action;
          setAllowNextRemove(true);
        })
        .catch((saveError) => {
          if (__DEV__) {
            console.error(
              '[ClientDetails] failed to persist changes before leaving the screen',
              saveError,
            );
          }
        })
        .finally(() => {
          isSavingRef.current = false;
        });
    },
    [bucketValue, client, updatePrice, usesBoleto, usesInvoice],
  );

  usePreventRemove(hasPendingChanges && !allowNextRemove, handleBeforeRemove);

  useEffect(() => {
    if (!allowNextRemove) return;
    const action = pendingRemoveActionRef.current;
    pendingRemoveActionRef.current = null;
    if (action) navigation.dispatch(action);
  }, [allowNextRemove, navigation]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (client) {
      const nextValues = {
        bucketValue: client.currentPrice === undefined ? '' : formatCurrency(client.currentPrice),
        usesBoleto: client.usesBoleto,
        usesInvoice: client.usesInvoice,
      };
      setInitialValues(nextValues);
      setAddress(client.address ?? '');
      setUsesInvoice(nextValues.usesInvoice);
      setUsesBoleto(nextValues.usesBoleto);
      setBucketValue(nextValues.bucketValue);
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
      <View style={{ height: theme.sizes.touchTargetMinimum }} />
      <GlassCard
        style={[styles.card, { borderRadius: theme.radius.xl + theme.spacing.sm }]}
      >
        <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
          {clientName}
        </Text>
        <View style={styles.fieldGroup}>
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            Valor do balde
          </Text>
          <NativeTextField
            accessibilityLabel="Valor do balde"
            keyboardType="decimal-pad"
            onChangeText={setBucketValue}
            value={bucketValue}
          />
          {error ? (
            <Text style={[theme.typography.footnote, { color: theme.colors.danger }]}>{error}</Text>
          ) : null}
        </View>
        <NativeToggle label="Usa nota fiscal" onValueChange={setUsesInvoice} value={usesInvoice} />
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
});
