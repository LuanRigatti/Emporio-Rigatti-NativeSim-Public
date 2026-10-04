import { useLocalSearchParams } from 'expo-router';

import { FactoryPurchasePaymentScreen } from '@/features/factory-purchases/components/FactoryPurchasePaymentScreen';
import { useAddFactoryPurchasePayment } from '@/hooks/useFactoryPurchases';

export default function FactoryPurchasePaymentRoute() {
  const { purchaseId: rawPurchaseId } = useLocalSearchParams<{
    purchaseId?: string | string[];
  }>();
  const purchaseId = Array.isArray(rawPurchaseId) ? rawPurchaseId[0] : rawPurchaseId;
  const addPayment = useAddFactoryPurchasePayment();

  return <FactoryPurchasePaymentScreen onAddPayment={addPayment} purchaseId={purchaseId} />;
}
