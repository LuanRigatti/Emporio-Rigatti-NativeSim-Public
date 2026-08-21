import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { NativeGlassBackButton } from '@/components/native';
import { PremiumCard, PremiumScreen } from '@/components/premium';
import { SettingItem } from '@/features/settings/components/SettingItem';
import { SettingsSection } from '@/features/settings/components/SettingsSection';
import { useAppTheme } from '@/theme';

export default function FactoryPurchasesMenuRoute() {
  const { theme } = useAppTheme();
  const router = useRouter();

  const handleOpenRegister = () => {
    router.push('/fabrica-compras-registrar');
  };

  const handleOpenPurchases = () => {
    router.push('/fabrica-compras');
  };

  const header = (
    <NativeGlassHeader
      leftActions={
        <NativeGlassBackButton
          accessibilityLabel="Voltar para Fábrica"
          color={theme.colors.textPrimary}
          containerSize={theme.sizes.touchTargetMinimum}
          onPress={() => router.back()}
          size={theme.sizes.iconMedium}
        />
      }
      mode="transparent"
      title="Compras e Fábrica"
    />
  );

  return (
    <PremiumScreen contentContainerStyle={styles.content} overlayHeader={header} progressiveBlur>
      <PremiumCard
        style={{
          borderRadius: theme.radius.xl + theme.spacing.md,
          marginTop: theme.spacing.md,
          padding: theme.spacing.sm,
        }}
      >
        <SettingsSection>
          <SettingItem
            fallbackIcon="cart-outline"
            onPress={handleOpenRegister}
            systemName="cart"
            title="Registrar compra"
          />
          <SettingItem
            fallbackIcon="receipt-outline"
            isLast
            onPress={handleOpenPurchases}
            systemName="doc.text"
            title="Compras efetuadas"
          />
        </SettingsSection>
      </PremiumCard>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingTop: 32 },
});
