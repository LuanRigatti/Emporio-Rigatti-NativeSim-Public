import type { DailyExpenses, Delivery, FinancialCalculationInput, MonthlyExpenses } from '@/types/data';

export const ionicToday = new Date('2026-07-24T12:00:00');

export const ionicPriceFixtures = [
  { id: 'before-legacy-cutoff', clientName: 'Guilherme', date: '2025-05-04', quantity: 2, expected: 81 },
  { id: 'at-legacy-cutoff', clientName: 'Guilherme', date: '2025-05-05', quantity: 2, expected: 89 },
  { id: 'before-current-cutoff', clientName: 'Guilherme', date: '2026-04-04', quantity: 2, expected: 89 },
  { id: 'at-current-cutoff', clientName: 'Guilherme', date: '2026-04-05', quantity: 2, expected: 97 },
  {
    id: 'custom-precedence',
    clientName: 'Cliente Customizado',
    date: '2024-01-01',
    quantity: 2,
    customClients: { 'Cliente Customizado': { nome: 'Cliente Customizado', preco: 60 } },
    expected: 120,
  },
  { id: 'alias-resolution', clientName: 'Santos', date: '2026-04-05', quantity: 1, expected: 49.8 },
] as const;

export const ionicBucketAndPaymentsDeliveries: Delivery[] = [
  {
    id: 'bucket-before-cutoff',
    cliente: 'Guilherme',
    quantidade: 2,
    valor: 100,
    status: 'Pago',
    entregue: true,
    data: '2026-03-19',
  },
  {
    id: 'bucket-at-cutoff',
    cliente: 'Guilherme',
    quantidade: 3,
    valor: 80,
    status: 'Não Pago',
    entregue: true,
    data: '2026-03-20',
  },
];

export const ionicWorkingDayDeliveries: Delivery[] = [
  {
    id: 'custom-working-day',
    cliente: 'Cliente Customizado',
    quantidade: 2,
    valor: 120,
    status: 'Pago',
    entregue: true,
    data: '2026-07-01',
  },
  {
    id: 'alias-working-day',
    cliente: 'Santos',
    quantidade: 3,
    valor: 149.4,
    status: 'Não Pago',
    entregue: true,
    data: '2026-07-01',
  },
];

export const ionicWorkingDayExpenses: DailyExpenses = {
  '2026-04-30': { data: '2026-04-30', gasolina: 180 },
  '2026-05-01': {
    data: '2026-05-01',
    km: 74,
    precoGasolina: 6,
    tipoCombustivel: 'gasolina',
  },
  '2026-06-30': { data: '2026-06-30', km: 74, precoGasolina: 6 },
  '2026-07-01': { data: '2026-07-01', km: 74, precoGasolina: 6, tipoCombustivel: 'etanol', estar: 20 },
};

export const ionicWorkingDayMonthlyExpenses: MonthlyExpenses = {
  '2026-07': { luz: 100 },
};

export const ionicSummaryFixture: FinancialCalculationInput = {
  deliveries: ionicBucketAndPaymentsDeliveries,
  dailyExpenses: {},
  monthlyExpenses: {},
  filters: { periodo: 'todos' },
  today: ionicToday,
};

export const ionicMonthlyComparisonFixture: FinancialCalculationInput = {
  deliveries: [
    {
      id: 'comparison-current',
      cliente: 'Guilherme',
      quantidade: 1,
      valor: 120,
      status: 'Pago',
      entregue: true,
      data: '2026-07-01',
    },
    {
      id: 'comparison-previous',
      cliente: 'Guilherme',
      quantidade: 1,
      valor: 100,
      status: 'Pago',
      entregue: true,
      data: '2026-06-01',
    },
  ],
  dailyExpenses: {},
  monthlyExpenses: {},
  filters: { periodo: 'mes', mesSelecionado: '2026-07' },
  today: ionicToday,
};
