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

  it('uses the measured outer History card width for both trigger and preview', () => {
    const deliveryCardSource = readFileSync(
      resolve(process.cwd(), 'src/features/history/components/DeliveryCard.tsx'),
      'utf8',
    );

    expect(deliveryCardSource).toContain(
      '<View onLayout={handleCardLayout} style={[styles.contextContainer, contextCardStyle]}>',
    );
    expect(deliveryCardSource).toContain('event.nativeEvent.layout');
    expect(deliveryCardSource).toContain(
      'const measuredTriggerWidth: ViewStyle | undefined = previewSize',
    );
    expect(deliveryCardSource).toContain('{ width: previewSize.width }');
    expect(deliveryCardSource).toContain('measuredTriggerWidth]');
    expect(deliveryCardSource).toContain('height: previewSize.height, width: previewSize.width');
    expect(deliveryCardSource).toContain('measuredPreviewSize');
  });
});
