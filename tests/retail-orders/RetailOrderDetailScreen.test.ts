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

  it('contains scoped payment, lifecycle and edit actions without changing existing actions', () => {
    expect(detailSource).toContain('RetailOrderPaymentSheet');
    expect(detailSource).toContain('Adicionar pagamento');
    expect(detailSource).toContain('onRegisterSuccess: handlePaymentRegistered');
    expect(detailSource).toContain('onVoidSuccess: handlePaymentVoided');
    expect(detailSource).toContain('retailOrderHistoryFinancialSummaryService.updateForOrder');
    expect(detailSource).toContain("order.status !== 'cancelled'");
    expect(detailSource).toContain('summary.outstandingAmount > 0');
    expect(detailSource).toContain('onRegister={paymentState.register}');
    expect(detailSource).toContain('useRetailOrderStatus');
    expect(detailSource).toContain('Ações do pedido');
    expect(detailSource).toContain('Concluir pedido');
    expect(detailSource).toContain('Cancelar pedido');
    expect(detailSource).toContain('Anular pagamento');
    expect(detailSource).toContain('Editar pedido');
    expect(detailSource).toContain(
      "router.push({ pathname: '/pedido-varejo/[orderId]/editar', params: { orderId } })",
    );
    expect(detailSource).toContain('voidPayment');
    expect(detailSource).toContain("payment.status === 'posted'");
    expect(detailSource).toContain('O pagamento permanecerá no histórico');
    expect(detailSource).toContain('NativeDialog');
    expect(detailSource).toContain("order.status === 'created'");
    expect(detailSource).not.toContain('.update(');
    expect(detailSource).not.toContain('router.replace');
  });
});
