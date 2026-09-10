import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { PremiumCard, PremiumScreen } from '@/components/premium';
import { getCardSurfaceColor, useAppTheme } from '@/theme';

import { SettingItem } from './SettingItem';
import { SettingsSection } from './SettingsSection';

export function SettingsScreen() {
  const { resolvedMode, theme } = useAppTheme();
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
  const menuHeader = <NativeGlassHeader includeTopSafeArea mode="transparent" title="" />;

  return (
    <>
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
              backgroundColor: settingsCardSurface,
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
                fallbackIcon="settings-outline"
                onPress={() => router.push('/configuracoes/sistema')}
                systemName="gearshape"
                title="Sistema"
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
