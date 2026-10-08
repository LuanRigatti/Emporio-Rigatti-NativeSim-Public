import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';

import { HistoryScreen } from '@/features/history';
import { RetailOrderHistoryScreen } from '@/features/retail-orders/components/RetailOrderHistoryScreen';
import { useAppMode } from '@/providers';

export default function HistoryRoute() {
  const { mode: requestedMode } = useLocalSearchParams<{ mode?: string | string[] }>();
  const { isReady, mode, setMode } = useAppMode();
  const modeIntentState = useRef<'idle' | 'applying' | 'consumed'>('idle');
  const requestsWholesale = requestedMode === 'wholesale';

  useEffect(() => {
    if (!requestsWholesale) {
      modeIntentState.current = 'idle';
      return;
    }
    if (!isReady) return;

    if (mode !== 'wholesale') {
      if (modeIntentState.current !== 'applying') {
        modeIntentState.current = 'applying';
        setMode('wholesale');
      }
      return;
    }

    if (modeIntentState.current !== 'consumed') {
      modeIntentState.current = 'consumed';
      router.setParams({ mode: undefined });
    }
  }, [isReady, mode, requestsWholesale, setMode]);

  if (requestsWholesale && (!isReady || mode !== 'wholesale')) return null;

  return mode === 'retail' ? <RetailOrderHistoryScreen /> : <HistoryScreen />;
}
