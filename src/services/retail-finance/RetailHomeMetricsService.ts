import { calculateRetailOrderFinancials } from '@/services/retail-orders/RetailOrderCalculationService';
import { centsToMoney, moneyToCents } from '@/services/retail-orders/retailOrderUtils';
import type { RetailFinanceDataset } from './RetailFinanceDatasetService';

export function calculateRetailHomeReceivable(dataset: RetailFinanceDataset): number {
  const totalCents = dataset.orders.reduce((total, order) => {
    if (order.status !== 'created' && order.status !== 'completed') return total;
    const financials = calculateRetailOrderFinancials({
      order,
      payments: dataset.paymentsByOrderId.get(order.orderId) ?? [],
    });
    return total + moneyToCents(Math.max(0, financials.outstandingAmount));
  }, 0);
  return centsToMoney(totalCents);
}
