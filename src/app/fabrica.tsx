import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { NativeGlassBackButton } from '@/components/native';
import { PremiumScreen } from '@/components/premium';
import { SettingItem } from '@/features/settings/components/SettingItem';
import { SettingsSection } from '@/features/settings/components/SettingsSection';
import { useAppTheme } from '@/theme';

export default function FactoryRoute() {
  const { theme } = useAppTheme();
  const router = useRouter();

  const header = (
    <NativeGlassHeader
      leftActions={
        <NativeGlassBackButton
          accessibilityLabel="Voltar para Configurações"
          color={theme.colors.textPrimary}
          containerSize={theme.sizes.touchTargetMinimum}
          onPress={() => router.back()}
          size={theme.sizes.iconMedium}
        />
      }
      mode="transparent"
      title="Fábrica"
    />
  );

  return (
    <PremiumScreen contentContainerStyle={styles.content} overlayHeader={header} progressiveBlur>
      <View style={[styles.section, { marginTop: theme.spacing.md }]}>
        <SettingsSection>
          <SettingItem
            fallbackIcon="cash-outline"
            onPress={() => router.push('/fabrica-valor-balde')}
            systemName="dollarsign.circle"
            title="Valor do balde"
          />
          <SettingItem
            fallbackIcon="cart-outline"
            isLast
            onPress={() => router.push('/fabrica-compras')}
            systemName="cart"
            title="Compras"
          />
        </SettingsSection>
      </View>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  section: { gap: 8 },
});
