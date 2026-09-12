import { Stack, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import {
  NativeCardContextMenu,
  NativeClientFormSheet,
  NativeGlassIconButton,
  type NativeClientFormValues,
} from '@/components/native';
import { ConfirmationDialog } from '@/components/overlays';
import { PremiumCard, PremiumScreen } from '@/components/premium';
import { SettingItem } from '@/features/settings/components/SettingItem';
import { SettingsSection } from '@/features/settings/components/SettingsSection';
import { useClients } from '@/hooks/useClients';
import { useAppTheme } from '@/theme';
import type { ClientModel } from '@/types/data';
import { normalizeMoney } from '@/utils/data';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

export default function ClientsRoute() {
  const { theme } = useAppTheme();
  const { enabled: testModeEnabled } = useTestModePresentation();
  const router = useRouter();
  const { clients, error, loading, reload, removeCustomConfiguration, saveCustomClient } =
    useClients();
  const [formVisible, setFormVisible] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<ClientModel | null>(null);
  const [deleteError, setDeleteError] = useState<string>();
  const [deleting, setDeleting] = useState(false);

  const handleCreateClient = useCallback(
    async ({ address, bucketPrice, name, usesBoleto, usesInvoice }: NativeClientFormValues) => {
      if (testModeEnabled) return;
      const price = normalizeMoney(bucketPrice);
      if (!name.trim()) throw new Error('Informe o nome do cliente.');
      if (price === undefined || price <= 0) {
        throw new Error('Informe um preço maior que zero.');
      }
      if (!address.trim()) throw new Error('Informe o endereço do cliente.');
      await saveCustomClient(name, price, address, usesInvoice, usesBoleto);
    },
    [saveCustomClient, testModeEnabled],
  );

  const handleDeleteClient = useCallback(async () => {
    if (!clientToDelete || testModeEnabled) return;

    setDeleting(true);
    setDeleteError(undefined);
    try {
      await removeCustomConfiguration(clientToDelete);
      setClientToDelete(null);
    } catch (deleteClientError) {
      setDeleteError(
        deleteClientError instanceof Error
          ? deleteClientError.message
          : 'Não foi possível excluir o cliente.',
      );
    } finally {
      setDeleting(false);
    }
  }, [clientToDelete, removeCustomConfiguration, testModeEnabled]);

  const handleOpenCreate = useCallback(() => {
    triggerLightImpactHaptic();
    setFormVisible(true);
  }, []);

  const header = <NativeGlassHeader mode="transparent" title="Clientes" />;

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel="Adicionar cliente"
          icon="plus"
          onPress={handleOpenCreate}
        />
      </Stack.Toolbar>
      <PremiumScreen
        contentContainerStyle={[styles.content, { backgroundColor: theme.colors.background }]}
        overlayHeader={header}
        progressiveBlur
      >
        {loading ? (
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
            Carregando clientes...
          </Text>
        ) : error ? (
          <View style={styles.errorState}>
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
              {error}
            </Text>
            <NativeGlassIconButton
              accessibilityLabel="Tentar novamente"
              color={theme.colors.textPrimary}
              fallbackIcon="refresh"
              interactiveGlass
              onPress={() => {
                triggerLightImpactHaptic();
                void reload();
              }}
              size={theme.sizes.iconMedium}
              systemImage="arrow.clockwise"
            />
          </View>
        ) : (
          <View style={{ marginTop: theme.spacing.xl }}>
            <PremiumCard
              style={{
                borderRadius: theme.radius.xl + theme.spacing.md,
                padding: theme.spacing.sm,
              }}
            >
              <SettingsSection>
                {clients.map((client, index) => (
                  <NativeCardContextMenu
                    actions={[
                      {
                        destructive: true,
                        disabled: testModeEnabled,
                        id: 'delete-client',
                        onPress: () => {
                          setDeleteError(undefined);
                          setClientToDelete(client);
                        },
                        systemImage: 'trash',
                        title: 'Excluir cliente',
                      },
                    ]}
                    key={client.clientId}
                    style={{ width: '100%' }}
                  >
                    <SettingItem
                      fallbackIcon="person"
                      isLast={index === clients.length - 1}
                      leadingInset={theme.spacing.xs}
                      onPress={() =>
                        router.push({
                          params: {
                            clientId: client.clientId,
                            clientName: client.canonicalName,
                          },
                          pathname: '/clientes/[clientId]',
                        })
                      }
                      systemName="person.crop.circle"
                      title={client.canonicalName}
                      trailingInset={theme.spacing.xs}
                    />
                  </NativeCardContextMenu>
                ))}
              </SettingsSection>
            </PremiumCard>
          </View>
        )}
      </PremiumScreen>
      <NativeClientFormSheet
        onSubmit={handleCreateClient}
        onVisibleChange={setFormVisible}
        visible={formVisible}
      />
      <ConfirmationDialog
        confirmLabel="Excluir cliente"
        destructive
        loading={deleting}
        message={
          deleteError ??
          'Somente o cliente do catálogo ativo será removido. Entregas, pagamentos e histórico permanecerão intactos.'
        }
        onCancel={() => setClientToDelete(null)}
        onConfirm={() => void handleDeleteClient()}
        title="Confirmar exclusão"
        visible={Boolean(clientToDelete)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  errorState: { alignItems: 'center', gap: 12 },
});
