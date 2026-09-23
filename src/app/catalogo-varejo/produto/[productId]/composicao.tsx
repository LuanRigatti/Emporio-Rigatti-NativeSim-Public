import { useLocalSearchParams } from 'expo-router';

import { RetailCompositionEditScreen } from '@/features/retail-catalog/components/RetailCompositionEditScreen';

export default function RetailCompositionEditRoute() {
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  return <RetailCompositionEditScreen productId={productId} />;
}
