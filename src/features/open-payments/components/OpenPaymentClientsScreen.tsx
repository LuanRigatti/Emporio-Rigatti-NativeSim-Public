import { Stack, useIsFocused, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { NativeGlassBackButton } from '@/components/native';
import { GlassCard, PremiumScreen, ProgressiveCollapsibleScreen } from '@/components/premium';
import { useAppTheme } from '@/theme';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';
import { NativeOpenPaymentContextMenuHostView } from 'native-card-context-menu';

import { OpenPaymentClientCards } from './OpenPaymentClientCards';
import { useOpenPaymentClients } from '../hooks/useOpenPaymentClients';

export function OpenPaymentClientsScreen({
  nativeHeader = false,
}: { nativeHeader?: boolean } = {}) {
  const router = useRouter();
  const isFocused = useIsFocused();
  const [isExpandedPeekPopOpen, setIsExpandedPeekPopOpen] = useState(false);
  const { theme } = useAppTheme();
  const { currency: maskCurrency } = useTestModePresentation();
  const {
    clientCards,
    markDeliveryPaid,
    paymentHistoryError,
    paymentHistoryLoading,
    testModeEnabled,
    totalOpenAmount,
  } = useOpenPaymentClients();

  const header = (
    <NativeGlassHeader
      leftActions={
        nativeHeader ? undefined : (
          <NativeGlassBackButton
            accessibilityLabel="Voltar para Home"
            color={theme.colors.textPrimary}
            containerSize={theme.sizes.touchTargetMinimum}
            onPress={() => router.back()}
            size={theme.sizes.iconMedium}
          />
        )
      }
      mode="transparent"
      title=""
    />
  );
  const totalCard =
    clientCards.length > 0 ? (
      <GlassCard
        style={[
          styles.totalCard,
          {
            borderRadius: theme.radius.lg,
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
              fontSize: 17,
              fontWeight: theme.typography.headline.fontWeight,
            },
          ]}
        >
          {maskCurrency(totalOpenAmount)}
        </Text>
      </GlassCard>
    ) : undefined;
  const pageTitle = (
    <NativeGlassHeader
      includeTopSafeArea={false}
      mode="transparent"
      largeTitle
      rightActions={totalCard}
      title="Em aberto"
      titleStyle={{
        fontFamily: 'System',
        fontSize: 36,
        fontWeight: '700',
        marginLeft: -(theme.spacing.xxs * 2),
      }}
    />
  );
  const clientCardsContent =
    clientCards.length > 0 ? (
      <OpenPaymentClientCards
        clients={clientCards}
        paymentHistoryError={paymentHistoryError}
        paymentHistoryLoading={paymentHistoryLoading}
        onMarkAsPaid={markDeliveryPaid}
        nativePeekPopEnabled={nativeHeader}
        testModeEnabled={testModeEnabled}
      />
    ) : (
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
        Nenhum recebimento em aberto
      </Text>
    );
  const originalContentTopOffset = theme.spacing.xl + theme.spacing.xxl + theme.spacing.xxs * 2 + 2;

  const content = (
    <View style={[styles.content, { gap: theme.spacing.lg, marginTop: originalContentTopOffset }]}>
      {pageTitle}
      {clientCardsContent}
    </View>
  );

  if (nativeHeader) {
    return (
      <>
        <Stack.Screen options={{ gestureEnabled: !isExpandedPeekPopOpen }} />
        <NativeOpenPaymentContextMenuHostView
          active={isFocused}
          onExpandedPreviewChange={({ nativeEvent }) =>
            setIsExpandedPeekPopOpen(nativeEvent.expanded)
          }
          style={styles.nativePeekPopHost}
        >
          <ProgressiveCollapsibleScreen
            compactTitle="Em aberto"
            contentTopInset={originalContentTopOffset}
            largeTitle={pageTitle}
            nativeHeader
          >
            {clientCardsContent}
          </ProgressiveCollapsibleScreen>
        </NativeOpenPaymentContextMenuHostView>
      </>
    );
  }

  return (
    <PremiumScreen
      contentContainerStyle={[
        styles.screenContent,
        { gap: theme.spacing.xl, paddingBottom: theme.spacing.xxxl },
      ]}
      overlayHeader={header}
      progressiveBlur
    >
      {content}
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: { flexGrow: 1 },
  content: { width: '100%' },
  nativePeekPopHost: { flex: 1 },
  totalCard: { alignSelf: 'center' },
});
