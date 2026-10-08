import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const consumers = [
  ['Atacado Clientes', 'src/app/clientes.tsx', 1],
  ['Varejo Clientes', 'src/app/clientes-varejo.tsx', 1],
  ['Varejo categorias', 'src/app/catalogo-varejo.tsx', 1],
  ['Varejo produtos', 'src/app/catalogo-varejo/[categoryId].tsx', 1],
  ['Varejo custos', 'src/app/custos-varejo.tsx', 1],
  ['Registrar', 'src/app/(tabs)/registrar/index.tsx', 2],
  ['Documentos', 'src/features/invoices/components/InvoicesScreen.tsx', 1],
  ['Fábrica', 'src/features/factory-purchases/components/FactoryPurchasesScreen.tsx', 1],
  ['Route Tracking', 'src/features/location/components/LocationTrackingScreen.tsx', 1],
  ['Histórico compacto', 'src/features/history/components/HistoryCompactDeliveryCard.tsx', 1],
  ['Pagamentos em aberto', 'src/features/open-payments/components/OpenPaymentsScreen.tsx', 1],
] as const;

function readProjectFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('measured context-menu card geometry', () => {
  it('derives numeric trigger and preview styles only from a valid external layout', () => {
    const source = readProjectFile('src/components/layout/MeasuredContextMenuGeometry.tsx');

    expect(source).toContain('event.nativeEvent.layout');
    expect(source).toContain('if (width <= 0 || height <= 0) return;');
    expect(source).toContain(
      'previewFrameStyle: size ? { height: size.height, width: size.width }',
    );
    expect(source).toContain('triggerWidthStyle: size ? { width: size.width }');
  });

  it.each(consumers)(
    '%s measures its external card and applies the same geometry',
    (_, path, count) => {
      const source = readProjectFile(path);

      expect(source.match(/<MeasuredContextMenuGeometry(?:\s|>)/g)).toHaveLength(count);
      expect(source.match(/onLayout=\{onLayout\}/g)).toHaveLength(count);
      expect((source.match(/triggerWidthStyle/g) ?? []).length).toBeGreaterThan(1);
      expect((source.match(/previewFrameStyle/g) ?? []).length).toBeGreaterThan(1);
      expect(source).toContain('NativeCardContextMenu');
    },
  );

  it('keeps Retail history geometry screen-scoped and applies it to trigger and preview', () => {
    const source = readProjectFile(
      'src/features/retail-orders/components/RetailOrderHistoryCard.tsx',
    );
    const headerStart = source.indexOf('header: {');
    const headerEnd = source.indexOf('\n  },', headerStart);
    const headerStyle = source.slice(headerStart, headerEnd);

    expect(source).not.toContain('MeasuredContextMenuGeometry');
    expect(source).not.toContain('onLayout=');
    expect(source).toContain('width: availableWidth');
    expect(source).toContain('<View style={{ width: availableWidth }}>{card()}</View>');
    expect(source).toContain('onPress={onPress}');
    expect(source).toContain('preview={card()}');
    expect(headerStyle).toContain("justifyContent: 'space-between'");
    expect(headerStyle).toContain("width: '100%'");
    expect(source).toContain('clientCopy: { flex: 1, minWidth: 0 }');
    expect(source).toContain('flexShrink: 1');
  });

  it('keeps the open payment client trigger measured while sizing its preview independently', () => {
    const source = readProjectFile(
      'src/features/open-payments/components/OpenPaymentClientCards.tsx',
    );

    expect(source).toContain('<MeasuredContextMenuGeometry');
    expect(source).toContain('triggerWidthStyle');
    expect(source).not.toContain('previewFrameStyle');
    expect(source).toContain('preview={renderPreview(client)}');
    expect(source).toContain('windowWidth - insets.left - insets.right - theme.spacing.md * 2');
  });

  it('keeps card geometry out of the shared iOS menu adapter', () => {
    const adapter = readProjectFile(
      'src/components/native/NativeCardContextMenu/NativeCardContextMenu.ios.tsx',
    );

    expect(adapter).not.toContain('MeasuredContextMenuGeometry');
    expect(adapter).not.toContain('triggerWidthStyle');
    expect(adapter).not.toContain('previewFrameStyle');
  });
});
