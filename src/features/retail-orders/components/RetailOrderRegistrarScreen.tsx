import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { getNativeLargeTitleStyle, NativeGlassHeader } from '@/components/layout';
import { ProgressiveCollapsibleScreen } from '@/components/premium';
import HomeShortcutCard from '@/features/home/components/HomeShortcutCard';
import { useAppSafeAreaInsets } from '@/providers';
import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';

export function RetailOrderRegistrarLauncher() {
  const { theme } = useAppTheme();
  const insets = useAppSafeAreaInsets();
  const router = useRouter();

  const header = (
    <NativeGlassHeader
      includeTopSafeArea={false}
      largeTitle
      mode="transparent"
      titleStyle={getNativeLargeTitleStyle(theme.spacing.xxs)}
      title="Registrar"
    />
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ProgressiveCollapsibleScreen
        compactTitle="Registrar"
        contentGap={0}
        contentTopInset={theme.spacing.xxxl + theme.spacing.xl + 2}
        largeTitle={<View style={styles.header}>{header}</View>}
        nativeTabRoot
        scrollContentContainerStyle={{
          paddingBottom: theme.layout.tabBarHeight + insets.bottom + theme.spacing.lg,
        }}
      >
        <View style={[styles.body, { marginTop: theme.spacing.md * 2 - theme.spacing.xs / 2 - 4 }]}>
          <HomeShortcutCard
            accessibilityLabel="Abrir Registrar Pedido Varejo"
            icon={<Ionicons color={theme.colors.textSecondary} name="cart-outline" size={21} />}
            label="Registrar pedido"
            onPress={() => {
              triggerLightImpactHaptic();
              router.push('/registrar-pedido-varejo');
            }}
            trailing={
              <Ionicons
                color={theme.colors.textSecondary}
                name="chevron-forward"
                size={theme.sizes.iconMedium}
              />
            }
          />
        </View>
      </ProgressiveCollapsibleScreen>
    </View>
  );
}

export default RetailOrderRegistrarLauncher;

const styles = StyleSheet.create({
  body: { width: '100%' },
  header: { minHeight: 44 },
  screen: { flex: 1 },
});
