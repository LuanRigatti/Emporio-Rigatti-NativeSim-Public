import { useMemo } from 'react';

import { summarizeClient } from '@/services/clients';
import type { ClientModel } from '@/types/data';
import type { UserDataSnapshot } from '@/services/data';
import { normalizeClientKey } from '@/utils/data';

export function useClientDetails(
  snapshot: UserDataSnapshot | null,
  client: ClientModel | undefined,
) {
  return useMemo(() => {
    if (!snapshot || !client) return null;
    return {
      client,
      summary: summarizeClient(snapshot.entregas, client.normalizedName),
      deliveries: snapshot.entregas.filter(
        (delivery) => normalizeClientKey(delivery.cliente) === client.normalizedName,
      ),
    };
  }, [client, snapshot]);
}
