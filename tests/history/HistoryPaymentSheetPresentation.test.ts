import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('History delivery and payment sheet presentation', () => {
  const nativeSheetSource = readFileSync(
    resolve(process.cwd(), 'src/features/history/components/HistoryPaymentSheet.ios.tsx'),
    'utf8',
  );

  const historyScreenSource = readFileSync(
    resolve(process.cwd(), 'src/features/history/components/HistoryScreen.tsx'),
    'utf8',
  );
  const fallbackSheetSource = readFileSync(
    resolve(process.cwd(), 'src/features/history/components/HistoryPaymentSheet.tsx'),
    'utf8',
  );
  const segmentedControlSource = readFileSync(
    resolve(process.cwd(), 'src/components/forms/Forms.tsx'),
    'utf8',
  );
  const nativeClientIconSource = readFileSync(
    resolve(process.cwd(), 'src/components/native/NativeSheetFieldIcon.tsx'),
    'utf8',
  );

  it('keeps one native sheet with independent delivery and payment pickers', () => {
    expect(nativeSheetSource).toContain('<BottomSheet');
    expect(nativeSheetSource).not.toContain('fitToContents');
    expect(nativeSheetSource).toContain('presentationDetents([{ fraction: 0.45 }])');
    expect(nativeSheetSource).toContain('minimumSheetContentHeight');
    expect(nativeSheetSource).toContain(
      'minimumSheetContentHeight > availableViewportHeight * 0.95',
    );
    expect(nativeSheetSource).toContain("presentationDetents(['large'])");
    expect(nativeSheetSource).toContain("presentationDragIndicator('visible')");
    expect(nativeSheetSource).toContain('interactiveDismissDisabled(saving)');
    expect(nativeSheetSource).toContain('onDismiss={onCancel}');
    expect(nativeSheetSource).toContain('if (!isPresented) onCancel();');
    expect(nativeSheetSource).not.toContain('<ScrollView');
    expect(nativeSheetSource.match(/<Picker\s/g)).toHaveLength(2);
    expect(nativeSheetSource).toContain("selection={delivered ? 'Entregue' : 'Pendente'}");
    expect(nativeSheetSource).toContain('selection={paymentSelection}');
    expect(nativeSheetSource).toContain("tag('Pendente')");
    expect(nativeSheetSource).toContain("tag('Entregue')");
    expect(nativeSheetSource).toContain("tag('Não Pago')");
    expect(nativeSheetSource).toContain("tag('Pix')");
    expect(nativeSheetSource).toContain("tag('Dinheiro')");
    expect(nativeSheetSource).toContain(
      'const pickerControlHeight = theme.sizes.touchTargetMinimum * fontScale;',
    );
    expect(nativeSheetSource).toContain('pickerControlHeight * 2');
    expect(nativeSheetSource).toContain('const pickerInterSectionSpacing =');
    expect(nativeSheetSource).toContain(
      'theme.spacing.sm + theme.typography.footnote.lineHeight * fontScale + theme.spacing.xxs',
    );
    expect(nativeSheetSource).toContain('top: theme.spacing.md + theme.spacing.xl');
    expect(nativeSheetSource).toContain('bottom: insets.bottom + theme.spacing.sm');
    expect(nativeSheetSource).toContain('foregroundStyle(theme.colors.textPrimary)');
    expect(nativeSheetSource).toContain(
      'const pickerSpacerMaxHeight = theme.spacing.xxl - theme.spacing.xxs;',
    );
    expect(nativeSheetSource).not.toContain('>Entrega</Text>');
    expect(nativeSheetSource).not.toContain('>Pagamento</Text>');
    expect(nativeSheetSource).toContain("accessibilityLabel('Status da entrega')");
    expect(nativeSheetSource).toContain(
      "accessibilityLabel('Status do pagamento: Não pago, Pix ou Dinheiro')",
    );
    expect(nativeSheetSource).not.toContain('Método anterior não informado');
    expect(nativeSheetSource).not.toContain("message ?? ' '");
    expect(nativeSheetSource).toContain('{message ? (');
    expect(nativeSheetSource).toContain('const message = error ?? validationMessage;');
  });

  it('uses one wide native capsule confirmation and only confirms reversal after a native dialog', () => {
    expect(nativeSheetSource).toContain("buttonStyle('plain')");
    expect(nativeSheetSource).toContain(
      "const confirmButtonBackground = resolvedMode === 'dark' ? '#FFFFFF' : '#000000';",
    );
    expect(nativeSheetSource).toContain(
      "const confirmButtonForeground = resolvedMode === 'dark' ? '#000000' : '#FFFFFF';",
    );
    expect(nativeSheetSource).toContain('background(confirmButtonBackground)');
    expect(nativeSheetSource).toContain("clipShape('capsule')");
    expect(nativeSheetSource).toContain('frame({ maxWidth: Infinity })');
    expect(nativeSheetSource).toContain('frame({ minHeight: accessibleActionHeight })');
    expect(nativeSheetSource).toContain('foregroundStyle(confirmButtonForeground)');
    expect(nativeSheetSource).toContain('tint(confirmButtonForeground)');
    expect(nativeSheetSource.match(/>\s*Confirmar\s*</g)).toHaveLength(1);
    expect(nativeSheetSource).toContain('disabled(saving || requiresDeliveredForNewPayment)');
    expect(nativeSheetSource).toContain('onConfirm(false)');
    expect(nativeSheetSource).toContain('onConfirm(true)');
    expect(nativeSheetSource).toContain('<ConfirmationDialog');
    expect(nativeSheetSource).toContain('title="Desfazer pagamento?"');
    expect(nativeSheetSource).toContain('role="destructive"');
    expect(nativeSheetSource).toContain('<ProgressView');
    expect(nativeSheetSource).not.toContain('background(theme.colors.dangerSurface)');
    expect(nativeSheetSource).toContain('lineLimit(1, { reservesSpace: true })');
  });

  it('reuses the circular SwiftUI client icon and keeps a readable compact header', () => {
    expect(nativeSheetSource).toContain('<NativeSheetFieldIcon');
    expect(nativeSheetSource).toContain(
      "resolvedMode === 'dark' ? lightTheme.colors.background : theme.colors.background",
    );
    expect(nativeSheetSource).toContain(
      "resolvedMode === 'dark' ? lightTheme.colors.textPrimary : theme.colors.textPrimary",
    );
    expect(nativeSheetSource).toContain('backgroundColor={clientAvatarBackgroundColor}');
    expect(nativeSheetSource).toContain('iconColor={clientAvatarIconColor}');
    expect(nativeSheetSource).toContain('systemImage="person.fill"');
    expect(nativeSheetSource).toContain('alignment="center"');
    expect(nativeSheetSource).toContain('lineLimit(2)');
    expect(nativeSheetSource).toContain('accessibilityLabel(clientName)');
    expect(nativeClientIconSource).toContain('const NATIVE_SHEET_ICON_SIZE = 54;');
    expect(nativeClientIconSource).toContain('const NATIVE_SHEET_SYMBOL_SIZE = 21;');
    expect(nativeClientIconSource).toContain('backgroundColor?: string;');
    expect(nativeClientIconSource).toContain('iconColor?: string;');
    expect(nativeClientIconSource).toContain('color={iconColor ?? theme.colors.textPrimary}');
    expect(nativeClientIconSource).toContain('accessibilityHidden?: boolean;');
    expect(nativeClientIconSource).toContain('accessibilityHidden(true)');
  });

  it('reopens with persisted statuses and does not settle or reverse until explicit confirmation', () => {
    expect(historyScreenSource).toContain('function getPaymentSelection(delivery: Delivery)');
    expect(historyScreenSource).toContain("if (delivery.status !== 'Pago') return 'Não Pago';");
    expect(historyScreenSource).toContain("? delivery.metodoPagamento\n    : 'Pix';");
    expect(historyScreenSource).toContain(
      'setSettlementPaymentSelection(getPaymentSelection(delivery))',
    );
    expect(historyScreenSource).toContain('setSettlementDelivered(delivery.entregue)');
    expect(historyScreenSource).toContain('await updateHistoryWorkflow(settlementDelivery.id, {');
    expect(historyScreenSource).toContain('paymentReversalConfirmed,');
    expect(historyScreenSource).toContain('!hasKnownPaymentMethod(settlementDelivery)');
    expect(historyScreenSource).toContain('paymentSelectionChanged:');
    expect(historyScreenSource).not.toContain('paymentMethodKnown=');
    expect(historyScreenSource).not.toContain('await settle(');
    expect(historyScreenSource).not.toContain('await reverseSettlement(');
    expect(historyScreenSource).not.toContain('await updatePaymentMethod(');
    const openHandler = historyScreenSource
      .split('const handleOpenStatusSheet')[1]
      ?.split('const handleMarkDelivered')[0];
    expect(openHandler).not.toContain('updateHistoryWorkflow');
  });

  it('removes visible picker headings and keeps accessible group names, validation and save errors', () => {
    expect(fallbackSheetSource).not.toContain('Método anterior não informado');
    expect(fallbackSheetSource).not.toContain('unknownMethodMessage');
    expect(fallbackSheetSource).not.toContain('>Entrega</Text>');
    expect(fallbackSheetSource).not.toContain('>Pagamento</Text>');
    expect(fallbackSheetSource).toContain('accessibilityLabel="Status da entrega"');
    expect(fallbackSheetSource).toContain(
      'accessibilityLabel="Status do pagamento: Não pago, Pix ou Dinheiro"',
    );
    expect(segmentedControlSource).toContain('accessibilityLabel?: string;');
    expect(segmentedControlSource).toContain('accessibilityLabel={accessibilityLabel}');
    expect(fallbackSheetSource).toContain('<ErrorState');
    expect(fallbackSheetSource).toContain(
      'Marque a entrega como Entregue para registrar o pagamento.',
    );
  });
});
