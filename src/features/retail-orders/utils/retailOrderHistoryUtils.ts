import type { RetailOrder } from '@/types/data';

export type RetailOrderHistoryDateRange = {
  startDate: string;
  endDate: string;
};

export type RetailOrderHistoryDateGroup = {
  date: string;
  orders: readonly RetailOrder[];
};

export function filterRetailOrdersByOrderDate(
  orders: readonly RetailOrder[],
  range: RetailOrderHistoryDateRange,
): readonly RetailOrder[] {
  return orders.filter(
    (order) => order.orderDate >= range.startDate && order.orderDate <= range.endDate,
  );
}

export function groupRetailOrdersByOrderDate(
  orders: readonly RetailOrder[],
  range: RetailOrderHistoryDateRange,
): readonly RetailOrderHistoryDateGroup[] {
  const grouped = new Map<string, RetailOrder[]>();

  filterRetailOrdersByOrderDate(orders, range).forEach((order) => {
    const dayOrders = grouped.get(order.orderDate) ?? [];
    dayOrders.push(order);
    grouped.set(order.orderDate, dayOrders);
  });

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, dayOrders]) => ({
      date,
      orders: [...dayOrders].sort((left, right) => left.orderId.localeCompare(right.orderId)),
    }));
}
