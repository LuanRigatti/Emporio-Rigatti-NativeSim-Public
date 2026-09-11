import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { NativeGlassBackButton } from '@/components/native';
import { PremiumCard, PremiumScreen } from '@/components/premium';
import { SettingItem } from '@/features/settings/components/SettingItem';
import { SettingsSection } from '@/features/settings/components/SettingsSection';
import { useAppTheme } from '@/theme';

type FactoryRouteProps = {
  nativeHeader?: boolean;
  navigationPaths?: {
    bucketValue: string;
    purchasesMenu: string;
  };
};

export function FactoryRoute({ nativeHeader = false, navigationPaths }: FactoryRouteProps = {}) {
  const { theme } = useAppTheme();
  const router = useRouter();
  const paths = navigationPaths ?? {
    bucketValue: '/fabrica-valor-balde',
    purchasesMenu: '/fabrica-compras-menu',
  };

  const header = (
    <NativeGlassHeader
      leftActions={
        nativeHeader ? undefined : (
          <NativeGlassBackButton
            accessibilityLabel="Voltar para Configurações"
            color={theme.colors.textPrimary}
            containerSize={theme.sizes.touchTargetMinimum}
            onPress={() => router.back()}
            size={theme.sizes.iconMedium}
          />
        )
      }
      mode="transparent"
      title="Fábrica"
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
            fallbackIcon="cash-outline"
            onPress={() => router.push(paths.bucketValue)}
            systemName="dollarsign.circle"
            title="Valor do balde"
          />
          <SettingItem
            fallbackIcon="cart-outline"
            isLast
            onPress={() => router.push(paths.purchasesMenu)}
            systemName="cart"
            title="Compras"
          />
        </SettingsSection>
      </PremiumCard>
    </PremiumScreen>
  );
}

export default FactoryRoute;

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
});
