import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { NativeGlassBackButton } from '@/components/native';
import { GlassCard, PremiumScreen } from '@/components/premium';
import { useAppTheme } from '@/theme';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import { OpenPaymentClientCards } from './OpenPaymentClientCards';
import { useOpenPaymentClients } from '../hooks/useOpenPaymentClients';

export function OpenPaymentClientsScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { currency: maskCurrency } = useTestModePresentation();
  const { clientCards, markDeliveryPaid, testModeEnabled, totalOpenAmount } =
    useOpenPaymentClients();

  const header = (
    <NativeGlassHeader
      leftActions={
        <NativeGlassBackButton
          accessibilityLabel="Voltar para Home"
          color={theme.colors.textPrimary}
          containerSize={theme.sizes.touchTargetMinimum}
          onPress={() => router.back()}
          size={theme.sizes.iconMedium}
        />
      }
      mode="transparent"
      title=""
    />
  );
  const pageTitle = (
    <NativeGlassHeader
      includeTopSafeArea={false}
      mode="transparent"
      largeTitle
      title="Em aberto"
      titleStyle={{
        fontFamily: 'System',
        fontSize: 36,
        fontWeight: '700',
        marginLeft: -(theme.spacing.xxs * 2),
      }}
    />
  );

  return (
    <PremiumScreen
      contentContainerStyle={[
        styles.screenContent,
        { gap: theme.spacing.xl, paddingBottom: theme.spacing.xxxl },
      ]}
      overlayHeader={header}
      overlayHeaderContentOffset={theme.sizes.touchTargetMinimum}
      progressiveBlur
    >
      <View
        style={[
          styles.content,
          {
            gap: theme.spacing.lg,
            marginTop: theme.spacing.xl + theme.spacing.xxl + theme.spacing.xxs * 2 + 2,
          },
        ]}
      >
        {pageTitle}
        {clientCards.length > 0 ? (
          <>
            <OpenPaymentClientCards
              clients={clientCards}
              onMarkAsPaid={markDeliveryPaid}
              testModeEnabled={testModeEnabled}
            />
            <GlassCard
              style={[
                styles.totalCard,
                {
                  borderRadius: theme.radius.lg,
                  marginRight: theme.spacing.xs,
                  marginTop: theme.spacing.xs + theme.spacing.md,
                  paddingHorizontal: theme.spacing.sm,
                  paddingVertical: theme.spacing.xs,
                },
              ]}
            >
              <Text
                style={[
                  theme.typography.body,
                  {
                    color: theme.colors.textPrimary,
                    fontSize: 16,
                    fontWeight: theme.typography.headline.fontWeight,
                  },
                ]}
              >
                {maskCurrency(totalOpenAmount)}
              </Text>
            </GlassCard>
          </>
        ) : (
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
            Nenhum recebimento em aberto
          </Text>
        )}
      </View>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: { flexGrow: 1 },
  content: { width: '100%' },
  totalCard: { alignSelf: 'flex-end' },
});
