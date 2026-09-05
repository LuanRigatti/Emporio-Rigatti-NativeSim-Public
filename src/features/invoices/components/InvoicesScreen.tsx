import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { NativeCardContextMenu, NativeGlassBackButton } from '@/components/native';
import { GlassCard, PremiumScreen } from '@/components/premium';
import { useClients } from '@/hooks/useClients';
import { useDeliveries } from '@/hooks/useDeliveries';
import { getCardSurfaceColor, useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { normalizeClientKey } from '@/utils/data';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';
import { formatDateAsDayMonthYear, groupItemsByDate } from '@/utils/groupItemsByDate';
import type { DatedItemGroup } from '@/utils/groupItemsByDate';

import type { Delivery } from '@/types/data';

import type { OpenPaymentPreview } from '@/features/open-payments/data/openPaymentPreview';

export function InvoicesScreen({ nativeHeader = false }: { nativeHeader?: boolean } = {}) {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { enabled: testModeEnabled } = useTestModePresentation();
  const { clients, reload: reloadClients } = useClients();
  const invoiceClientNames = useMemo(
    () =>
      new Set(
        clients.filter((client) => client.usesInvoice).map((client) => client.normalizedName),
      ),
    [clients],
  );
  const boletoClientNames = useMemo(
    () =>
      new Set(clients.filter((client) => client.usesBoleto).map((client) => client.normalizedName)),
    [clients],
  );
  const eligibleClientIds = useMemo(
    () =>
      clients
        .filter((client) => client.usesInvoice || client.usesBoleto)
        .map((client) => client.clientId),
    [clients],
  );
  const {
    deliveries,
    reload: reloadDeliveries,
    updateInvoiceStatus,
    updateBoletoStatus,
  } = useDeliveries({
    clientIds: eligibleClientIds,
    mode: 'all',
  });
  const invoiceDeliveries = useMemo(
    () => deliveries.filter((delivery) => (delivery.invoiceStatus ?? 'a_emitir') === 'a_emitir'),
    [deliveries],
  );
  const boletoDeliveries = useMemo(
    () =>
      deliveries.filter(
        (delivery) =>
          (delivery.boletoStatus ?? delivery.invoiceStatus ?? 'a_emitir') === 'a_emitir',
      ),
    [deliveries],
  );

  const invoiceItems = useMemo(
    () => documentItemsForClients(invoiceDeliveries, invoiceClientNames),
    [invoiceClientNames, invoiceDeliveries],
  );
  const boletoItems = useMemo(
    () => documentItemsForClients(boletoDeliveries, boletoClientNames),
    [boletoClientNames, boletoDeliveries],
  );
  const invoiceGroups = useMemo(() => groupItemsByDate(invoiceItems), [invoiceItems]);
  const boletoGroups = useMemo(() => groupItemsByDate(boletoItems), [boletoItems]);

  useFocusEffect(
    useCallback(() => {
      void reloadClients();
      void reloadDeliveries();
    }, [reloadClients, reloadDeliveries]),
  );

  const handleInvoiceSwipe = useCallback(
    async (deliveryId: string) => {
      if (testModeEnabled) return;
      triggerLightImpactHaptic();
      await updateInvoiceStatus(deliveryId, 'emitido');
    },
    [testModeEnabled, updateInvoiceStatus],
  );

  const handleBoletoSwipe = useCallback(
    async (deliveryId: string) => {
      if (testModeEnabled) return;
      triggerLightImpactHaptic();
      await updateBoletoStatus(deliveryId, 'emitido');
    },
    [testModeEnabled, updateBoletoStatus],
  );

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
      title={nativeHeader ? '' : 'Notas fiscais/boletos'}
    />
  );
  const pageTitle = nativeHeader ? (
    <NativeGlassHeader
      includeTopSafeArea={false}
      largeTitle
      mode="transparent"
      title="Documentos"
      titleStyle={{
        fontFamily: 'System',
        fontSize: 36,
        fontWeight: '700',
        marginLeft: -(theme.spacing.xxs * 2),
      }}
    />
  ) : null;
  const documentContent = (
    <View
      style={[
        styles.typeList,
        { gap: theme.spacing.md, marginTop: nativeHeader ? 0 : theme.spacing.xxl },
      ]}
    >
      <DocumentTypeCard
        emptyLabel="Nenhuma nota fiscal pendente"
        groups={invoiceGroups}
        onDelete={handleInvoiceSwipe}
        theme={theme}
        title="Nota fiscal"
      />
      <DocumentTypeCard
        emptyLabel="Nenhum boleto pendente"
        groups={boletoGroups}
        onDelete={handleBoletoSwipe}
        theme={theme}
        title="Boleto"
      />
    </View>
  );

  return (
    <PremiumScreen
      contentContainerStyle={[
        styles.screenContent,
        { gap: theme.spacing.xl, paddingBottom: theme.spacing.xxxl },
      ]}
      overlayHeader={header}
      overlayHeaderContentOffset={nativeHeader ? theme.sizes.touchTargetMinimum : undefined}
      progressiveBlur
    >
      {nativeHeader ? (
        <View
          style={[
            styles.pageContent,
            {
              gap: theme.spacing.lg,
              marginTop: theme.spacing.xl + theme.spacing.xxl + theme.spacing.xxs * 2 + 2,
            },
          ]}
        >
          {pageTitle}
          {documentContent}
        </View>
      ) : (
        documentContent
      )}
    </PremiumScreen>
  );
}

