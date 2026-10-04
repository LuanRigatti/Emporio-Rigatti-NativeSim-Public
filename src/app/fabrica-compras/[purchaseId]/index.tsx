import { useLocalSearchParams } from 'expo-router';

import { FactoryPurchaseDetailsScreen } from '@/features/factory-purchases/components/FactoryPurchaseDetailsScreen';

export default function FactoryPurchaseDetailsRoute() {
  const { purchaseId: rawPurchaseId } = useLocalSearchParams<{
    purchaseId?: string | string[];
  }>();
  const purchaseId = Array.isArray(rawPurchaseId) ? rawPurchaseId[0] : rawPurchaseId;

  return <FactoryPurchaseDetailsScreen purchaseId={purchaseId} />;
}
