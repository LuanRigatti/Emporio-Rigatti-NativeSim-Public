import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import {
  NativeClientFormSheet,
  NativeGlassBackButton,
  NativeGlassIconButton,
  type NativeClientFormValues,
} from '@/components/native';
import { PremiumScreen } from '@/components/premium';
import { SettingItem } from '@/features/settings/components/SettingItem';
import { SettingsSection } from '@/features/settings/components/SettingsSection';
import { useClients } from '@/hooks/useClients';
import { useAppTheme } from '@/theme';
import { normalizeMoney } from '@/utils/data';
import { triggerLightImpactHaptic } from '@/utils/haptics';

export default function ClientsRoute() {
  const { theme } = useAppTheme();
  const router = useRouter();
  const { clients, error, loading, reload, saveCustomClient } = useClients();
  const [formVisible, setFormVisible] = useState(false);

  const handleCreateClient = useCallback(
    async ({ address, bucketPrice, name }: NativeClientFormValues) => {
      const price = normalizeMoney(bucketPrice);
      if (!name.trim()) throw new Error('Informe o nome do cliente.');
      if (price === undefined || price <= 0) {
        throw new Error('Informe um pre\u00e7o maior que zero.');
      }
      if (!address.trim()) throw new Error('Informe o endere\u00e7o do cliente.');
      await saveCustomClient(name, price, address);
    },
    [saveCustomClient],
  );

  const header = (
    <NativeGlassHeader
      leftActions={
        <NativeGlassBackButton
          accessibilityLabel="Voltar para Configura\u00e7\u00f5es"
          color={theme.colors.textPrimary}
          containerSize={theme.sizes.touchTargetMinimum}
          onPress={() => router.back()}
          size={theme.sizes.iconMedium}
        />
      }
      mode="transparent"
      rightActions={
        <NativeGlassIconButton
          accessibilityLabel="Adicionar cliente"
          color={theme.colors.textPrimary}
          containerSize={theme.sizes.touchTargetMinimum}
          fallbackIcon="add"
          interactiveGlass
          onPress={() => {
            triggerLightImpactHaptic();
            setFormVisible(true);
          }}
          size={theme.sizes.iconMedium}
          systemImage="plus"
        />
      }
      title="Clientes"
    />
  );

  return (
    <>
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
              onPress={() => void reload()}
              size={theme.sizes.iconMedium}
              systemImage="arrow.clockwise"
            />
          </View>
        ) : (
          <View style={{ marginTop: theme.spacing.md }}>
            <SettingsSection>
              {clients.map((client, index) => (
                <SettingItem
                  fallbackIcon="person"
                  isLast={index === clients.length - 1}
                  key={client.clientId}
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
                />
              ))}
            </SettingsSection>
          </View>
        )}
      </PremiumScreen>
      <NativeClientFormSheet
        onSubmit={handleCreateClient}
        onVisibleChange={setFormVisible}
        visible={formVisible}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  errorState: { alignItems: 'center', gap: 12 },
});
