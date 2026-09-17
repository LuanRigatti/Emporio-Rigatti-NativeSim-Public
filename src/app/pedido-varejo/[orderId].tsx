import { useLocalSearchParams } from 'expo-router';

import { RetailOrderDetailScreen } from '@/features/retail-orders/components/RetailOrderDetailScreen';

export default function RetailOrderDetailRoute() {
  const { orderId: rawOrderId } = useLocalSearchParams<{ orderId?: string | string[] }>();
  const orderId = Array.isArray(rawOrderId) ? rawOrderId[0] : rawOrderId;

  return <RetailOrderDetailScreen orderId={orderId} />;
}
