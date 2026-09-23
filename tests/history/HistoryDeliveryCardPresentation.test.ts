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
      '<OpenPaymentClientIcon backgroundColor={theme.colors.background} />',
    );
    expect(iconFallbackSource).toContain('backgroundColor ??');
  });
});
