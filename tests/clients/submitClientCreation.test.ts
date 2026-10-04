import { submitClientCreation } from '@/features/clients/submitClientCreation';
import type { NativeClientFormValues } from '@/components/native';

const validValues: NativeClientFormValues = {
  address: 'Rua Nova, 10',
  bucketPrice: 'R$ 49,80',
  name: 'Cliente Novo',
  usesBoleto: false,
  usesInvoice: true,
};

describe('submitClientCreation', () => {
  it('normalizes the bucket price and calls the current save handler with all client fields', async () => {
    const saveCustomClient = jest.fn().mockResolvedValue(undefined);

    await submitClientCreation(validValues, saveCustomClient, false);

    expect(saveCustomClient).toHaveBeenCalledWith(
      'Cliente Novo',
      49.8,
      'Rua Nova, 10',
      true,
      false,
    );
  });

  it.each([
    [{ ...validValues, name: ' ' }, 'Informe o nome do cliente.'],
    [{ ...validValues, bucketPrice: '0' }, 'Informe um preço maior que zero.'],
    [{ ...validValues, address: ' ' }, 'Informe o endereço do cliente.'],
  ])('preserves the existing form validation for %s', async (values, message) => {
    const saveCustomClient = jest.fn().mockResolvedValue(undefined);

    await expect(
      submitClientCreation(values as NativeClientFormValues, saveCustomClient, false),
    ).rejects.toThrow(message);
    expect(saveCustomClient).not.toHaveBeenCalled();
  });

  it('does not persist while Test Mode is active', async () => {
    const saveCustomClient = jest.fn().mockResolvedValue(undefined);

    await submitClientCreation(validValues, saveCustomClient, true);

    expect(saveCustomClient).not.toHaveBeenCalled();
  });
});
