import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const detailSource = readFileSync(
  resolve(process.cwd(), 'src/features/retail-orders/components/RetailOrderDetailScreen.tsx'),
  'utf8',
);

describe('RetailOrderDetailScreen contract', () => {
  it('renders the frozen commercial fields and payment audit fields', () => {
    for (const label of [
      'Data do pedido',
      'Data de entrega',
      'Endereço de entrega',
      'Preço unitário',
      'Subtotal dos produtos',
      'Taxa de entrega',
      'Total cobrado',
      'Resumo financeiro',
      'A receber',
      'Nenhum pagamento registrado.',
    ]) {
      expect(detailSource).toContain(label);
    }
    expect(detailSource).toContain('payment.cardFee');
    expect(detailSource).toContain('payment.notes');
    expect(detailSource).toContain("payment.status === 'posted'");
  });

  it('uses the central financial calculator and does not use the History summary service', () => {
    expect(detailSource).toContain('calculateRetailOrderFinancials');
    expect(detailSource).not.toContain('RetailOrderHistoryFinancialSummaryService');
    expect(detailSource).not.toContain('useDeliveries');
    expect(detailSource).not.toContain('FirestoreDeliveryDataSource');
  });

  it('contains only the scoped payment action and no other order mutation action', () => {
    expect(detailSource).toContain('RetailOrderPaymentSheet');
    expect(detailSource).toContain('Adicionar pagamento');
    expect(detailSource).toContain('onRegisterSuccess: handlePaymentRegistered');
    expect(detailSource).toContain('retailOrderHistoryFinancialSummaryService.updateForOrder');
    expect(detailSource).toContain("order.status !== 'cancelled'");
    expect(detailSource).toContain('summary.outstandingAmount > 0');
    expect(detailSource).toContain('onRegister={paymentState.register}');
    expect(detailSource).not.toContain('.update(');
    expect(detailSource).not.toContain('.cancel(');
    expect(detailSource).not.toContain('.complete(');
  });
});
