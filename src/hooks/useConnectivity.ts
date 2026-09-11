import { useEffect, useState } from 'react';

import { connectivityService, type ConnectivityState } from '@/services/connectivity';

export function useConnectivity(): ConnectivityState | null {
  const [state, setState] = useState<ConnectivityState | null>(null);

  useEffect(() => {
    let mounted = true;
    void connectivityService.getCurrentState().then((nextState) => {
      if (mounted) setState(nextState);
    });
    const unsubscribe = connectivityService.subscribe((nextState) => {
      if (mounted) setState(nextState);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return state;
}
