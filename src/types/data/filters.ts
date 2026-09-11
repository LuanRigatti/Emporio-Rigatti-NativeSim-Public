export type PeriodFilter = 'todos' | 'mes' | 'dia' | 'semana' | 'range';

export interface Filters {
  periodo: PeriodFilter;
  mesSelecionado?: string;
  diaSelecionado?: string;
  dataFiltro?: string;
  dataInicioSelecionada?: string;
  dataFimSelecionada?: string;
  buscaCliente?: string;
  status?: string;
}
