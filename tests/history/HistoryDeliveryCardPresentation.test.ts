import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('History delivery card presentation', () => {
  it('uses the screen background only for the Wholesale delivery client icon', () => {
    const deliveryCardSource = readFileSync(
      resolve(process.cwd(), 'src/features/history/components/DeliveryCard.tsx'),
      'utf8',
    );
    const iconFallbackSource = readFileSync(
      resolve(
        process.cwd(),
        'src/features/open-payments/components/OpenPaymentClientIconFallback.tsx',
      ),
      'utf8',
    );

    expect(deliveryCardSource).toContain(
      '<OpenPaymentClientIcon backgroundColor={theme.colors.background} iconName="person" />',
    );
    expect(iconFallbackSource).toContain('backgroundColor ??');
  });

  it('uses the measured outer History card size only for the context-menu preview', () => {
    const deliveryCardSource = readFileSync(
      resolve(process.cwd(), 'src/features/history/components/DeliveryCard.tsx'),
      'utf8',
    );

    expect(deliveryCardSource).toContain(
      '<View onLayout={handleCardLayout} style={[styles.contextContainer, contextCardStyle]}>',
    );
    expect(deliveryCardSource).toContain('event.nativeEvent.layout');
    expect(deliveryCardSource).toContain('height: previewSize.height, width: previewSize.width');
    expect(deliveryCardSource).toContain('measuredPreviewSize');
    expect(deliveryCardSource).not.toContain('measuredTriggerWidth');
  });

  it('fills the day-card native host horizontally and matches natural height', () => {
    const deliveryCardSource = readFileSync(
      resolve(process.cwd(), 'src/features/history/components/DeliveryCard.tsx'),
      'utf8',
    );

    expect(deliveryCardSource).toContain('const HISTORY_DELIVERY_CARD_HEIGHT = 86;');
    expect(deliveryCardSource).toContain('minHeight: HISTORY_DELIVERY_CARD_HEIGHT,');
    expect(deliveryCardSource).toContain('matchContents={{ vertical: true }}');
    expect(deliveryCardSource).toContain('triggerMatchContents={{ vertical: true }}');
    expect(deliveryCardSource).not.toContain('height: HISTORY_DELIVERY_CARD_HEIGHT,');
    expect(deliveryCardSource).toContain("contextMenu: { width: '100%' }");
  });

  it('lets a context-menu trigger take horizontal size from its parent when requested', () => {
    const nativeContextMenuSource = readFileSync(
      resolve(
        process.cwd(),
        'src/components/native/NativeCardContextMenu/NativeCardContextMenu.ios.tsx',
      ),
      'utf8',
    );
    const nativeContextMenuTypesSource = readFileSync(
      resolve(
        process.cwd(),
        'src/components/native/NativeCardContextMenu/NativeCardContextMenu.types.ts',
      ),
      'utf8',
    );

    expect(nativeContextMenuTypesSource).toContain('triggerMatchContents?:');
    expect(nativeContextMenuSource).toContain('triggerMatchContents = true');
    expect(nativeContextMenuSource).toContain('matchContents={triggerMatchContents}');
  });

  it('shows only the delivery status and routes it to the unified sheet', () => {
    const deliveryCardSource = readFileSync(
      resolve(process.cwd(), 'src/features/history/components/DeliveryCard.tsx'),
      'utf8',
    );
    const historyScreenSource = readFileSync(
      resolve(process.cwd(), 'src/features/history/components/HistoryScreen.tsx'),
      'utf8',
    );
    const deliveryBadgeSource = readFileSync(
      resolve(process.cwd(), 'src/features/history/components/DeliveryStatusBadge.tsx'),
      'utf8',
    );

    expect(deliveryCardSource).not.toContain('PaymentStatusBadge');
    expect(deliveryCardSource).not.toContain('paymentStatus');
    expect(deliveryCardSource).toContain('styles.financialColumn');
    expect(deliveryCardSource).toContain('<DeliveryStatusBadge');
    expect(deliveryCardSource).toContain('status={delivery.status}');
    expect(deliveryCardSource).toContain('maskText(delivery.valor)');
    expect(deliveryCardSource.match(/onPress=\{onOpenStatusSheet\}/g)).toHaveLength(1);
    expect(historyScreenSource).toContain(
      'onOpenStatusSheet={() => handleOpenStatusSheet(delivery.id)}',
    );
    expect(deliveryBadgeSource).toContain(
      'accessibilityHint="Toque para editar os estados de entrega e pagamento."',
    );
    expect(deliveryBadgeSource).toContain(
      "return status === 'pendente' ? 'Pendente' : 'Entregue';",
    );
  });

  it('uses the native combined workflow sheet with segmented pickers and confirmed reversal', () => {
    const nativeSheetSource = readFileSync(
      resolve(process.cwd(), 'src/features/history/components/HistoryPaymentSheet.ios.tsx'),
      'utf8',
    );

    expect(nativeSheetSource).toContain('<BottomSheet');
    expect(nativeSheetSource).not.toContain('fitToContents');
    expect(nativeSheetSource).toContain('presentationDetents([{ fraction: 0.45 }])');
    expect(nativeSheetSource).toContain("pickerStyle('segmented')");
    expect(nativeSheetSource).toContain('Confirmar alterações de entrega e pagamento');
    expect(nativeSheetSource).toContain('title="Desfazer pagamento?"');
    expect(nativeSheetSource).toContain("presentationDragIndicator('visible')");
    expect(nativeSheetSource.match(/<Picker\s/g)).toHaveLength(2);
    expect(nativeSheetSource).not.toContain('BlurView');
  });
});
