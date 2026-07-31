export type OpenPaymentPreview = {
  client: string;
  date: string;
  quantity: number;
  amount: string;
};

export const openPaymentPreview: readonly OpenPaymentPreview[] = [
  {
    client: 'Elias',
    date: '30/07/2026',
    quantity: 6,
    amount: 'R$ 298,80',
  },
  {
    client: 'Guilherme',
    date: '30/07/2026',
    quantity: 4,
    amount: 'R$ 194,00',
  },
  {
    client: 'Aldo',
    date: '29/07/2026',
    quantity: 3,
    amount: 'R$ 156,00',
  },
  {
    client: 'Rafael',
    date: '29/07/2026',
    quantity: 4,
    amount: 'R$ 124,00',
  },
  {
    client: 'Sofia',
    date: '28/07/2026',
    quantity: 3,
    amount: 'R$ 130,00',
  },
];

export const openPaymentsTotal = 'R$ 902,80';
