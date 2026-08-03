import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { NativeGlassHeader } from '@/components/layout';
import { PremiumScreen } from '@/components/premium';
import { useAppTheme } from '@/theme';

import { SettingItem } from './SettingItem';
import { SettingsSection } from './SettingsSection';

export function SettingsScreen() {
  const { theme } = useAppTheme();
  const router = useRouter();
  const header = <NativeGlassHeader mode="transparent" title="Configurações" />;

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
            theme.sizes.touchTargetMinimum,
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
            isLast
            onPress={() => router.push('/custos')}
            systemName="chart.bar"
            title="Dados"
          />
        </SettingsSection>
      </View>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
});
