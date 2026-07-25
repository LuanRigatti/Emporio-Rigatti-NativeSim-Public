import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { FlatList, View } from 'react-native';

import {
  ClientCard,
  EmptyState,
  ErrorState,
  IconButton,
  LargeTitleHeader,
  Loading,
  Screen,
  SearchBar,
} from '@/components';
import { useClients } from '@/hooks/useClients';
import { useFinancialPrivacy } from '@/hooks/useFinancialPrivacy';
import { formatCurrency, maskFinancialValue } from '@/utils/data';
import { useAppTheme } from '@/theme';
import type { ClientsStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<ClientsStackParamList, 'ClientsHome'>;

export function ClientsHome({ navigation }: Props) {
  const { theme } = useAppTheme();
  const { hidden } = useFinancialPrivacy();
  const [search, setSearch] = useState('');
  const { clients, loading, refreshing, error, reload } = useClients({ search });

  return (
    <Screen>
      <LargeTitleHeader
        rightAction={
          <IconButton
            accessibilityLabel="Cadastrar cliente"
            icon={
              <Ionicons
                color={theme.colors.primary}
                name="person-add-outline"
                size={theme.sizes.iconMedium}
              />
            }
            onPress={() => navigation.navigate('ClientForm', { mode: 'create' })}
          />
        }
        subtitle="Clientes históricos e personalizados"
        title="Clientes"
      />
      <View style={{ paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.md, flex: 1 }}>
        <SearchBar
          clearable
          onChangeText={setSearch}
          onClear={() => setSearch('')}
          placeholder="Buscar cliente"
          value={search}
        />
        {loading ? (
          <Loading label="Carregando clientes" size="large" style={{ flex: 1 }} />
        ) : error ? (
          <ErrorState
            description={error}
            onRetry={() => void reload()}
            title="Não foi possível carregar clientes"
          />
        ) : clients.length === 0 ? (
          <EmptyState
            description="Tente outra busca ou cadastre uma configuração personalizada."
            title="Nenhum cliente encontrado"
          />
        ) : (
          <FlatList
            contentContainerStyle={{ gap: theme.spacing.sm, paddingVertical: theme.spacing.lg }}
            data={clients}
            keyExtractor={(item) => item.clientId}
            onRefresh={() => void reload()}
            refreshing={refreshing}
            renderItem={({ item }) => (
              <ClientCard
                address={item.address ?? 'Endereço pendente'}
                name={item.canonicalName}
                onPress={() =>
                  navigation.navigate('ClientDetails', {
                    clientId: item.clientId,
                    clientName: item.canonicalName,
                  })
                }
                secondaryText={
                  item.currentPrice === undefined
                    ? 'Preço não disponível para a data selecionada'
                    : `Preço aplicável: ${maskFinancialValue(formatCurrency(item.currentPrice), hidden)}`
                }
              />
            )}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Screen>
  );
}
