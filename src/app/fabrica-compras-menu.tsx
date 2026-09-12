import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { NativeGlassBackButton } from '@/components/native';
import { PremiumCard, PremiumScreen } from '@/components/premium';
import { SettingItem } from '@/features/settings/components/SettingItem';
import { SettingsSection } from '@/features/settings/components/SettingsSection';
import { useAppTheme } from '@/theme';

type FactoryPurchasesMenuRouteProps = {
  nativeHeader?: boolean;
  navigationPaths?: {
    register: string;
    purchases: string;
  };
};

export function FactoryPurchasesMenuRoute({
  nativeHeader = true,
  navigationPaths,
}: FactoryPurchasesMenuRouteProps = {}) {
  const { theme } = useAppTheme();
  const router = useRouter();
  const paths = navigationPaths ?? {
    register: '/fabrica-compras-registrar',
    purchases: '/fabrica-compras',
  };

  const handleOpenRegister = () => {
    router.push(paths.register);
  };

  const handleOpenPurchases = () => {
    router.push(paths.purchases);
  };

  const header = (
    <NativeGlassHeader
      leftActions={
        nativeHeader ? undefined : (
          <NativeGlassBackButton
            accessibilityLabel="Voltar para Fábrica"
            color={theme.colors.textPrimary}
            containerSize={theme.sizes.touchTargetMinimum}
            onPress={() => router.back()}
            size={theme.sizes.iconMedium}
          />
        )
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

export default FactoryPurchasesMenuRoute;

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingTop: 32 },
});
