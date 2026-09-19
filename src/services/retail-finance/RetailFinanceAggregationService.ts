import type {
  FinancialSeriesPoint,
  RetailCategory,
  RetailOrder,
  RetailPayment,
} from '@/types/data';
import { centsToMoney, moneyToCents } from '@/services/retail-orders/retailOrderUtils';

export const RETAIL_FINANCE_GENERAL_VIEW = 'general' as const;

export type RetailFinanceView = typeof RETAIL_FINANCE_GENERAL_VIEW | `category:${string}`;

export type RetailFinanceCategoryOption = {
  categoryId: string;
  label: string;
};

export type RetailFinancePeriod = {
  endDate: string;
  startDate: string;
};

export type RetailFinanceSummary = {
  deliveryCostRecognized: number;
  deliveryFeeRecognized: number;
  margin: number;
  orderCount: number;
  paymentFees: number;
  productCostRecognized: number;
  productRevenueRecognized: number;
  profit: number;
  revenueReceived: number;
  series: readonly FinancialSeriesPoint[];
  unitsSold: number;
  view: RetailFinanceView;
};

type PostedPayment = RetailPayment & { orderId: string };

type PaymentAllocation = {
  deliveryCost: number;
  deliveryFee: number;
  payment: PostedPayment;
  paymentFee: number;
  productCostByCategoryId: ReadonlyMap<string, number>;
  productRevenueByCategoryId: ReadonlyMap<string, number>;
};

function cents(value: number): number {
  return Math.max(0, moneyToCents(Number.isFinite(value) ? value : 0));
}

function dateKey(value: string): string {
  return value.trim().slice(0, 10);
}

function inPeriod(value: string, period: RetailFinancePeriod): boolean {
  const key = dateKey(value);
  return key >= period.startDate && key <= period.endDate;
}

export function retailFinanceViewForCategory(categoryId: string): RetailFinanceView {
  return `category:${categoryId}`;
}

export function retailFinanceCategoryIdFromView(view: RetailFinanceView): string | undefined {
  if (view === RETAIL_FINANCE_GENERAL_VIEW) return undefined;
  return view.slice('category:'.length);
}

export function buildRetailFinanceCategoryOptions(
  categories: readonly RetailCategory[],
  orders: readonly RetailOrder[],
): readonly RetailFinanceCategoryOption[] {
  const current = new Map<string, RetailFinanceCategoryOption>();
  const known = new Map<string, RetailFinanceCategoryOption>();
  for (const category of categories) {
    if (!category.categoryId) continue;
    const option = { categoryId: category.categoryId, label: category.label };
    known.set(category.categoryId, option);
    if (category.active) current.set(category.categoryId, option);
  }

  const historical = new Map<string, RetailFinanceCategoryOption>();
  for (const order of orders) {
    for (const lineItem of order.lineItems) {
      const categoryId = lineItem.categoryIdSnapshot?.trim();
      if (!categoryId || current.has(categoryId) || historical.has(categoryId)) continue;
      const label = known.get(categoryId)?.label?.trim() || lineItem.categorySnapshot.trim();
      historical.set(categoryId, {
        categoryId,
        label: label || categoryId,
      });
    }
  }

  return [
    ...current.values(),
    ...[...historical.values()].sort(
      (left, right) =>
        left.label.localeCompare(right.label, 'pt-BR') ||
        left.categoryId.localeCompare(right.categoryId),
    ),
  ];
}

function effectivePaymentWeights(paymentCents: readonly number[], denominator: number): number[] {
  let remaining = Math.max(0, denominator);
  return paymentCents.map((value) => {
    const weight = Math.min(value, remaining);
    remaining -= weight;
    return weight;
  });
}

function allocateCents(
  totalCents: number,
  weights: readonly number[],
  denominator: number,
): number[] {
  if (totalCents <= 0 || denominator <= 0 || weights.length === 0) {
    return weights.map(() => 0);
  }
  const effectiveWeights = effectivePaymentWeights(weights, denominator);
  const raw = effectiveWeights.map((weight) => (totalCents * weight) / denominator);
  const allocations = raw.map(Math.floor);
  const target = Math.min(
    totalCents,
    Math.round(
      (totalCents * effectiveWeights.reduce((sum, value) => sum + value, 0)) / denominator,
    ),
  );
  let remainder = target - allocations.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ fraction: value - Math.floor(value), index }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);
  for (const item of order) {
    if (remainder <= 0) break;
    allocations[item.index] += 1;
    remainder -= 1;
  }
  return allocations;
}

function lineTotals(order: RetailOrder): {
  costByCategoryId: ReadonlyMap<string, number>;
  revenueByCategoryId: ReadonlyMap<string, number>;
  unitsByCategoryId: ReadonlyMap<string, number>;
} {
  const costByCategoryId = new Map<string, number>();
  const revenueByCategoryId = new Map<string, number>();
  const unitsByCategoryId = new Map<string, number>();
  for (const lineItem of order.lineItems) {
    const categoryId = lineItem.categoryIdSnapshot;
    revenueByCategoryId.set(
      categoryId,
      (revenueByCategoryId.get(categoryId) ?? 0) +
        cents(Math.max(0, lineItem.lineSubtotal - lineItem.discountAllocatedSnapshot)),
    );
    costByCategoryId.set(
      categoryId,
      (costByCategoryId.get(categoryId) ?? 0) + cents(lineItem.lineCostTotal),
    );
    unitsByCategoryId.set(categoryId, (unitsByCategoryId.get(categoryId) ?? 0) + lineItem.quantity);
  }
  return { costByCategoryId, revenueByCategoryId, unitsByCategoryId };
}

