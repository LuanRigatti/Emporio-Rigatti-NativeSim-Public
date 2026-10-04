import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getNativeLargeTitleStyle, NativeGlassHeader } from '@/components/layout';
import { ProgressiveCollapsibleScreen } from '@/components/premium';
import { StickyActionFooter } from '@/components/premium/StickyActionFooter';
import OpenPaymentClientIcon from '@/features/open-payments/components/OpenPaymentClientIcon';
import { RetailOrderPrimaryButton } from '@/features/retail-orders/components/RetailOrderPrimaryButton';
import { RegistrarDeliveryFormFieldsHost } from '@/features/deliveries/components/RegistrarDeliveryFormFields';
import { DEFAULT_REGISTRAR_DELIVERY_BUCKET_PRICE } from '@/features/deliveries/hooks/useRegistrarDeliverySheet';
import {
  calculateRegistrarDeliveryTotal,
  createRegistrarDeliveryFromConfirmation,
  queueRecentlyAddedRegistrarDelivery,
  toRegistrarDeliverySheetItem,
} from '@/features/deliveries/utils/registrarDelivery';
import { useClients } from '@/hooks/useClients';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useAppSafeAreaInsets } from '@/providers';
import { getCardSurfaceColor, useAppTheme } from '@/theme';
import { todayIso } from '@/utils/data';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

export default function RegistrarDeliveryClientRoute() {
  const { clientId: routeClientId } = useLocalSearchParams<{ clientId?: string | string[] }>();
  const router = useRouter();
  const { clients, loading: clientsLoading } = useClients();
  const { create } = useDeliveries({ mode: 'today', date: todayIso() });
  const { enabled: testModeEnabled } = useTestModePresentation();
  const { resolvedMode, theme } = useAppTheme();
  const insets = useAppSafeAreaInsets();
  const clientId = Array.isArray(routeClientId) ? routeClientId[0] : routeClientId;
  const client = useMemo(
    () => clients.find((candidate) => candidate.clientId === clientId),
    [clientId, clients],
  );
  const selectedItem = useMemo(
    () => (client ? toRegistrarDeliverySheetItem(client) : null),
    [client],
  );
  const [date, setDate] = useState(() => new Date());
  const [quantity, setQuantity] = useState(1);
  const [quantityDirection, setQuantityDirection] = useState<'up' | 'down'>('up');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const registrarCardSurface = getCardSurfaceColor(resolvedMode, theme.colors.surface);
  const bucketPrice = selectedItem?.bucketPrice ?? DEFAULT_REGISTRAR_DELIVERY_BUCKET_PRICE;
  const totalValue = calculateRegistrarDeliveryTotal(bucketPrice, quantity);
  const stickyActionFooterHeight = 58 + insets.bottom + theme.spacing.md + theme.spacing.sm;
  const contentTopInset = theme.spacing.xl + theme.spacing.xxl + theme.spacing.xxs * 2 + 2;
  const largeTitle = (
    <NativeGlassHeader
      includeTopSafeArea={false}
      largeTitle
      mode="transparent"
      title="Entregas"
      titleStyle={getNativeLargeTitleStyle(theme.spacing.xxs)}
    />
  );

  const handleAdd = useCallback(() => {
    if (!selectedItem || testModeEnabled || isSubmitting) return;

    setIsSubmitting(true);
    void createRegistrarDeliveryFromConfirmation({
      clients,
      confirmation: {
        bucketPrice,
        client: selectedItem,
        date,
        quantity,
      },
      create,
      testModeEnabled,
    })
      .then((created) => {
        if (created) {
          queueRecentlyAddedRegistrarDelivery(created.id);
          router.back();
          return;
        }
        setIsSubmitting(false);
      })
      .catch(() => setIsSubmitting(false));
  }, [
    bucketPrice,
    clients,
    create,
    date,
    isSubmitting,
    quantity,
    router,
    selectedItem,
    testModeEnabled,
  ]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ProgressiveCollapsibleScreen
        compactTitle="Entregas"
        contentGap={0}
        contentTopInset={contentTopInset}
        largeTitle={largeTitle}
        largeTitleContainerStyle={{
          marginBottom: theme.spacing.xs,
          paddingHorizontal: theme.layout.screenHorizontalPadding,
        }}
        nativeHeader
        scrollContentContainerStyle={{
          paddingBottom:
            theme.layout.tabBarHeight + insets.bottom + theme.spacing.xl + stickyActionFooterHeight,
          paddingHorizontal: 0,
        }}
      >
        <View
          style={{
            gap: theme.spacing.lg,
            paddingHorizontal: theme.layout.screenHorizontalPadding,
            paddingTop: theme.spacing.md,
            width: '100%',
          }}
        >
          {selectedItem ? (
            <>
              <View
                style={[
                  styles.clientHeading,
                  {
                    backgroundColor: registrarCardSurface,
                    borderCurve: 'continuous',
                    borderRadius: theme.radius.pill,
                    gap: theme.spacing.sm,
                    overflow: 'hidden',
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: theme.spacing.sm,
                  },
                ]}
              >
                <OpenPaymentClientIcon
                  backgroundColor={
                    resolvedMode === 'dark'
                      ? theme.colors.selectionSurface
                      : theme.colors.background
                  }
                  iconColor={
                    resolvedMode === 'dark'
                      ? theme.colors.selectionContent
                      : theme.colors.textPrimary
                  }
                  iconName="person"
                />
                <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
                  {selectedItem.title}
                </Text>
              </View>
              <RegistrarDeliveryFormFieldsHost
                date={date}
                onDateChange={setDate}
                onQuantityChange={(nextQuantity, direction) => {
                  setQuantityDirection(direction);
                  setQuantity(nextQuantity);
                }}
                quantity={quantity}
                quantityDirection={quantityDirection}
                totalValue={totalValue}
              />
            </>
          ) : (
            <Text
              accessibilityRole="alert"
              style={[theme.typography.body, { color: theme.colors.textSecondary }]}
            >
              {clientsLoading ? 'Carregando cliente...' : 'Cliente não encontrado.'}
            </Text>
          )}
        </View>
      </ProgressiveCollapsibleScreen>
      {selectedItem ? (
        <StickyActionFooter height={stickyActionFooterHeight}>
          <RetailOrderPrimaryButton
            accessibilityLabel="Adicionar entrega"
            disabled={testModeEnabled || isSubmitting}
            label="Adicionar"
            onPress={handleAdd}
            preserveDisabledAppearance
          />
        </StickyActionFooter>
      ) : (
        <StickyActionFooter height={stickyActionFooterHeight}>{null}</StickyActionFooter>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  clientHeading: { alignItems: 'center', flexDirection: 'row', width: '100%' },
  screen: { flex: 1 },
});
