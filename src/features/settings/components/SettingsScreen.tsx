import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { NativeGlassMenu } from '@/components/native';
import { PremiumScreen } from '@/components/premium';
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

  const header = (
    <NativeGlassHeader
      mode="transparent"
      rightActions={
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
      }
      title="Configurações"
    />
  );

  return (
    <PremiumScreen
      contentContainerStyle={[
        styles.content,
        { gap: theme.spacing.xxxl, paddingTop: theme.spacing.sm },
      ]}
      overlayHeader={header}
      overlayHeaderContentOffset={
        theme.typography.headline.lineHeight +
        theme.spacing.xxxl -
        theme.sizes.touchTargetMinimum +
        theme.spacing.xxs * 12
      }
      progressiveBlur
    >
      <View
        style={{
          marginTop:
            theme.typography.headline.lineHeight +
            theme.spacing.xxxl -
            theme.sizes.touchTargetMinimum +
            theme.spacing.md,
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
            isLast
            onPress={() => router.push('/estoque')}
            systemName="shippingbox"
            title="Estoque"
          />
        </SettingsSection>
      </View>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  menuTrigger: { alignItems: 'center', justifyContent: 'center' },
});
