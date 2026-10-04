import type { NativeClientFormValues } from '@/components/native';
import { normalizeMoney } from '@/utils/data';

export type SaveCustomClient = (
  name: string,
  price: number,
  address: string,
  usesInvoice: boolean,
  usesBoleto: boolean,
) => Promise<void>;

export async function submitClientCreation(
  values: NativeClientFormValues,
  saveCustomClient: SaveCustomClient,
  testModeEnabled: boolean,
): Promise<void> {
  if (testModeEnabled) return;

  const price = normalizeMoney(values.bucketPrice);
  if (!values.name.trim()) throw new Error('Informe o nome do cliente.');
  if (price === undefined || price <= 0) {
    throw new Error('Informe um preço maior que zero.');
  }
  if (!values.address.trim()) throw new Error('Informe o endereço do cliente.');

  await saveCustomClient(values.name, price, values.address, values.usesInvoice, values.usesBoleto);
}
