import { HistoryScreen } from '@/features/history';
import { RetailOrderHistoryScreen } from '@/features/retail-orders/components/RetailOrderHistoryScreen';
import { useAppMode } from '@/providers';

export default function HistoryRoute() {
  const { mode } = useAppMode();
  return mode === 'retail' ? <RetailOrderHistoryScreen /> : <HistoryScreen />;
}
