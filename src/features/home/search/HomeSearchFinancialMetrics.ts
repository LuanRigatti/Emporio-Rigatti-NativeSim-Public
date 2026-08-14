import type { FinancialSummary } from '@/types/data';

import type {
  HomeSearchFinancialClientScope,
  HomeSearchFinancialMetric,
  HomeSearchFinancialUnit,
} from './HomeSearchTypes';

type FinancialMetricDefinition = {
  aliases: readonly string[];
  clientScope: HomeSearchFinancialClientScope;
  label: string;
  metric: HomeSearchFinancialMetric;
  requiresCosts: boolean;
  unit: HomeSearchFinancialUnit;
};

const DEFINITIONS: readonly FinancialMetricDefinition[] = [
  {
    aliases: ['custo medio de entrega', 'custo medio entrega'],
    clientScope: 'unsupported',
    label: 'Custo médio de entrega',
    metric: 'averageDeliveryCost',
    requiresCosts: true,
    unit: 'currency',
  },
  {
    aliases: ['lucro liquido por balde', 'lucro por balde'],
    clientScope: 'unsupported',
    label: 'Lucro por balde',
    metric: 'profitPerBucket',
    requiresCosts: true,
    unit: 'currency',
  },
  {
    aliases: ['preco medio por balde', 'venda por balde'],
    clientScope: 'direct',
    label: 'Venda por balde',
    metric: 'salePerBucket',
    requiresCosts: false,
    unit: 'currency',
  },
  {
    aliases: ['custo medio por balde', 'custo por balde'],
    clientScope: 'unsupported',
    label: 'Custo por balde',
    metric: 'costPerBucket',
    requiresCosts: true,
    unit: 'currency',
  },
  {
    aliases: ['quantidade de baldes vendidos', 'baldes vendidos'],
    clientScope: 'direct',
    label: 'Baldes vendidos',
    metric: 'bucketsSold',
    requiresCosts: false,
    unit: 'count',
  },
  {
    aliases: ['custo dos baldes', 'custo de baldes'],
    clientScope: 'direct',
    label: 'Custo dos baldes',
    metric: 'bucketCost',
    requiresCosts: false,
    unit: 'currency',
  },
  {
    aliases: ['custo combustivel', 'combustivel'],
    clientScope: 'allocated',
    label: 'Custo combustível',
    metric: 'fuelCost',
    requiresCosts: true,
    unit: 'currency',
  },
  {
    aliases: ['outros custos', 'custo outros', 'outros'],
    clientScope: 'unsupported',
    label: 'Outros custos',
    metric: 'otherCosts',
    requiresCosts: true,
    unit: 'currency',
  },
  {
    aliases: ['luz do periodo', 'custo de luz', 'custo luz', 'luz'],
    clientScope: 'allocated',
    label: 'Luz do período',
    metric: 'electricityCost',
    requiresCosts: true,
    unit: 'currency',
  },
  {
    aliases: ['margem liquida'],
    clientScope: 'unsupported',
    label: 'Margem líquida',
    metric: 'netMargin',
    requiresCosts: true,
    unit: 'percentage',
  },
  {
    aliases: ['margem bruta'],
    clientScope: 'direct',
    label: 'Margem bruta',
    metric: 'grossMargin',
    requiresCosts: false,
    unit: 'percentage',
  },
  {
    aliases: ['lucro liquido'],
    clientScope: 'unsupported',
    label: 'Lucro líquido',
    metric: 'netProfit',
    requiresCosts: true,
    unit: 'currency',
  },
  {
    aliases: ['lucro bruto'],
    clientScope: 'direct',
    label: 'Lucro bruto',
    metric: 'grossProfit',
    requiresCosts: false,
    unit: 'currency',
  },
  {
    aliases: ['valor a receber', 'valores pendentes', 'a receber'],
    clientScope: 'direct',
    label: 'A receber',
    metric: 'receivable',
    requiresCosts: false,
    unit: 'currency',
  },
  {
    aliases: ['valores pagos', 'recebido'],
    clientScope: 'direct',
    label: 'Recebido',
    metric: 'received',
    requiresCosts: false,
    unit: 'currency',
  },
  {
    aliases: ['total vendido', 'faturamento'],
    clientScope: 'direct',
    label: 'Faturamento',
    metric: 'revenue',
    requiresCosts: false,
    unit: 'currency',
  },
  {
    aliases: ['lucro'],
    clientScope: 'unsupported',
    label: 'Lucro líquido',
    metric: 'netProfit',
    requiresCosts: true,
    unit: 'currency',
  },
];

const ALIASES = DEFINITIONS.flatMap((definition) =>
  definition.aliases.map((alias) => ({ alias, definition })),
).sort((left, right) => right.alias.length - left.alias.length);

export type HomeSearchFinancialMetricMatch = {
  alias: string;
  definition: FinancialMetricDefinition;
};

export function matchHomeSearchFinancialMetric(
  normalized: string,
): HomeSearchFinancialMetricMatch | undefined {
  return ALIASES.find(({ alias }) => {
    const index = normalized.indexOf(alias);
    if (index < 0) return false;
    const before = normalized[index - 1];
    const after = normalized[index + alias.length];
    return (!before || before === ' ') && (!after || after === ' ');
  });
}

export function homeSearchFinancialMetricDefinition(
  metric: HomeSearchFinancialMetric,
): FinancialMetricDefinition {
  const definition = DEFINITIONS.find((candidate) => candidate.metric === metric);
  if (!definition) throw new Error(`Métrica financeira desconhecida: ${metric}`);
  return definition;
}

export function homeSearchFinancialMetricValue(
  summary: FinancialSummary,
  metric: HomeSearchFinancialMetric,
): number {
  switch (metric) {
    case 'bucketsSold':
      return summary.quantidadeBaldes;
    case 'revenue':
      return summary.faturamento;
    case 'grossProfit':
      return summary.lucroBruto;
    case 'netProfit':
      return summary.lucroLiquido;
    case 'received':
      return summary.valoresPagos;
    case 'receivable':
      return summary.valoresPendentes;
    case 'bucketCost':
      return summary.custoTotalBaldes;
    case 'fuelCost':
      return summary.custoCombustivel;
    case 'otherCosts':
      return summary.custoOutros;
    case 'electricityCost':
      return summary.custoLuz;
    case 'averageDeliveryCost':
      return summary.custoMedioCombustivelPorEntrega;
    case 'grossMargin':
      return summary.margemBruta;
    case 'netMargin':
      return summary.margemLiquida;
    case 'salePerBucket':
      return summary.precoMedioBalde;
    case 'profitPerBucket':
      return summary.lucroLiquidoPorBalde;
    case 'costPerBucket':
      return summary.custoMedioBalde;
  }
}
