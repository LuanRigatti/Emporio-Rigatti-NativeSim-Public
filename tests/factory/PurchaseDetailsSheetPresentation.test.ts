import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  APPROVED_DARK_SHEET_GLASS_TINT,
  APPROVED_LIGHT_SHEET_GLASS_TINT,
} from '@/theme/sheetGlassTints';

const purchaseDetailsSheetIOSSource = readFileSync(
  resolve(process.cwd(), 'src/features/factory-purchases/components/PurchaseDetailsSheet.ios.tsx'),
  'utf8',
);
const nativeBottomSheetIOSSource = readFileSync(
  resolve(
    process.cwd(),
    'src/components/native/NativeBottomSheet/NativeBottomSheetSwiftUI.ios.tsx',
  ),
  'utf8',
);
const factoryPurchasesScreenSource = readFileSync(
  resolve(process.cwd(), 'src/features/factory-purchases/components/FactoryPurchasesScreen.tsx'),
  'utf8',
);
const factoryPaymentRouteSource = readFileSync(
  resolve(process.cwd(), 'src/app/fabrica-compras/[purchaseId]/pagamento.tsx'),
  'utf8',
);
const factoryDetailsRouteSource = readFileSync(
  resolve(process.cwd(), 'src/app/fabrica-compras/[purchaseId]/index.tsx'),
  'utf8',
);
const factoryDetailsScreenSource = readFileSync(
  resolve(
    process.cwd(),
    'src/features/factory-purchases/components/FactoryPurchaseDetailsScreen.tsx',
  ),
  'utf8',
);
const rootStackSource = readFileSync(resolve(process.cwd(), 'src/app/_layout.tsx'), 'utf8');
const factoryPurchasesHookSource = readFileSync(
  resolve(process.cwd(), 'src/hooks/useFactoryPurchases.ts'),
  'utf8',
);

