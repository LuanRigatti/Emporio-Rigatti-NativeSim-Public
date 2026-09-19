import type { FirestoreTimestamp } from './retailClient';
import type { RetailFinanceGroup } from './retailCategory';

export type RetailOrderStatus = 'created' | 'completed' | 'cancelled';

export type RetailFinancialStatus = 'unpaid' | 'partially_paid' | 'paid';

export type RetailPaymentMethod = 'Pix' | 'Dinheiro' | 'Crédito' | 'Débito' | 'Outro';

export type RetailPaymentStatus = 'posted' | 'voided';

export type RetailOrderLineItemInput = {
  productId: string;
  quantity: number;
};

export type RetailCostBreakdownSnapshot = {
  costItemId: string;
  costItemNameSnapshot: string;
  quantity: number;
  unit: string;
  effectiveDate: string;
  unitCostSnapshot: number;
  totalCostSnapshot: number;
};

export type RetailCompositionVersionSnapshot = {
  compositionVersionId: string;
  effectiveFrom: string;
  components: readonly RetailCostBreakdownSnapshot[];
};

export type RetailOrderLineItem = {
  productId: string;
  productNameSnapshot: string;
  categoryIdSnapshot: string;
  categorySnapshot: string;
  financeGroupSnapshot?: RetailFinanceGroup;
  variantSnapshot?: string;
  flavorSnapshot?: string;
  packageSizeSnapshot?: string;
  quantity: number;
  unitSalePriceSnapshot: number;
  lineSubtotal: number;
  discountAllocatedSnapshot: number;
  unitCostSnapshot: number;
  lineCostTotal: number;
  costBreakdownSnapshot: readonly RetailCostBreakdownSnapshot[];
  compositionVersionSnapshot?: RetailCompositionVersionSnapshot;
};

export type RetailOrder = {
  orderId: string;
  clientId: string;
  clientNameSnapshot: string;
  clientPhoneSnapshot?: string;
  clientAddressSnapshot?: string;
  orderDate: string;
  deliveryDate: string;
  deliveryAddressSnapshot: string;
  occasion?: string;
  recipient?: string;
  status: RetailOrderStatus;
  subtotalProducts: number;
  discount: number;
  deliveryFee: number;
  deliveryCost: number;
  totalCharged: number;
  notes?: string;
  lineItems: readonly RetailOrderLineItem[];
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
};

export type RetailOrderCreateInput = {
  clientId: string;
  clientNameSnapshot: string;
  clientPhoneSnapshot?: string;
  clientAddressSnapshot?: string;
  orderDate: string;
  deliveryDate: string;
  deliveryAddressSnapshot: string;
  occasion?: string;
  recipient?: string;
  discount: number;
  deliveryFee: number;
  deliveryCost: number;
  notes?: string;
  lineItems: readonly RetailOrderLineItemInput[];
};

export type RetailOrderPatch = {
  deliveryDate?: string;
  deliveryAddressSnapshot?: string;
  occasion?: string | null;
  recipient?: string | null;
  discount?: number;
  deliveryFee?: number;
  deliveryCost?: number;
  notes?: string | null;
};

export type RetailOrderQuery = {
  clientId?: string;
  status?: RetailOrderStatus;
  deliveryDateFrom?: string;
  deliveryDateTo?: string;
  includeCancelled?: boolean;
};

export type RetailPayment = {
  paymentId: string;
  amount: number;
  paidAt: string;
  method: RetailPaymentMethod;
  cardFee?: number;
  notes?: string;
  status: RetailPaymentStatus;
  createdAt: FirestoreTimestamp;
};

export type RetailPaymentDraft = {
  amount: number;
  paidAt: string;
  method: RetailPaymentMethod;
  cardFee?: number;
  notes?: string;
  status?: RetailPaymentStatus;
};

export type RetailOrderFinancialSummary = {
  subtotalProducts: number;
  discount: number;
  faturamentoProdutos: number;
  deliveryFee: number;
  deliveryCost: number;
  faturamentoTotal: number;
  custoProdutos: number;
  custoEntregas: number;
  taxasCartao: number;
  recebido: number;
  aReceber: number;
  paidAmount: number;
  outstandingAmount: number;
  totalCharged: number;
  financialStatus: RetailFinancialStatus;
  lucroBrutoProdutos: number;
  resultadoEntregas: number;
  lucroLiquido: number;
};
