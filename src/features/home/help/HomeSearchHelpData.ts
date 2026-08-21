import type { SearchHelpCategory, SearchHelpExample } from './HomeSearchHelpTypes';

export const HOME_SEARCH_HELP_SUGGESTIONS: readonly SearchHelpExample[] = [
  { id: 'suggestion-revenue', label: 'Faturamento', query: 'faturamento agosto' },
  { id: 'suggestion-net-profit', label: 'Lucro Líquido', query: 'lucro líquido agosto' },
  { id: 'suggestion-summary', label: 'Resumo', query: 'resumo agosto' },
  { id: 'suggestion-summary-today', label: 'Resumo Hoje', query: 'resumo hoje' },
  { id: 'suggestion-routes', label: 'Rotas', query: 'rota agosto' },
];

export const HOME_SEARCH_HELP_CATEGORIES: readonly SearchHelpCategory[] = [
  {
    id: 'clients',
    title: 'Clientes',
    systemImage: 'person.2.fill',
    examples: [
      {
        id: 'client-name',
        label: 'Luciano',
        query: 'Luciano',
        description: 'Métricas completas de todo o histórico',
      },
      {
        id: 'client-month',
        label: 'Luciano agosto',
        query: 'Luciano agosto',
        description: 'Resumo e participações em agosto',
      },
      {
        id: 'client-relative-month',
        label: 'Luciano mês passado',
        query: 'Luciano mês passado',
        description: 'Resumo e participações do mês anterior',
      },
      {
        id: 'client-date',
        label: 'Luciano 14/08',
        query: 'Luciano 14/08',
        description: 'Resumo e participações na data',
      },
      {
        id: 'client-price',
        label: 'Valor do balde Luciano',
        query: 'valor do balde Luciano',
        description: 'Preço unitário cadastrado',
      },
      {
        id: 'client-address',
        label: 'Endereço Luciano',
        query: 'endereço Luciano',
        description: 'Endereço cadastrado',
      },
    ],
  },
  {
    id: 'finance',
    title: 'Finanças',
    systemImage: 'chart.bar.fill',
    examples: [
      {
        id: 'finance-revenue',
        label: 'Faturamento agosto',
        query: 'faturamento agosto',
        description: 'Total faturado e base do cálculo',
      },
      {
        id: 'finance-yesterday',
        label: 'Faturamento ontem',
        query: 'faturamento ontem',
        description: 'Total faturado no dia anterior',
      },
      {
        id: 'finance-range',
        label: 'Faturamento 01/08 a 15/08',
        query: 'faturamento 01/08 a 15/08',
        description: 'Total faturado no intervalo de datas',
      },
      {
        id: 'finance-net-profit',
        label: 'Lucro líquido agosto',
        query: 'lucro líquido agosto',
        description: 'Lucro líquido e deduções',
      },
      {
        id: 'finance-buckets-sold',
        label: 'Baldes vendidos agosto',
        query: 'baldes vendidos agosto',
        description: 'Volume de baldes entregues',
      },
      {
        id: 'finance-received',
        label: 'Recebido agosto',
        query: 'recebido agosto',
        description: 'Valores recebidos no período',
      },
      {
        id: 'finance-receivable',
        label: 'A receber agosto',
        query: 'a receber agosto',
        description: 'Valores pendentes no período',
      },
    ],
  },
  {
    id: 'factory',
    title: 'Fábrica',
    systemImage: 'building.2.fill',
    examples: [
      {
        id: 'factory-purchases',
        label: 'Compras fábrica agosto',
        query: 'compras fábrica agosto',
        description: 'Compras e baldes adquiridos',
      },
      {
        id: 'factory-payments',
        label: 'Pagamentos fábrica agosto',
        query: 'pagamentos fábrica agosto',
        description: 'Pagamentos das compras do mês',
      },
      {
        id: 'factory-open',
        label: 'A pagar fábrica agosto',
        query: 'a pagar fábrica agosto',
        description: 'Saldo pendente da fábrica',
      },
    ],
  },
  {
    id: 'routes',
    title: 'Rotas e GPS',
    systemImage: 'map.fill',
    examples: [
      {
        id: 'route-today',
        label: 'Rota hoje',
        query: 'rota hoje',
        description: 'Sessão de rota do dia atual',
      },
      {
        id: 'route-date',
        label: 'Rota 14/08',
        query: 'rota 14/08',
        description: 'Horários, km e mapa do dia',
      },
      {
        id: 'route-month',
        label: 'Rota agosto',
        query: 'rota agosto',
        description: 'Carrossel com rotas do mês',
      },
      {
        id: 'route-km',
        label: 'Km agosto',
        query: 'km agosto',
        description: 'Quilometragem acumulada no mês',
      },
    ],
  },
  {
    id: 'car',
    title: 'Carro',
    systemImage: 'car.fill',
    examples: [
      {
        id: 'car-consumption',
        label: 'Consumo carro',
        query: 'consumo carro',
        description: 'Médias em km/l de gasolina e álcool',
      },
      {
        id: 'car-gasoline',
        label: 'Autonomia gasolina',
        query: 'autonomia gasolina',
        description: 'Média de km/l para gasolina',
      },
      {
        id: 'car-alcohol',
        label: 'Autonomia álcool',
        query: 'autonomia alcool',
        description: 'Média de km/l para álcool',
      },
    ],
  },
  {
    id: 'summaries',
    title: 'Resumos',
    systemImage: 'sparkles',
    examples: [
      {
        id: 'summary-today',
        label: 'Resumo hoje',
        query: 'resumo hoje',
        description: 'Finanças e operação do dia',
      },
      {
        id: 'summary-last-week',
        label: 'Resumo semana passada',
        query: 'resumo semana passada',
        description: 'Visão consolidada da semana anterior',
      },
      {
        id: 'summary-month',
        label: 'Resumo agosto',
        query: 'resumo agosto',
        description: 'Finanças e operação do mês',
      },
      {
        id: 'summary-date',
        label: 'Dados do dia 14/08',
        query: 'dados do dia 14/08',
        description: 'Visão unificada da data',
      },
    ],
  },
];
