import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const invoicesScreenSource = readFileSync(
  resolve(process.cwd(), 'src/features/invoices/components/InvoicesScreen.tsx'),
  'utf8',
);
const openPaymentClientCardsSource = readFileSync(
  resolve(process.cwd(), 'src/features/open-payments/components/OpenPaymentClientCards.tsx'),
  'utf8',
);
const historyDeliveryCardSource = readFileSync(
  resolve(process.cwd(), 'src/features/history/components/DeliveryCard.tsx'),
  'utf8',
);

describe('Document and open payment client rows', () => {
  it('reuses the History person icon with the app background in both screens', () => {
    const historyIcon =
      '<OpenPaymentClientIcon backgroundColor={theme.colors.background} iconName="person" />';

    expect(historyDeliveryCardSource).toContain(historyIcon);
    expect(invoicesScreenSource).toMatch(
      /<OpenPaymentClientIcon\s+backgroundColor=\{theme\.colors\.background\}\s+iconName="person"\s*\/>/,
    );
    expect(openPaymentClientCardsSource).toContain(historyIcon);
  });

  it('measures the invoice card wrapper without adding a surface around the row', () => {
    const itemWrapperStyle = invoicesScreenSource.match(
      /<MeasuredContextMenuGeometry\s+key=\{item\.id\}>[\s\S]*?<View\s+onLayout=\{onLayout\}\s+style=\{\{([\s\S]*?)\}\}\s*>/,
    )?.[1];

    expect(itemWrapperStyle).toBeDefined();
    expect(itemWrapperStyle).toContain('height: documentItemRowHeight');
    expect(itemWrapperStyle).toContain("width: '100%'");
    expect(itemWrapperStyle).not.toMatch(/backgroundColor|borderRadius|overflow/);
    expect(invoicesScreenSource).toContain('renderDocumentItemRow(true, previewFrameStyle)');
    expect(invoicesScreenSource).toContain('renderDocumentItemRow(false, triggerWidthStyle)');
    expect(invoicesScreenSource).toContain('backgroundColor: preview');
    expect(invoicesScreenSource).toContain("title: 'Emitido'");
    expect(invoicesScreenSource).toContain("systemImage: 'checkmark.seal.fill'");
  });

  it('keeps open payment client rows directly on the grouped card surface', () => {
    const triggerStart = openPaymentClientCardsSource.indexOf('const renderRow');
    const triggerEnd = openPaymentClientCardsSource.indexOf('const renderPreview', triggerStart);
    const triggerSource = openPaymentClientCardsSource.slice(triggerStart, triggerEnd);
    const triggerStyleEnd = triggerSource.indexOf('testID="open-payment-client-trigger"');
    const triggerStyle = triggerSource.slice(triggerSource.indexOf('style={['), triggerStyleEnd);

    expect(openPaymentClientCardsSource).toContain('<GlassCard');
    expect(triggerStyle).not.toContain('backgroundColor');
    expect(openPaymentClientCardsSource).toContain('backgroundColor: openPaymentCardSurface');
    expect(openPaymentClientCardsSource).toContain('preview={renderPreview(client)}');
    expect(openPaymentClientCardsSource).toContain('onMarkAsPaid(delivery.id)');
  });
});
