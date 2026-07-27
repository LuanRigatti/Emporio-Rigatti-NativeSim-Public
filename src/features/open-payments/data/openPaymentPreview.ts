export type OpenPaymentPreview = {
  client: string;
  quantity: string;
  pendingDeliveries: string;
  amount: string;
};

export const openPaymentPreview: readonly OpenPaymentPreview[] = [
  { client: 'Elias', quantity: '6 baldes', pendingDeliveries: '2 entr.', amount: 'R$ 298,80' },
  {
    client: 'Guilherme',
    quantity: '4 baldes',
    pendingDeliveries: '1 entr.',
    amount: 'R$ 194,00',
  },
  { client: 'Aldo', quantity: '3 baldes', pendingDeliveries: '1 entr.', amount: 'R$ 156,00' },
  { client: 'Rafael', quantity: '4 baldes', pendingDeliveries: '1 entr.', amount: 'R$ 124,00' },
  { client: 'Sofia', quantity: '3 baldes', pendingDeliveries: '1 entr.', amount: 'R$ 130,00' },
];

export const openPaymentsTotal = 'R$ 902,80';
