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

  it('keeps invoice rows transparent inside the grouped card and preserves context actions', () => {
    const itemWrapperStyle = invoicesScreenSource.match(
      /<View\s+key=\{item\.id\}\s+style=\{\{([\s\S]*?)\}\}>\s*<NativeCardContextMenu/,
    )?.[1];

    expect(itemWrapperStyle).toBeDefined();
    expect(itemWrapperStyle).toContain('height: documentItemRowHeight');
    expect(itemWrapperStyle).toContain("width: '100%'");
    expect(itemWrapperStyle).not.toMatch(/backgroundColor|borderRadius|overflow/);
    expect(invoicesScreenSource).toContain('backgroundColor: preview');
    expect(invoicesScreenSource).toContain("title: 'Emitido'");
    expect(invoicesScreenSource).toContain("systemImage: 'checkmark.seal.fill'");
  });

  it('keeps open payment client rows directly on the grouped card surface', () => {
    expect(openPaymentClientCardsSource).toContain('<GlassCard');
    expect(openPaymentClientCardsSource).toContain(
      "backgroundColor: preview ? openPaymentCardSurface : 'transparent'",
    );
    expect(openPaymentClientCardsSource).toContain('onMarkAsPaid(delivery.id)');
  });
});
