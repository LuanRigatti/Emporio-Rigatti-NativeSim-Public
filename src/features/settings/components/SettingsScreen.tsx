import { Stack, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { PremiumCard, PremiumScreen } from '@/components/premium';
import { useSession } from '@/providers';
import { useAppTheme } from '@/theme';

import { SettingItem } from './SettingItem';
import { SettingsSection } from './SettingsSection';

export function SettingsScreen() {
  const { theme } = useAppTheme();
  const router = useRouter();
  const { isAuthenticated, signOutMock } = useSession();

  const handleSignOut = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }

    await signOutMock();
    router.replace('/login');
  }, [isAuthenticated, router, signOutMock]);

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
  const menuHeader = <NativeGlassHeader includeTopSafeArea mode="transparent" title="" />;

  const settingsToolbar = (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Menu
        accessibilityLabel="Mais opções das Configurações"
        icon="ellipsis"
        separateBackground={false}
        title="Mais opções das Configurações"
      >
        <Stack.Toolbar.MenuAction
          destructive
          icon="rectangle.portrait.and.arrow.right"
          onPress={() => void handleSignOut()}
        >
          Sair da conta
        </Stack.Toolbar.MenuAction>
      </Stack.Toolbar.Menu>
    </Stack.Toolbar>
  );

  return (
    <>
      {settingsToolbar}
      <PremiumScreen
        contentContainerStyle={[
          styles.content,
          {
            gap: 0,
            marginTop: theme.spacing.xxxl + theme.spacing.xl + 2,
            paddingTop: theme.spacing.sm,
          },
        ]}
        overlayHeader={menuHeader}
        overlayHeaderUnderlay
        progressiveBlurHeight={
          theme.spacing.xxxl + theme.spacing.xs * 2 + theme.spacing.xl + theme.spacing.sm
        }
        progressiveBlurTopOffset={0}
        progressiveBlur
      >
        <View style={{ gap: theme.spacing.xl, marginTop: 0 }}>
          <View style={styles.header}>{header}</View>
          <PremiumCard
            style={{
              borderRadius: theme.radius.xl + theme.spacing.md,
              padding: theme.spacing.sm,
            }}
          >
            <SettingsSection>
              <SettingItem
                fallbackIcon="person"
                onPress={() => router.push('/configuracoes/clientes')}
                systemName="person.2"
                title="Clientes"
              />
              <SettingItem
                fallbackIcon="business"
                onPress={() => router.push('/configuracoes/dados-empresa')}
                systemName="building.2"
                title="Dados da Empresa"
              />
              <SettingItem
                fallbackIcon="business"
                onPress={() => router.push('/configuracoes/fabrica')}
                systemName="building.2"
                title="Fábrica"
              />
              <SettingItem
                fallbackIcon="calculator"
                onPress={() => router.push('/configuracoes/dados')}
                systemName="chart.bar"
                title="Dados"
              />
              <SettingItem
                fallbackIcon="location-outline"
                onPress={() => router.push('/configuracoes/localizacao')}
                systemName="location"
                title="Localização"
              />
              <SettingItem
                fallbackIcon="cube-outline"
                onPress={() => router.push('/configuracoes/estoque')}
                systemName="shippingbox"
                title="Estoque"
              />
              <SettingItem
                fallbackIcon="finger-print-outline"
                onPress={() => router.push('/configuracoes/face-id')}
                systemName="faceid"
                title="Face ID"
              />
              <SettingItem
                fallbackIcon="flask-outline"
                onPress={() => router.push('/configuracoes/modo-teste')}
                systemName="testtube.2"
                title="Modo Teste"
              />
              <SettingItem
                fallbackIcon="archive-outline"
                onPress={() => router.push('/configuracoes/backup')}
                systemName="externaldrive"
                title="Backup"
              />
              <SettingItem
                fallbackIcon="sparkles-outline"
                onPress={() => router.push('/teste-morph')}
                systemName="sparkles"
                title="Teste Morph"
              />
            </SettingsSection>
          </PremiumCard>
        </View>
      </PremiumScreen>
    </>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  header: { minHeight: 44 },
});
