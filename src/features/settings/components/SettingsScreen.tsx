import { Stack, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { NativeHomeToolbarActions } from '@/components/native';
import { PremiumCard, ProgressiveCollapsibleScreen } from '@/components/premium';
import { useAppMode, useAppSafeAreaInsets, useAuth } from '@/providers';
import { useHomeProfileSheet } from '@/features/home/profile/HomeProfileSheetProvider';
import { getCardSurfaceColor, useAppTheme } from '@/theme';

import { SettingItem } from './SettingItem';
import { SettingsSection } from './SettingsSection';

export function SettingsScreen() {
  const { resolvedMode, theme } = useAppTheme();
  const { mode } = useAppMode();
  const insets = useAppSafeAreaInsets();
  const { user } = useAuth();
  const { openProfileSheet } = useHomeProfileSheet();
  const settingsCardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surface);
  const router = useRouter();

  const header = (
    <NativeGlassHeader
      includeTopSafeArea={false}
      largeTitle
      mode="transparent"
      titleStyle={{
        fontFamily: 'System',
        fontSize: 36,
        fontWeight: '700',
        marginLeft: -(theme.spacing.xxs * 2),
      }}
      title="Configurações"
    />
  );
  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.View>
          <NativeHomeToolbarActions
            accessibilityHint="Exibe os dados da conta e a opção de sair"
            accessibilityLabel="Abrir perfil da conta"
            foregroundColor={theme.colors.textPrimary}
            imageUri={user?.photoUrl}
            name={user?.displayName?.trim() || 'Conta'}
            onProfilePress={openProfileSheet}
            showSearch={false}
          />
        </Stack.Toolbar.View>
      </Stack.Toolbar>
      <ProgressiveCollapsibleScreen
        compactTitle="Configurações"
        contentGap={0}
        contentTopInset={theme.spacing.xxxl + theme.spacing.xl + 2 + theme.spacing.sm}
        largeTitle={
          <View style={[styles.header, { marginBottom: theme.spacing.xl }]}>{header}</View>
        }
        nativeTabRoot
        scrollContentContainerStyle={{
          paddingBottom: theme.layout.tabBarHeight + insets.bottom + theme.spacing.lg,
        }}
      >
        <PremiumCard
          style={{
            backgroundColor: settingsCardSurface,
            borderRadius: theme.radius.xl + theme.spacing.md,
            padding: theme.spacing.sm,
          }}
        >
          <SettingsSection>
            <SettingItem
              fallbackIcon="person"
              onPress={() => router.push(mode === 'retail' ? '/clientes-varejo' : '/clientes')}
              systemName="person.2"
              title="Clientes"
            />
            {mode === 'retail' ? (
              <SettingItem
                fallbackIcon="cube-outline"
                onPress={() => router.push('/catalogo-varejo')}
                systemName="shippingbox"
                title="Catálogo"
              />
            ) : null}
            {mode === 'retail' ? (
              <SettingItem
                fallbackIcon="calculator-outline"
                onPress={() => router.push('/custos-varejo')}
                systemName="chart.bar.xaxis"
                title="Custos"
              />
            ) : null}
            <SettingItem
              fallbackIcon="business"
              onPress={() => router.push('/dados-empresa')}
              systemName="building.2"
              title="Dados da Empresa"
            />
            <SettingItem
              fallbackIcon="business"
              onPress={() => router.push('/fabrica')}
              systemName="building.2"
              title="Fábrica"
            />
            <SettingItem
              fallbackIcon="calculator"
              onPress={() => router.push('/dados')}
              systemName="chart.bar"
              title="Dados"
            />
            <SettingItem
              fallbackIcon="location-outline"
              onPress={() => router.push('/localizacao')}
              systemName="location"
              title="Localização"
            />
            <SettingItem
              fallbackIcon="cube-outline"
              onPress={() => router.push('/estoque')}
              systemName="shippingbox"
              title="Estoque"
            />
            <SettingItem
              fallbackIcon="finger-print-outline"
              onPress={() => router.push('/face-id')}
              systemName="faceid"
              title="Face ID"
            />
            <SettingItem
              fallbackIcon="settings-outline"
              onPress={() => router.push('/sistema')}
              systemName="gearshape"
              title="Sistema"
            />
          </SettingsSection>
        </PremiumCard>
      </ProgressiveCollapsibleScreen>
    </>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 44 },
});
