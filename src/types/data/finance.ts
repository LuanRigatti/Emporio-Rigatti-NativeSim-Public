export interface FinancialSummary {
  faturamento: number;
  valoresPagos: number;
  valoresPendentes: number;
  quantidadeBaldes: number;
  custoTotalBaldes: number;
  custoCombustivel: number;
  custoEstar: number;
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

export interface FinancialCalculationFilters {
  periodo: FinancialPeriod;
  mesSelecionado?: string;
  diaSelecionado?: string;
  dataFiltro?: string;
  dataInicioSelecionada?: string;
  dataFimSelecionada?: string;
  buscaCliente?: string;
  status?: string;
}

export interface FinancialCalculationInput {
  deliveries: import('./delivery').Delivery[];
  dailyExpenses: import('./expenses').DailyExpenses;
  monthlyExpenses: import('./expenses').MonthlyExpenses;
  filters: FinancialCalculationFilters;
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
