export type DeliveryStatus = 'concluída' | 'pendente';

export type HistoryDelivery = {
  id: string;
  cliente: string;
  data: string;
  status: DeliveryStatus;
  quantidadeBaldes: number;
  valor: string;
  precoUnitarioHistorico?: number;
  formaPagamento: string;
  bairro: string;
  observacoes: string;
};

export type HistoryCalendarDay = {
  date: string;
  weekday: string;
  dayNumber: string;
};

export const historyMockDeliveries: readonly HistoryDelivery[] = [];