function buildAllocations(
  order: RetailOrder,
  payments: readonly RetailPayment[],
): PaymentAllocation[] {
  const posted = payments
    .filter((payment) => payment.status === 'posted' && payment.amount > 0)
    .sort(
      (left, right) =>
        left.paidAt.localeCompare(right.paidAt) || left.paymentId.localeCompare(right.paymentId),
    )
    .map((payment) => ({ ...payment, orderId: order.orderId }));
  const denominator = cents(order.totalCharged);
  const paymentWeights = posted.map((payment) => cents(payment.amount));
  const { costByCategoryId, revenueByCategoryId } = lineTotals(order);
  const revenueAllocations = new Map<string, number[]>();
  const costAllocations = new Map<string, number[]>();
  for (const [categoryId, value] of revenueByCategoryId) {
    revenueAllocations.set(categoryId, allocateCents(value, paymentWeights, denominator));
  }
  for (const [categoryId, value] of costByCategoryId) {
    costAllocations.set(categoryId, allocateCents(value, paymentWeights, denominator));
  }
  const deliveryFeeAllocations = allocateCents(
    cents(order.deliveryFee),
    paymentWeights,
    denominator,
  );
  const deliveryCostAllocations = allocateCents(
    cents(order.deliveryCost),
    paymentWeights,
    denominator,
  );

  return posted.map((payment, index) => {
    const productRevenueByCategoryId = new Map<string, number>();
    const productCostByCategoryId = new Map<string, number>();
    for (const [categoryId] of revenueByCategoryId) {
      productRevenueByCategoryId.set(categoryId, revenueAllocations.get(categoryId)?.[index] ?? 0);
    }
    for (const [categoryId] of costByCategoryId) {
      productCostByCategoryId.set(categoryId, costAllocations.get(categoryId)?.[index] ?? 0);
    }
    return {
      deliveryCost: deliveryCostAllocations[index] ?? 0,
      deliveryFee: deliveryFeeAllocations[index] ?? 0,
      payment,
      paymentFee: cents(payment.cardFee ?? 0),
      productCostByCategoryId,
      productRevenueByCategoryId,
    };
  });
}

export class RetailFinanceAggregationService {
  public aggregate(
    orders: readonly RetailOrder[],
    paymentsByOrderId: ReadonlyMap<string, readonly RetailPayment[]>,
    period: RetailFinancePeriod,
    view: RetailFinanceView,
  ): RetailFinanceSummary {
    const categoryId = retailFinanceCategoryIdFromView(view);
    const seriesByDate = new Map<string, number>();
    const orderIds = new Set<string>();
    let revenueReceived = 0;
    let productRevenueRecognized = 0;
    let productCostRecognized = 0;
    let deliveryFeeRecognized = 0;
    let deliveryCostRecognized = 0;
    let paymentFees = 0;
    let unitsSold = 0;
    const countedOrderIds = new Set<string>();

    for (const order of orders) {
      const allocations = buildAllocations(order, paymentsByOrderId.get(order.orderId) ?? []);
      const { unitsByCategoryId } = lineTotals(order);
      for (const allocation of allocations) {
        if (!inPeriod(allocation.payment.paidAt, period)) continue;
        const selectedRevenue = categoryId
          ? (allocation.productRevenueByCategoryId.get(categoryId) ?? 0)
          : cents(allocation.payment.amount);
        if (selectedRevenue <= 0) continue;
        orderIds.add(order.orderId);
        revenueReceived += selectedRevenue;
        productRevenueRecognized += categoryId
          ? (allocation.productRevenueByCategoryId.get(categoryId) ?? 0)
          : [...allocation.productRevenueByCategoryId.values()].reduce(
              (sum, value) => sum + value,
              0,
            );
        productCostRecognized += categoryId
          ? (allocation.productCostByCategoryId.get(categoryId) ?? 0)
          : [...allocation.productCostByCategoryId.values()].reduce((sum, value) => sum + value, 0);
        if (!categoryId) {
          deliveryFeeRecognized += allocation.deliveryFee;
          deliveryCostRecognized += allocation.deliveryCost;
          paymentFees += allocation.paymentFee;
        }
        if (!countedOrderIds.has(order.orderId)) {
          unitsSold += categoryId
            ? (unitsByCategoryId.get(categoryId) ?? 0)
            : [...unitsByCategoryId.values()].reduce((sum, value) => sum + value, 0);
          countedOrderIds.add(order.orderId);
        }
        const key = dateKey(allocation.payment.paidAt);
        seriesByDate.set(key, (seriesByDate.get(key) ?? 0) + selectedRevenue);
      }
    }

    const revenue = centsToMoney(revenueReceived);
    const productCost = centsToMoney(productCostRecognized);
    const deliveryCost = centsToMoney(deliveryCostRecognized);
    const fees = centsToMoney(paymentFees);
    const profit = centsToMoney(
      revenueReceived - productCostRecognized - paymentFees - deliveryCostRecognized,
    );
    return {
      deliveryCostRecognized: deliveryCost,
      deliveryFeeRecognized: centsToMoney(deliveryFeeRecognized),
      margin: revenue > 0 ? (profit / revenue) * 100 : 0,
      orderCount: orderIds.size,
      paymentFees: fees,
      productCostRecognized: productCost,
      productRevenueRecognized: centsToMoney(productRevenueRecognized),
      profit,
      revenueReceived: revenue,
      series: [...seriesByDate]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => ({ key, label: key.slice(5), value: centsToMoney(value) })),
      unitsSold,
      view,
    };
  }
}

export const retailFinanceAggregationService = new RetailFinanceAggregationService();
