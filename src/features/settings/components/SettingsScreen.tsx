import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { NativeGlassMenu } from '@/components/native';
import { PremiumCard, PremiumScreen } from '@/components/premium';
import { useSession } from '@/providers';
import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';

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

  const settingsMenu = (
    <NativeGlassMenu
      accessibilityLabel="Mais opções das Configurações"
      actions={[
        {
          destructive: true,
          id: 'logout',
          onPress: () => void handleSignOut(),
          systemImage: 'rectangle.portrait.and.arrow.right',
          title: 'Sair da conta',
        },
      ]}
      color={theme.colors.textPrimary}
      containerSize={theme.sizes.touchTargetMinimum}
      fallbackIcon="ellipsis-horizontal"
      size={theme.sizes.iconMedium}
      style={{
        height: theme.sizes.touchTargetMinimum,
        width: theme.sizes.touchTargetMinimum,
      }}
      systemImage="ellipsis"
      trigger={
        <Pressable
          accessible
          accessibilityLabel="Mais opções das Configurações"
          accessibilityRole="button"
          onPress={triggerLightImpactHaptic}
          style={[
            styles.menuTrigger,
            {
              height: theme.sizes.touchTargetMinimum,
              width: theme.sizes.touchTargetMinimum,
            },
          ]}
        >
          <Ionicons
            color={theme.colors.textPrimary}
            name="ellipsis-horizontal"
            size={theme.sizes.iconMedium}
          />
        </Pressable>
      }
    />
  );

  const header = (
    <NativeGlassHeader
      includeTopSafeArea={false}
      largeTitle
      mode="transparent"
      titleStyle={{
        fontFamily: 'System',
        fontSize: 32,
        fontWeight: '700',
        marginLeft: -(theme.spacing.xxs * 2),
      }}
      title="Configurações"
    />
  );
  const menuHeader = (
    <NativeGlassHeader includeTopSafeArea mode="transparent" rightActions={settingsMenu} title="" />
  );

  return (
    <PremiumScreen
      startupDiagnosticsLabel="Configuracoes"
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
              onPress={() => router.push('/clientes')}
              systemName="person.2"
              title="Clientes"
            />
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
              onPress={() => router.push('/custos')}
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
              fallbackIcon="archive-outline"
              onPress={() => router.push('/backup')}
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
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  header: { minHeight: 44 },
  menuTrigger: { alignItems: 'center', justifyContent: 'center' },
});
