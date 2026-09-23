import { useLocalSearchParams } from 'expo-router';

import { RetailProductEditScreen } from '@/features/retail-catalog/components/RetailProductEditScreen';

export default function RetailProductEditRoute() {
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  return <RetailProductEditScreen productId={productId} />;
}
