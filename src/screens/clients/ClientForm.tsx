import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { Keyboard, Text, View } from 'react-native';

import {
  CurrencyInput,
  ErrorState,
  FormField,
  Input,
  KeyboardScreen,
  LargeTitleHeader,
  PrimaryButton,
} from '@/components';
import { useClients } from '@/hooks/useClients';
import { formatCurrency, normalizeMoney } from '@/utils/data';
import { useFinancialPrivacy } from '@/hooks/useFinancialPrivacy';
import type { ClientsStackParamList } from '@/navigation/types';
import { useAppTheme } from '@/theme';

type Props = NativeStackScreenProps<ClientsStackParamList, 'ClientForm'>;

export function ClientForm({ navigation, route }: Props) {
  const { theme } = useAppTheme();
  const { hidden } = useFinancialPrivacy();
  const { clients, loading, error, saveCustomClient, updatePrice } = useClients();
  const client = useMemo(
    () =>
      clients.find(
        (item) =>
          item.clientId === route.params.clientId || item.canonicalName === route.params.clientName,
      ),
    [clients, route.params.clientId, route.params.clientName],
  );
  const [name, setName] = useState(client?.canonicalName ?? route.params.clientName ?? '');
  const [price, setPrice] = useState(
    client?.customConfig?.preco?.toString().replace('.', ',') ?? '',
  );
  const [address, setAddress] = useState(client?.address ?? '');
  const [formError, setFormError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const persistedClientId = client?.clientId;
  const persistedClientName = client?.canonicalName;
  const persistedClientPrice = client?.customConfig?.preco;
  const persistedClientAddress = client?.address ?? '';

  useEffect(() => {
    if (!persistedClientId) return;
    const timer = setTimeout(() => {
      setName(persistedClientName ?? '');
      setPrice(persistedClientPrice?.toString().replace('.', ',') ?? '');
      setAddress(persistedClientAddress);
    }, 0);
    return () => clearTimeout(timer);
  }, [persistedClientAddress, persistedClientId, persistedClientName, persistedClientPrice]);

  const handleSave = async () => {
    Keyboard.dismiss();
    setFormError(undefined);
    const numericPrice = normalizeMoney(price);
    if (!name.trim()) return setFormError('Informe o nome do cliente.');
    if (numericPrice === undefined || numericPrice <= 0)
      return setFormError('Informe um preço maior que zero.');
    if (!address.trim()) return setFormError('Informe o endereço do cliente.');

    setSaving(true);
    try {
      if (route.params.mode === 'edit') {
        if (!client) throw new Error('Cliente não encontrado.');
        await updatePrice(client, numericPrice);
      } else {
        await saveCustomClient(name, numericPrice, address);
      }
      navigation.goBack();
    } catch (saveError) {
      setFormError(
        saveError instanceof Error ? saveError.message : 'Não foi possível salvar o cliente.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading && route.params.mode === 'edit') {
    return (
      <KeyboardScreen>
        <LargeTitleHeader onBack={() => navigation.goBack()} title="Editar cliente" />
        <View style={{ flex: 1 }} />
      </KeyboardScreen>
    );
  }

  return (
    <KeyboardScreen>
      <LargeTitleHeader
        onBack={() => navigation.goBack()}
        subtitle="A configuração personalizada complementa o cliente histórico."
        title={route.params.mode === 'create' ? 'Novo cliente' : 'Editar cliente'}
      />
      <View style={{ flex: 1, padding: theme.spacing.lg }}>
        <FormField
          helperText="Aliases históricos são bloqueados para evitar duplicidades."
          label="Nome"
          required
        >
          <Input
            autoCapitalize="words"
            disabled={route.params.mode === 'edit'}
            onChangeText={setName}
            placeholder="Nome do cliente"
            required
            value={name}
          />
        </FormField>
        <CurrencyInput
          helperText={
            client?.hasIncompleteAddress
              ? 'Preencha o endereço para habilitar mapas e rotas.'
              : undefined
          }
          label="Preço personalizado"
          onChangeText={setPrice}
          placeholder="0,00"
          required
          value={price}
        />
        <Input
          autoCapitalize="sentences"
          label="Endereço"
          onChangeText={setAddress}
          placeholder="Endereço completo"
          required
          value={address}
        />
        {formError || error ? (
          <ErrorState description={formError ?? error} title="Não foi possível salvar" />
        ) : null}
        <PrimaryButton
          fullWidth
          loading={saving}
          onPress={() => void handleSave()}
          style={{ marginTop: theme.spacing.lg }}
        >
          Salvar configuração
        </PrimaryButton>
        {client?.currentPrice !== undefined ? (
          <Text
            style={[
              theme.typography.footnote,
              { color: theme.colors.textSecondary, marginTop: theme.spacing.md },
            ]}
          >
            Preço histórico atual: {hidden ? '••••' : formatCurrency(client.currentPrice)}
          </Text>
        ) : null}
      </View>
    </KeyboardScreen>
  );
}
