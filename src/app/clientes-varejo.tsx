import { Stack, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ListItem } from '@/components/lists';
import { NativeGlassHeader } from '@/components/layout';
import {
  NativeCardContextMenu,
  NativeGlassIconButton,
  NativeRetailClientFormSheet,
  type NativeRetailClientFormValues,
} from '@/components/native';
import { ConfirmationDialog } from '@/components/overlays';
import { PremiumCard, PremiumScreen } from '@/components/premium';
import { SettingsSection } from '@/features/settings/components/SettingsSection';
import OpenPaymentClientIcon from '@/features/open-payments/components/OpenPaymentClientIcon';
import { useRetailClients } from '@/hooks/useRetailClients';
import { getCardSurfaceColor, useAppTheme } from '@/theme';
import type { RetailClient, RetailClientDraft } from '@/types/data';
import { normalizeMoney } from '@/utils/data';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

function toDraft(values: NativeRetailClientFormValues): RetailClientDraft {
  const feeText = values.defaultDeliveryFee.trim();
  const fee = feeText ? normalizeMoney(feeText) : undefined;
  if (feeText && (fee === undefined || fee < 0)) {
    throw new Error('A taxa padrão de entrega deve ser zero ou maior.');
  }

  return {
    address: values.address,
    defaultDeliveryFee: fee,
    name: values.name,
    phone: values.phone,
    referral: values.hasReferral
      ? {
          hasReferral: true,
          referredByName: values.referredByName,
          sourceType: values.sourceType,
        }
      : undefined,
  };
}

export function retailClientFormValues(
  client?: RetailClient,
): Partial<NativeRetailClientFormValues> {
  return client
    ? {
        address: client.address ?? '',
        defaultDeliveryFee:
          client.defaultDeliveryFee === undefined ? '' : String(client.defaultDeliveryFee),
        hasReferral: client.referral?.hasReferral ?? false,
        name: client.name,
        phone: client.phone ?? '',
        referredByName: client.referral?.referredByName ?? '',
        sourceType: client.referral?.sourceType ?? '',
      }
    : {};
}

export default function RetailClientsRoute() {
  const { resolvedMode, theme } = useAppTheme();
  const { enabled: testModeEnabled } = useTestModePresentation();
  const router = useRouter();
  const { clients, error, loading, reload, create, remove } = useRetailClients();
  const [formVisible, setFormVisible] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<RetailClient | null>(null);
  const [deleteError, setDeleteError] = useState<string>();
  const [deleting, setDeleting] = useState(false);

  const handleCreateClient = useCallback(
    async (values: NativeRetailClientFormValues) => {
      if (testModeEnabled) return;
      await create(toDraft(values));
    },
    [create, testModeEnabled],
  );

  const handleDeleteClient = useCallback(async () => {
    if (!clientToDelete || testModeEnabled) return;
    setDeleting(true);
    setDeleteError(undefined);
    try {
      await remove(clientToDelete.clientId);
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
  }, [clientToDelete, remove, testModeEnabled]);

  const handleOpenCreate = useCallback(() => {
    triggerLightImpactHaptic();
    setFormVisible(true);
  }, []);

  const header = <NativeGlassHeader mode="transparent" title="Clientes" />;
  const clientCardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surface);
  const clientCardRadius = theme.radius.xl + theme.spacing.sm;
  const clientRowHeight = 54 + theme.spacing.sm * 2;
  const stateTextStyle = { color: theme.colors.textSecondary };

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel="Adicionar cliente Varejo"
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
          <Text style={[theme.typography.body, stateTextStyle]}>Carregando clientes...</Text>
        ) : error ? (
          <View style={styles.errorState}>
            <Text style={[theme.typography.body, stateTextStyle]}>{error}</Text>
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
              {clients.length ? (
                <SettingsSection>
                  {clients.map((client) => {
                    const renderClientRow = (preview = false) => (
                      <View
                        style={[
                          styles.clientRow,
                          {
                            backgroundColor: preview ? clientCardSurface : 'transparent',
                            borderRadius: clientCardRadius,
                            height: clientRowHeight,
                            overflow: preview ? 'hidden' : undefined,
                            width: '100%',
                          },
                          preview ? styles.clientPreviewInset : undefined,
                        ]}
                      >
                        <ListItem
                          accessibilityLabel={client.name}
                          leading={<OpenPaymentClientIcon />}
                          onPress={() =>
                            router.push({
                              params: { clientId: client.clientId },
                              pathname: '/clientes-varejo/[clientId]',
                            })
                          }
                          style={{ height: clientRowHeight, width: '100%' }}
                          title={client.name}
                          trailing={
                            <View
                              style={[
                                styles.clientChevronSlot,
                                {
                                  height: theme.sizes.touchTargetMinimum,
                                  width: theme.sizes.iconSmall,
                                },
                              ]}
                            >
                              <Ionicons
                                color={theme.colors.textTertiary}
                                name="chevron-forward"
                                size={theme.sizes.iconSmall}
                              />
                            </View>
                          }
                        />
                      </View>
                    );

                    return (
                      <View
                        key={client.clientId}
                        style={[
                          styles.clientContextContainer,
                          {
                            backgroundColor: clientCardSurface,
                            borderRadius: clientCardRadius,
                            height: clientRowHeight,
                            overflow: 'hidden',
                            width: '100%',
                          },
                        ]}
                      >
                        <NativeCardContextMenu
                          actions={[
                            {
                              destructive: true,
                              disabled: testModeEnabled,
                              id: 'delete-retail-client',
                              onPress: () => {
                                setDeleteError(undefined);
                                setClientToDelete(client);
                              },
                              systemImage: 'trash',
                              title: 'Excluir cliente',
                            },
                          ]}
                          matchContents={{ horizontal: true, vertical: false }}
                          preview={renderClientRow(true)}
                          style={[
                            styles.clientContextMenu,
                            { borderRadius: clientCardRadius, height: clientRowHeight },
                          ]}
                        >
                          {renderClientRow()}
                        </NativeCardContextMenu>
                      </View>
                    );
                  })}
                </SettingsSection>
              ) : (
                <Text style={[theme.typography.body, styles.emptyState, stateTextStyle]}>
                  Nenhum cliente Varejo cadastrado.
                </Text>
              )}
            </PremiumCard>
          </View>
        )}
      </PremiumScreen>
      <NativeRetailClientFormSheet
        mode="create"
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
          'Somente o cliente Varejo será removido. Clientes Atacado e demais dados permanecerão intactos.'
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
  clientChevronSlot: { alignItems: 'center', justifyContent: 'center' },
  clientContextContainer: { overflow: 'hidden' },
  clientContextMenu: { width: '100%' },
  clientPreviewInset: { paddingLeft: 20, paddingRight: 14 },
  clientRow: { width: '100%' },
  content: { flexGrow: 1 },
  emptyState: { padding: 24, textAlign: 'center' },
  errorState: { alignItems: 'center', gap: 12 },
});
