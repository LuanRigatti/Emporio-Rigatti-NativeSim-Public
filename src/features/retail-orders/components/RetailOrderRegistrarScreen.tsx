import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { NativeButton } from '@/components/native';
import { PremiumCard, PremiumScreen } from '@/components/premium';
import { useRetailOrderCatalog } from '@/hooks/useRetailOrderCatalog';
import { getCardSurfaceColor, useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';

import { RetailOrderPrimaryButton } from './RetailOrderPrimaryButton';

type RetailOrderRegistrarGuideKind = 'clients' | 'products';

function RetailOrderRegistrarGuide({ kind }: { kind: RetailOrderRegistrarGuideKind }) {
  const { resolvedMode, theme } = useAppTheme();
  const router = useRouter();
  const clientsGuide = kind === 'clients';
  const cardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surface);

  return (
    <PremiumCard
      style={[
        styles.guideCard,
        {
          backgroundColor: cardSurface,
          borderRadius: theme.radius.xl + theme.spacing.md,
          padding: theme.spacing.lg,
        },
      ]}
    >
      <Text style={[theme.typography.title3, { color: theme.colors.textPrimary }]}>
        {clientsGuide ? 'Cadastre um cliente Varejo' : 'Cadastre um produto Varejo'}
      </Text>
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
        {clientsGuide
          ? 'Selecione um cliente antes de criar um pedido.'
          : 'Adicione produtos ativos ao catálogo antes de criar um pedido.'}
      </Text>
      <NativeButton
        accessibilityLabel={clientsGuide ? 'Cadastrar cliente Varejo' : 'Cadastrar produto Varejo'}
        controlSize="large"
        color={theme.colors.contrastContent}
        glassTint={theme.colors.contrastSurface}
        haptic="light"
        label={clientsGuide ? 'Abrir Clientes Varejo' : 'Abrir Catálogo Varejo'}
        onPress={() => {
          triggerLightImpactHaptic();
          router.push(clientsGuide ? '/clientes-varejo' : '/catalogo-varejo');
        }}
        variant="primary"
      />
    </PremiumCard>
  );
}

export function RetailOrderRegistrarLauncher() {
  const { resolvedMode, theme } = useAppTheme();
  const router = useRouter();
  const catalog = useRetailOrderCatalog();
  const activeClients = catalog.clients.filter((client) => client.active);
  const activeProducts = catalog.products.filter((product) => product.active);
  const cardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surface);

  const openOrderPage = () => {
    if (!activeClients.length || !activeProducts.length || catalog.loading || catalog.error) return;
    triggerLightImpactHaptic();
    router.push('/registrar-pedido-varejo');
  };

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
      title="Registrar"
    />
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <PremiumScreen
        contentContainerStyle={[
          styles.content,
          { marginTop: theme.spacing.xxxl + theme.spacing.xl + 2 },
        ]}
        progressiveBlurHeight={
          theme.spacing.xxxl + theme.spacing.xs * 2 + theme.spacing.xl + theme.spacing.sm
        }
        progressiveBlurTopOffset={0}
        progressiveBlur
      >
        <View style={styles.header}>{header}</View>
        <View style={[styles.body, { marginTop: theme.spacing.md * 2 - theme.spacing.xs / 2 - 4 }]}>
          {catalog.loading ? (
            <PremiumCard style={[styles.card, { backgroundColor: cardSurface }]}>
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
                Carregando dados do Varejo...
              </Text>
            </PremiumCard>
          ) : catalog.error ? (
            <PremiumCard style={[styles.card, { backgroundColor: cardSurface }]}>
              <Text style={[theme.typography.body, { color: theme.colors.danger }]}>
                {catalog.error}
              </Text>
            </PremiumCard>
          ) : !activeClients.length ? (
            <RetailOrderRegistrarGuide kind="clients" />
          ) : !activeProducts.length ? (
            <RetailOrderRegistrarGuide kind="products" />
          ) : (
            <PremiumCard
              style={[
                styles.card,
                {
                  backgroundColor: cardSurface,
                  borderRadius: theme.radius.xl + theme.spacing.md,
                  paddingHorizontal: theme.spacing.lg,
                  paddingVertical: theme.spacing.md,
                },
              ]}
            >
              <RetailOrderPrimaryButton
                accessibilityLabel="Criar pedido Varejo"
                label="Novo pedido"
                onPress={openOrderPage}
              />
            </PremiumCard>
          )}
        </View>
      </PremiumScreen>
    </View>
  );
}

export default RetailOrderRegistrarLauncher;

const styles = StyleSheet.create({
  body: { gap: 16 },
  card: { gap: 12, width: '100%' },
  content: { flexGrow: 1 },
  guideCard: { gap: 12, width: '100%' },
  header: { minHeight: 44 },
  screen: { flex: 1 },
});
