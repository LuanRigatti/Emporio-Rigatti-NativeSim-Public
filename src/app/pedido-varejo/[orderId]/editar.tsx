import { useLocalSearchParams } from 'expo-router';

import { RetailOrderEditScreen } from '@/features/retail-orders/components/RetailOrderEditScreen';

export default function RetailOrderEditRoute() {
  const { orderId: rawOrderId } = useLocalSearchParams<{ orderId?: string | string[] }>();
  const orderId = Array.isArray(rawOrderId) ? rawOrderId[0] : rawOrderId;

  return <RetailOrderEditScreen orderId={orderId} />;
}
