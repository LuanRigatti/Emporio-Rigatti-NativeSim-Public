import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/providers';
import {
  addAppDelivery,
  loadAppData,
  removeAppDelivery,
  subscribeToAppData,
  toggleAppDelivery,
  type AppDataMode,
  type DeliveryRegistrationInput,
  APP_DATA_MODE,
} from '@/services/data/AppDataSource';
import type { UserDataSnapshot } from '@/services/data';

export function useAppData() {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<UserDataSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(
    async (isRefresh = false) => {
      if (APP_DATA_MODE === 'firebase' && !user) {
        setLoading(false);
        setError('SessÃ£o nÃ£o disponÃ­vel.');
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(undefined);

      try {
        setSnapshot(await loadAppData(user?.id));
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : 'NÃ£o foi possÃ­vel carregar os dados.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user],
  );

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const unsubscribe = subscribeToAppData(() => void load(true));
    return unsubscribe;
  }, [load]);

  const toggleDelivery = useCallback(
    async (deliveryId: string) => {
      await toggleAppDelivery(user?.id, deliveryId);
      await load(true);
    },
    [load, user?.id],
  );

  const addDelivery = useCallback(
    async (input: DeliveryRegistrationInput) => {
      const delivery = await addAppDelivery(input);
      await load(true);
      return delivery;
    },
    [load],
  );

  const removeDelivery = useCallback(
    async (deliveryId: string) => {
      await removeAppDelivery(user?.id, deliveryId);
      await load(true);
    },
    [load, user?.id],
  );

  const refresh = useCallback(() => load(true), [load]);

  return {
    error,
    addDelivery,
    loading,
    mode: APP_DATA_MODE as AppDataMode,
    refresh,
    refreshing,
    removeDelivery,
    snapshot,
    toggleDelivery,
  };
}