function documentItemsForClients(
  deliveries: readonly Delivery[],
  clientNames: ReadonlySet<string>,
): OpenPaymentPreview[] {
  return deliveries
    .filter((delivery) => clientNames.has(normalizeClientKey(delivery.cliente)))
    .map((delivery) => ({
      amount: formatCurrency(delivery.valor),
      client: delivery.cliente,
      date: delivery.data,
      id: delivery.id,
      quantity: delivery.quantidade,
    }));
}

function DocumentTypeCard({
  emptyLabel,
  groups,
  onDelete,
  theme,
  title,
}: {
  emptyLabel: string;
  groups: DatedItemGroup<OpenPaymentPreview>[];
  onDelete: (deliveryId: string) => void;
  theme: ReturnType<typeof useAppTheme>['theme'];
  title: string;
}) {
  const { resolvedMode } = useAppTheme();
  const { enabled: testModeEnabled, quantity: maskQuantity, text: maskText } =
    useTestModePresentation();

  return (
    <GlassCard style={[styles.typeCard, { borderRadius: theme.radius.xl + theme.spacing.sm }]}>
      <Text style={[styles.typeTitle, { color: theme.colors.textPrimary }]}>{title}</Text>
      {groups.length > 0 ? (
        groups.map((group) => (
          <View key={group.date} style={styles.dateGroup}>
            <Text style={[styles.groupTitle, { color: theme.colors.textSecondary }]}>
              {formatDateAsDayMonthYear(group.date)}
            </Text>
            <View style={[styles.documentItemGroup, { gap: theme.spacing.xs }]}>
              {group.items.map((item) => {
                const renderDocumentItemRow = (preview = false) => (
                  <View
                    style={[
                      styles.documentItemRow,
                      {
                        backgroundColor: preview
                          ? getCardSurfaceColor(resolvedMode, theme.colors.glassSurface)
                          : 'transparent',
                        borderRadius: theme.radius.xl + theme.spacing.sm,
                        overflow: preview ? 'hidden' : undefined,
                        paddingHorizontal: theme.spacing.md,
                        paddingVertical: theme.spacing.sm + theme.spacing.xs,
                        width: '100%',
                      },
                    ]}
                  >
                    <View style={styles.documentItemCopy}>
                      <Text
                        style={[
                          theme.typography.callout,
                          { color: theme.colors.textPrimary, fontWeight: '700' },
                        ]}
                      >
                        {item.client}
                      </Text>
                      <Text
                        style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}
                      >
                        {maskQuantity(item.quantity)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        theme.typography.body,
                        { color: theme.colors.textPrimary, fontWeight: '600' },
                      ]}
                    >
                      {maskText(item.amount)}
                    </Text>
                  </View>
                );

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.contextContainer,
                      {
                        backgroundColor: getCardSurfaceColor(resolvedMode, theme.colors.glassSurface),
                        borderRadius: theme.radius.xl + theme.spacing.sm,
                        overflow: 'hidden',
                        width: '100%',
                      },
                    ]}
                  >
                    <NativeCardContextMenu
                      actions={[
                        {
                          id: 'emit-document',
                          disabled: testModeEnabled,
                          onPress: () => onDelete(item.id),
                          systemImage: 'checkmark.seal.fill',
                          title: 'Emitido',
                        },
                      ]}
                      preview={renderDocumentItemRow(true)}
                      style={[styles.contextMenu, { borderRadius: theme.radius.xl + theme.spacing.sm }]}
                    >
                      {renderDocumentItemRow()}
                    </NativeCardContextMenu>
                  </View>
                );
              })}
            </View>
          </View>
        ))
      ) : (
        <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
          {emptyLabel}
        </Text>
      )}
    </GlassCard>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    currency: 'BRL',
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(value);
}

const styles = StyleSheet.create({
  screenContent: { flexGrow: 1 },
  pageContent: { width: '100%' },
  typeList: { width: '100%' },
  typeCard: { gap: 12, overflow: 'hidden', padding: 16 },
  typeTitle: { fontSize: 18, fontWeight: '700' },
  dateGroup: { gap: 6 },
  groupTitle: { marginLeft: 4 },
  documentItemGroup: { width: '100%' },
  contextContainer: { overflow: 'hidden' },
  contextMenu: { width: '100%' },
  documentItemRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  documentItemCopy: { flex: 1, gap: 2 },
});
