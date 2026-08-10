import type { ClientModel, CustomClient, Delivery } from '@/types/data';
import { CustomClientRepository } from '@/repositories/CustomClientRepository';
import { DeliveryRepository } from '@/repositories/DeliveryRepository';
import { asyncStorageCacheService } from '@/services/cache';
import { userDataService } from '@/services/data';
import type { UserDataSnapshot } from '@/services/data';
import { formatClientName, isAliasName, normalizeClientKey } from '@/utils/data';

import { calculateClientImpact, type ClientImpact } from './ClientImpactService';
import { clientBackupService } from './ClientBackupService';
import { clientIdentityRegistry } from './ClientIdentityRegistry';

export interface ClientMutationResult {
  snapshot: UserDataSnapshot;
  impact: ClientImpact;
}

function findCustomKey(
  customClients: Record<string, CustomClient>,
  normalizedName: string,
): string | undefined {
  return Object.keys(customClients).find((name) => normalizeClientKey(name) === normalizedName);
}

function validateNewName(
  newName: string,
  oldName: string,
  customClients: Record<string, CustomClient>,
): string {
  const canonicalName = formatClientName(newName);
  if (!canonicalName) throw new Error('Informe o nome do cliente.');
  if (isAliasName(newName)) {
    throw new Error('Este cliente já existe através de um alias. Escolha outro nome.');
  }

  const normalizedNewName = normalizeClientKey(canonicalName);
  const normalizedOldName = normalizeClientKey(oldName);
  const existingKey = findCustomKey(customClients, normalizedNewName);
  if (existingKey && normalizeClientKey(existingKey) !== normalizedOldName) {
    throw new Error('Já existe um cliente personalizado com esse nome.');
  }
  return canonicalName;
}

export class ClientMutationService {
  public constructor(
    private readonly uid: string,
    private readonly readSnapshot: () => Promise<UserDataSnapshot> = () =>
      userDataService.readFromFirebase(uid),
  ) {}

  public async saveCustomClient(
    name: string,
    price: number,
    address: string,
    usesInvoice = false,
  ): Promise<void> {
    const snapshot = await this.readSnapshot();
    const canonicalName = formatClientName(name);
    if (!canonicalName) throw new Error('Informe o nome do cliente.');
    if (isAliasName(name)) {
      throw new Error('Este cliente já existe através de um alias. Escolha outro nome.');
    }
    if (!Number.isFinite(price) || price <= 0) throw new Error('Informe um preço maior que zero.');
    if (!address.trim()) throw new Error('Informe o endereço do cliente.');

    const existingKey = findCustomKey(snapshot.clientesCustom, normalizeClientKey(canonicalName));
    const nextCustomClients = { ...snapshot.clientesCustom };
    if (existingKey && normalizeClientKey(existingKey) !== normalizeClientKey(canonicalName)) {
      throw new Error('Já existe um cliente personalizado com esse nome.');
    }
    nextCustomClients[existingKey ?? canonicalName] = {
      ...(existingKey ? nextCustomClients[existingKey] : undefined),
      nome: canonicalName,
      preco: price,
      endereco: address.trim(),
      usesInvoice,
    };
    await clientBackupService.create(this.uid, snapshot);
    await new CustomClientRepository(this.uid).replace(nextCustomClients);
    await asyncStorageCacheService.write(this.uid, {
      ...snapshot,
      clientesCustom: nextCustomClients,
    });
  }

  public async updatePrice(
    client: ClientModel,
    price: number,
    usesInvoice = client.usesInvoice,
  ): Promise<void> {
    const snapshot = await this.readSnapshot();
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error('Informe um preço maior que zero.');
    }

    const customKey = findCustomKey(snapshot.clientesCustom, client.normalizedName);
    const currentConfig = customKey ? snapshot.clientesCustom[customKey] : client.customConfig;
    const nextCustomClients = { ...snapshot.clientesCustom };
    nextCustomClients[customKey ?? client.canonicalName] = {
      ...(currentConfig ?? {}),
      ...(currentConfig || !client.address ? {} : { endereco: client.address }),
      nome: client.canonicalName,
      preco: price,
      usesInvoice,
    };

    await clientBackupService.create(this.uid, snapshot);
    await new CustomClientRepository(this.uid).replace(nextCustomClients);
    await asyncStorageCacheService.write(this.uid, {
      ...snapshot,
      clientesCustom: nextCustomClients,
    });
  }

  public async rename(client: ClientModel, newName: string): Promise<ClientMutationResult> {
    const snapshot = await this.readSnapshot();
    const customKey = findCustomKey(snapshot.clientesCustom, client.normalizedName);
    if (!customKey) throw new Error('Somente clientes personalizados podem ser renomeados.');

    const canonicalName = validateNewName(newName, client.canonicalName, snapshot.clientesCustom);
    const impact = calculateClientImpact(snapshot, client);
    await clientBackupService.create(this.uid, snapshot);

    const nextDeliveries: Delivery[] = snapshot.entregas.map((delivery) =>
      normalizeClientKey(delivery.cliente) === client.normalizedName
        ? { ...delivery, cliente: canonicalName }
        : delivery,
    );
    const customConfig = snapshot.clientesCustom[customKey];
    const nextCustomClients: Record<string, CustomClient> = { ...snapshot.clientesCustom };
    delete nextCustomClients[customKey];
    nextCustomClients[canonicalName] = { ...customConfig, nome: canonicalName };

    const deliveryRepository = new DeliveryRepository(this.uid);
    const customClientRepository = new CustomClientRepository(this.uid);
    try {
      await deliveryRepository.replace(nextDeliveries);
      await customClientRepository.replace(nextCustomClients);
    } catch (error) {
      try {
        await deliveryRepository.replace(snapshot.entregas);
        await customClientRepository.replace(snapshot.clientesCustom);
      } catch (rollbackError) {
        throw new Error(`Renomeação incompleta e rollback falhou: ${String(rollbackError)}`);
      }
      throw error;
    }

    const nextSnapshot = {
      ...snapshot,
      entregas: nextDeliveries,
      clientesCustom: nextCustomClients,
    };
    await clientIdentityRegistry.rememberRename(
      this.uid,
      client.canonicalName,
      canonicalName,
      client.clientId,
    );
    await asyncStorageCacheService.write(this.uid, nextSnapshot);
    return { snapshot: nextSnapshot, impact };
  }

  public async removeCustomConfiguration(client: ClientModel): Promise<ClientMutationResult> {
    const snapshot = await this.readSnapshot();
    const customKey = findCustomKey(snapshot.clientesCustom, client.normalizedName);
    if (!customKey) throw new Error('Configuração personalizada não encontrada.');

    const impact = calculateClientImpact(snapshot, client);
    await clientBackupService.create(this.uid, snapshot);
    const nextCustomClients = { ...snapshot.clientesCustom };
    delete nextCustomClients[customKey];
    await new CustomClientRepository(this.uid).replace(nextCustomClients);

    const nextSnapshot = { ...snapshot, clientesCustom: nextCustomClients };
    await asyncStorageCacheService.write(this.uid, nextSnapshot);
    return { snapshot: nextSnapshot, impact };
  }
}
