import { getUnambiguousCanonicalClientId } from '@/features/open-payments/utils/openPaymentBulkIdentity';
import type { Delivery } from '@/types/data';

function delivery(id: string, clientId?: Delivery['clientId'], cliente = 'Cliente'): Delivery {
  return {
    ...(clientId ? { clientId } : {}),
    cliente,
    data: '2026-10-10',
    entregue: true,
    id,
    quantidade: 1,
    status: 'Não Pago',
    valor: 50,
  };
}

describe('open payment bulk client identity', () => {
  it('accepts multiple deliveries with one canonical clientId even when names are historical', () => {
    expect(
      getUnambiguousCanonicalClientId([
        delivery('one', 'client:canonical', 'Nome atual'),
        delivery('two', 'client:canonical', 'Nome antigo'),
      ]),
    ).toBe('client:canonical');
  });

  it('rejects distinct canonical clients with identical displayed names', () => {
    expect(
      getUnambiguousCanonicalClientId([
        delivery('one', 'client:first', 'Maria Silva'),
        delivery('two', 'client:second', 'Maria Silva'),
      ]),
    ).toBeNull();
  });

  it.each([undefined, 'legacy:andré', 'client:', 'client:a/b'] as const)(
    'rejects missing, legacy, or malformed identity %s',
    (clientId) => {
      expect(getUnambiguousCanonicalClientId([delivery('one', clientId)])).toBeNull();
    },
  );

  it('rejects an empty card', () => {
    expect(getUnambiguousCanonicalClientId([])).toBeNull();
  });
});
