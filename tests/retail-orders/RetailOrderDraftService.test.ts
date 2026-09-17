import {
  buildRetailInitialPaymentDraft,
  buildRetailOrderCreateInput,
  calculateRetailInitialPaymentPreview,
  calculateRetailOrderDraftTotals,
} from '@/services/retail-orders/RetailOrderDraftService';
import type { RetailClient, RetailProduct } from '@/types/data';

const timestamp = {} as RetailProduct['createdAt'];

function product(productId: string, standardSalePrice: number): RetailProduct {
  return {
    active: true,
    categoryId: 'baskets',
    createdAt: timestamp,
    productId,
    productName: productId === 'basket' ? 'Cesta' : 'Salgado',
    standardSalePrice,
    updatedAt: timestamp,
  };
}

const client: RetailClient = {
  active: true,
  clientId: 'client-1',
  createdAt: timestamp,
  defaultDeliveryFee: 12,
  name: 'Cliente Varejo',
  normalizedName: 'cliente varejo',
  phone: '99999-0000',
  updatedAt: timestamp,
};

describe('RetailOrderDraftService', () => {
  it('calculates draft subtotal, discount, delivery fee and total in cents', () => {
    const totals = calculateRetailOrderDraftTotals({
      deliveryFee: '5',
      discount: '0,40',
      lineItems: [
        { productId: 'basket', quantity: '2' },
        { productId: 'snack', quantity: '1' },
      ],
      products: [product('basket', 15.25), product('snack', 9.9)],
    });

    expect(totals.subtotalProducts).toBe(40.4);
    expect(totals.discount).toBe(0.4);
    expect(totals.deliveryFee).toBe(5);
    expect(totals.totalCharged).toBe(45);
    expect(totals.lines).toEqual([
      { lineSubtotal: 30.5, productId: 'basket', quantity: 2, unitSalePrice: 15.25 },
      { lineSubtotal: 9.9, productId: 'snack', quantity: 1, unitSalePrice: 9.9 },
    ]);
  });

  it('creates the builder input from the selected client and draft lines', () => {
    const input = buildRetailOrderCreateInput(
      {
        clientId: client.clientId,
        deliveryAddressSnapshot: 'Rua do pedido, 10',
        deliveryCost: '3',
        deliveryDate: '2026-09-20',
        deliveryFee: '12',
        discount: '2',
        lineItems: [{ productId: 'basket', quantity: '2' }],
        occasion: 'Aniversário',
        notes: 'Ligar antes',
        orderDate: '2026-09-15',
        recipient: 'Ana',
      },
      client,
      [product('basket', 15)],
    );

    expect(input).toEqual({
      clientAddressSnapshot: undefined,
      clientId: 'client-1',
      clientNameSnapshot: 'Cliente Varejo',
      clientPhoneSnapshot: '99999-0000',
      deliveryAddressSnapshot: 'Rua do pedido, 10',
      deliveryCost: 3,
      deliveryDate: '2026-09-20',
      deliveryFee: 12,
      discount: 2,
      lineItems: [{ productId: 'basket', quantity: 2 }],
      notes: 'Ligar antes',
      occasion: 'Aniversário',
      orderDate: '2026-09-15',
      recipient: 'Ana',
    });
  });

  it('allows no initial payment and validates a posted payment draft', () => {
    expect(
      buildRetailInitialPaymentDraft(
        { amount: '', cardFee: '', method: 'Pix', notes: '', paidAt: '2026-09-15' },
        100,
      ),
    ).toBeUndefined();

    expect(
      buildRetailInitialPaymentDraft(
        { amount: 'R$ 0,00', cardFee: 'invalid', method: 'Pix', notes: '', paidAt: '' },
        100,
      ),
    ).toBeUndefined();

    expect(
      buildRetailInitialPaymentDraft(
        {
          amount: '40',
          cardFee: '1,50',
          method: 'Crédito',
          notes: 'Sinal',
          paidAt: '2026-09-15',
        },
        100,
      ),
    ).toEqual({
      amount: 40,
      cardFee: 1.5,
      method: 'Crédito',
      notes: 'Sinal',
      paidAt: '2026-09-15',
    });
  });

  it('previews the amount still outstanding without duplicating payment rules', () => {
    expect(
      calculateRetailInitialPaymentPreview(
        { amount: '40', cardFee: '', method: 'Pix', notes: '', paidAt: '2026-09-15' },
        100,
      ),
    ).toEqual({ amount: 40, outstandingAmount: 60 });

    expect(
      calculateRetailInitialPaymentPreview(
        { amount: '0,00', cardFee: '', method: 'Pix', notes: '', paidAt: '2026-09-15' },
        100,
      ),
    ).toEqual({ amount: 0, outstandingAmount: 100 });
  });

  it('rejects invalid quantities, discounts and payments', () => {
    expect(() =>
      calculateRetailOrderDraftTotals({
        deliveryFee: '0',
        discount: '0',
        lineItems: [{ productId: 'basket', quantity: '0' }],
        products: [product('basket', 15)],
      }),
    ).toThrow('A quantidade do produto deve ser maior que zero.');
    expect(() =>
      calculateRetailOrderDraftTotals({
        deliveryFee: '0',
        discount: '20',
        lineItems: [{ productId: 'basket', quantity: '1' }],
        products: [product('basket', 15)],
      }),
    ).toThrow('O desconto não pode superar o subtotal.');
    expect(() =>
      buildRetailInitialPaymentDraft(
        { amount: '101', cardFee: '', method: 'Pix', notes: '', paidAt: '2026-09-15' },
        100,
      ),
    ).toThrow('O pagamento não pode superar o total cobrado.');
  });
});