describe('Factory purchase details sheet presentation', () => {
  it('preserves Light Mode native Glass and modal dimming without changing internal content', () => {
    const sheetProps = purchaseDetailsSheetIOSSource.match(
      /<NativeBottomSheet\b([\s\S]*?)\/>/,
    )?.[1];

    expect(sheetProps).toBeDefined();
    expect(sheetProps).toContain('glassSurface');
    expect(sheetProps).toContain('presentationBackgroundInteraction="disabled"');
    expect(sheetProps).toContain('presentationBackgroundMode="native"');
    expect(sheetProps).toContain('hostSizing="viewport"');
    expect(sheetProps).not.toMatch(/\bdetents\s*=/);
    expect(sheetProps).not.toMatch(/\bpresentationBackgroundColor\s*=/);
    expect(sheetProps).toMatch(
      /glassTint=\{\s*resolvedMode === 'dark'\s*\? APPROVED_DARK_SHEET_GLASS_TINT\s*:\s*APPROVED_LIGHT_SHEET_GLASS_TINT\s*\}/,
    );
    expect(APPROVED_LIGHT_SHEET_GLASS_TINT).toBe('rgba(242, 244, 245, 0.85)');
    expect(APPROVED_DARK_SHEET_GLASS_TINT).toBe('rgba(28, 28, 30, 0.82)');
    expect(purchaseDetailsSheetIOSSource).toContain("scrollContentBackground('hidden')");
    expect(purchaseDetailsSheetIOSSource).toContain('const details = purchase ? (');
    for (const label of [
      'Detalhes da compra',
      'Data',
      'Baldes',
      'Valor do balde',
      'Valor total',
      'Total pago',
      'Saldo restante',
      'Status',
      'Histórico de pagamentos',
      'Adicionar pagamento',
    ]) {
      expect(purchaseDetailsSheetIOSSource).toContain(label);
    }
    expect(purchaseDetailsSheetIOSSource).not.toContain('<DatePicker');
    expect(purchaseDetailsSheetIOSSource).not.toContain('<TextField');
    expect(purchaseDetailsSheetIOSSource).not.toContain('Novo pagamento');
    expect(purchaseDetailsSheetIOSSource).toContain('onRequestAddPayment(purchase.id)');
    expect(purchaseDetailsSheetIOSSource).toContain("buttonStyle('glassProminent')");
    expect(purchaseDetailsSheetIOSSource).toContain(
      "resolvedMode === 'dark' ? darkModeInsetSurface : theme.colors.background",
    );
    expect(nativeBottomSheetIOSSource).toContain('interactive: true');
    expect(nativeBottomSheetIOSSource).toContain("variant: 'regular'");
    expect(nativeBottomSheetIOSSource).toContain("presentationDragIndicator('visible')");
    expect(nativeBottomSheetIOSSource).toContain("([{ fraction: 0.48 }, 'large'] as const)");
  });

  it('pushes purchase details from the Factory list without presenting or restoring a sheet', () => {
    expect(factoryPurchasesScreenSource).not.toContain('PurchaseDetailsSheet');
    expect(factoryPurchasesScreenSource).not.toContain('purchaseSheetVisible');
    expect(factoryPurchasesScreenSource).not.toContain('useFocusEffect');
    expect(factoryPurchasesScreenSource).toContain("pathname: '/fabrica-compras/[purchaseId]'");
    expect(factoryPurchasesScreenSource).toContain('params: { purchaseId: purchase.id }');
    expect(factoryDetailsRouteSource).toContain('useLocalSearchParams');
    expect(factoryDetailsRouteSource).toContain('purchaseId?: string | string[]');
    expect(factoryDetailsRouteSource).toContain('purchaseId={purchaseId}');
    expect(factoryDetailsRouteSource).toContain(
      '<FactoryPurchaseDetailsScreen purchaseId={purchaseId} />',
    );
    expect(factoryDetailsScreenSource).toContain('useFactoryPurchaseById(purchaseId)');
    expect(factoryDetailsScreenSource).not.toContain('useFactoryPurchases(');
    expect(factoryDetailsScreenSource).not.toContain('restore(');
    expect(factoryDetailsScreenSource).toContain(
      "pathname: '/fabrica-compras/[purchaseId]/pagamento'",
    );
    expect(factoryDetailsScreenSource).toContain('params: { purchaseId }');
    for (const label of [
      'Data',
      'Baldes',
      'Valor do balde',
      'Valor total',
      'Total pago',
      'Saldo restante',
      'Status',
      'Histórico de pagamentos',
      'Nenhum pagamento registrado.',
      'Adicionar pagamento',
    ]) {
      expect(factoryDetailsScreenSource).toContain(label);
    }
    expect(factoryDetailsScreenSource).toContain('purchase && !isPaid');
    expect(factoryDetailsScreenSource).not.toContain('<NativeSheet');

    expect(factoryPaymentRouteSource).toContain('useLocalSearchParams');
    expect(factoryPaymentRouteSource).toContain('useAddFactoryPurchasePayment');
    expect(factoryPaymentRouteSource).not.toContain('useFactoryPurchases(');
    expect(factoryPaymentRouteSource).toContain('purchaseId?: string | string[]');
    expect(factoryPaymentRouteSource).toContain('purchaseId={purchaseId}');
    const paymentStackOptions = rootStackSource.match(
      /<Stack\.Screen\s+name="fabrica-compras\/\[purchaseId\]\/pagamento"([\s\S]*?)<\/Stack\.Screen>/,
    )?.[1];
    expect(paymentStackOptions).toBeDefined();
    expect(paymentStackOptions).toContain('gestureEnabled: true');
    expect(paymentStackOptions).toContain(
      '<Stack.Screen.BackButton displayMode="default">Voltar</Stack.Screen.BackButton>',
    );
    const detailsStackOptions = rootStackSource.match(
      /<Stack\.Screen\s+name="fabrica-compras\/\[purchaseId\]"([\s\S]*?)<\/Stack\.Screen>/,
    )?.[1];
    expect(detailsStackOptions).toBeDefined();
    expect(detailsStackOptions).toContain('gestureEnabled: true');
    expect(detailsStackOptions).toContain(
      '<Stack.Screen.BackButton displayMode="default">Voltar</Stack.Screen.BackButton>',
    );
    const sharedPaymentMutation = factoryPurchasesHookSource.match(
      /export function useAddFactoryPurchasePayment\(\)\s*\{([\s\S]*?)\n\}/,
    )?.[1];
    expect(sharedPaymentMutation).toContain(
      'factoryReceiptDataSource.addPayment(purchaseId, payment)',
    );
    expect(sharedPaymentMutation).not.toContain('restore(');
  });

  it('keeps Factory and detail pages on one reactive source observer', () => {
    expect(factoryPurchasesHookSource).toContain('function useFactoryPurchaseSourceVersion()');
    expect(factoryPurchasesHookSource.match(/factoryReceiptDataSource\.subscribe\(/g)).toHaveLength(
      1,
    );
    expect(factoryPurchasesHookSource).toContain('useFactoryPurchaseSourceVersion()');
    expect(factoryPurchasesHookSource).toContain('getReceipts(user?.id, sessionVersion)');
  });
});
