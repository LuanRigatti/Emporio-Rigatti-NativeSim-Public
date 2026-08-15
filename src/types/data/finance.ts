export interface FinancialSummary {
  faturamento: number;
  valoresPagos: number;
  valoresPendentes: number;
  quantidadeBaldes: number;
  custoTotalBaldes: number;
  custoCombustivel: number;
  custoEstar: number;
  custoOutros: number;
  custoLuz: number;
  custoTotal: number;
  lucroBruto: number;
  lucroLiquido: number;
  margemBruta: number;
  margemLiquida: number;
  custoMedioBalde: number;
  precoMedioBalde: number;
  lucroLiquidoPorBalde: number;
  quantidadeEntregas: number;
  custoMedioCombustivelPorEntrega: number;
}

export type FinancialPeriod = 'todos' | 'mes' | 'dia' | 'semana' | 'range';

export type FinancialReportPeriod = 'day' | 'week' | 'month' | 'year' | 'all' | 'range';

export type FinancialPeriodSelection =
  | { kind: 'day'; date: string }
  | { kind: 'week'; date: string }
  | { kind: 'month'; month: string }
  | { kind: 'year'; year: string }
  | { kind: 'all' }
  | { kind: 'range'; start: string; end: string };

export type FinancialChartGranularity = 'day' | 'week' | 'month' | 'year';

export type FinancialMetric =
  | 'faturamento'
  | 'pago'
  | 'pendente'
  | 'lucroBruto'
  | 'lucroLiquido'
  | 'custos'
  | 'margemBruta'
  | 'margemLiquida'
  | 'quantidade'
  | 'precoMedio'
  | 'custoMedio';

export interface FinancialSeriesPoint {
  key: string;
  label: string;
  value: number;
}

export interface FinancialCalculationFilters {
  periodo: FinancialPeriod;
  mesSelecionado?: string;
  diaSelecionado?: string;
  dataFiltro?: string;
  dataInicioSelecionada?: string;
  dataFimSelecionada?: string;
  buscaCliente?: string;
  clientId?: import('./client').ClientId;
  status?: string;
}

export interface FinancialCalculationInput {
  deliveries: import('./delivery').Delivery[];
  dailyExpenses: import('./expenses').DailyExpenses;
  monthlyExpenses: import('./expenses').MonthlyExpenses;
  filters: FinancialCalculationFilters;
  /** Kilometers recorded by local route tracking, grouped by calendar date. */
  automaticKilometersByDate?: Readonly<Record<string, number>>;
  today?: Date;
  fullLightInterval?: boolean;
}

export interface ClientFinancialRankingItem {
  nome: string;
  valor: number;
  quantidade: number;
  entregas: number;
  percentual: number;
}

export interface FinancialComparison {
  atual: number;
  anterior: number;
  diferenca: number;
  percentual: number;
  subiu: boolean;
}

export interface FinancialComparisonResult {
  inicioAtual: string;
  fimAtual: string;
  inicioAnterior: string;
  fimAnterior: string;
  diasTrabalhados: number;
  faturamento: FinancialComparison;
  quantidadeEntregas: FinancialComparison;
  lucroLiquido: FinancialComparison;
}

export interface FinancialDeliveryDayComparison {
  currentDeliveryDays: number;
  previousDeliveryDays: number;
  faturamento: FinancialComparison;
  lucroLiquido: FinancialComparison;
}
