import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { NativeGlassBackButton } from '@/components/native';
import { PremiumScreen } from '@/components/premium';
import { useAppTheme } from '@/theme';

import { OpenPaymentClientCards } from './OpenPaymentClientCards';
import { useOpenPaymentClients } from '../hooks/useOpenPaymentClients';

export function OpenPaymentClientsScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { clientCards, markDeliveryPaid, testModeEnabled } = useOpenPaymentClients();

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
      title="Em aberto"
    />
  );

  return (
    <PremiumScreen
      contentContainerStyle={[
        styles.screenContent,
        { gap: theme.spacing.xl, paddingBottom: theme.spacing.xxxl },
      ]}
      overlayHeader={header}
      progressiveBlur
    >
      <View style={[styles.content, { marginTop: theme.spacing.xxl }]}>
        {clientCards.length > 0 ? (
          <OpenPaymentClientCards
            clients={clientCards}
            onMarkAsPaid={markDeliveryPaid}
            testModeEnabled={testModeEnabled}
          />
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
});
