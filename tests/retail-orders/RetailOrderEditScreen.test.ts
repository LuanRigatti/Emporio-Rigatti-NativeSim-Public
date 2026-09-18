import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const editSource = readFileSync(
  resolve(process.cwd(), 'src/features/retail-orders/components/RetailOrderEditScreen.tsx'),
  'utf8',
);

describe('RetailOrderEditScreen contract', () => {
  it('exposes only the supported editable fields', () => {
    for (const label of [
      'Produtos',
      'Data de entrega',
      'Endereço de entrega',
      'Ocasião',
      'Destinatário',
      'Observações',
      'Desconto (R$)',
      'Taxa de entrega (R$)',
      'Custo de entrega (R$)',
      'Salvar alterações',
    ]) {
      expect(editSource).toContain(label);
    }
    expect(editSource).toContain('RetailOrderPatch');
    expect(editSource).toContain('useRetailOrderEdit');
    expect(editSource).toContain('saveContents');
    expect(editSource).toContain('updateLineQuantity');
    expect(editSource).toContain('onRemoveLine');
    expect(editSource).toContain('prepareForOrder');
    expect(editSource).not.toContain('RetailOrderFlowProvider');
    expect(editSource).not.toContain('clientId');
    expect(editSource).not.toContain('orderDate');
  });

  it('keeps monetary fields disabled when a posted payment exists', () => {
    expect(editSource).toContain("payment.status === 'posted'");
    expect(editSource).toContain('Valores financeiros exigem anular os pagamentos registrados');
    expect(editSource).toContain('financialDisabled');
    expect(editSource).toContain('updateForOrder');
  });

  it('uses the existing Root detail and session contracts', () => {
    expect(editSource).toContain('useRetailOrderDetail');
    expect(editSource).toContain('useRetailOrderPayments');
    expect(editSource).toContain('useRetailOrderEdit');
    expect(editSource).toContain('overlayHeaderSpacing={theme.spacing.sm}');
    expect(editSource).toContain('useIsFocused');
    expect(editSource).toContain('useNavigation');
    expect(editSource).toContain('navigation.canGoBack()');
    expect(editSource).toContain('isMountedRef');
    expect(editSource).toContain('didNavigateBackRef');
    expect(editSource.match(/router\.back\(\)/g)).toHaveLength(1);
  });

  it('keeps the edit form scrollable above the iOS keyboard', () => {
    expect(editSource).toContain('scrollViewProps={{');
    expect(editSource).toContain('automaticallyAdjustKeyboardInsets: true');
    expect(editSource).toContain("keyboardDismissMode: 'interactive'");
  });
});
