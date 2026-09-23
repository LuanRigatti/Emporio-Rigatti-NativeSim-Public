import { useLocalSearchParams } from 'expo-router';

import { RetailProductEditScreen } from '@/features/retail-catalog/components/RetailProductEditScreen';

export default function RetailProductCreateRoute() {
  const { categoryId } = useLocalSearchParams<{ categoryId?: string }>();
  return <RetailProductEditScreen initialCategoryId={categoryId} mode="create" />;
}
