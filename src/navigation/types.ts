import type { NavigatorScreenParams } from '@react-navigation/native';

import type { ClientId, HistoryFilters } from '@/types/data';

export type RootStackParamList = {
  Auth: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Modal: undefined;
  DesignSystemShowcase: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
};

export type MoreStackParamList = {
  MoreHome: undefined;
  History: HistoryFilters | undefined;
  HistoryRanking: HistoryFilters | undefined;
  MoreSettings: undefined;
  MoreBackup: undefined;
  MoreNotifications: undefined;
};

export type MainTabParamList = {
  Dashboard: NavigatorScreenParams<DashboardStackParamList>;
  Financeiro: NavigatorScreenParams<FinanceStackParamList>;
  Clientes: NavigatorScreenParams<ClientsStackParamList>;
  Entregas: NavigatorScreenParams<DeliveriesStackParamList>;
  Mais: NavigatorScreenParams<MoreStackParamList>;
};

export type FinanceMetric =
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

export type DashboardPeriod = 'day' | 'month';

export type DashboardStackParamList = {
  HomeDashboard: undefined;
  DashboardIndicatorDetails: { metric: FinanceMetric; period: DashboardPeriod };
  DashboardDeliveryRecords: { mode: 'recent' | 'pending'; period: DashboardPeriod };
};

export type FinanceStackParamList = {
  FinanceHome: undefined;
  FinancePeriodReport: { period?: 'day' | 'month' | 'all' } | undefined;
  FinanceIndicatorDetails: {
    metric: FinanceMetric;
    period: 'day' | 'month' | 'all';
    periodLabel: string;
  };
  FinanceCharts: { period?: 'month' | 'all' } | undefined;
  FinanceRanking: { period?: 'month' | 'all' } | undefined;
  FinanceFactory: undefined;
  FinanceFactoryDetails: { receiptId?: string } | undefined;
  FinanceFactoryForm: undefined;
  ExpensesHome: undefined;
  ExpenseHistory: undefined;
  DailyExpenseForm: { date?: string } | undefined;
  MonthlyLight: { month?: string } | undefined;
  CostPeriod:
    { period?: 'day' | 'week' | 'month' | 'all'; date?: string; month?: string } | undefined;
  CostCalculationDetails: {
    metric: 'estar' | 'combustivel' | 'luz' | 'total' | 'mediaCombustivel';
    periodLabel: string;
  };
};

export type ClientsStackParamList = {
  ClientsHome: undefined;
  ClientDetails: { clientId: ClientId; clientName: string };
  ClientForm: { mode: 'create' | 'edit'; clientId?: ClientId; clientName?: string };
  ClientRenameReview: { clientId: ClientId; clientName: string };
  ClientDeleteReview: { clientId: ClientId; clientName: string };
  ClientDeliveries: { clientId: ClientId; clientName: string };
  ClientPayments: { clientId: ClientId; clientName: string; onlyPending?: boolean };
};

export type DeliveriesStackParamList = {
  DeliveriesHome:
    | {
        mode?: 'today' | 'all';
        date?: string;
        clientName?: string;
        status?: 'Todos' | 'Pago' | 'Não Pago';
      }
    | undefined;
  DeliveryDetails: { deliveryId: string };
  NewDelivery: { date?: string; clientName?: string } | undefined;
  EditDelivery: { deliveryId: string };
  DeliveryBulkEdit: { deliveryIds: string[] };
  DeliverySettlement: { deliveryIds: string[] };
  RouteDay: { date?: string; source?: 'deliveries' | 'dashboard' | 'more' } | undefined;
  RouteMap: { sessionId: string };
  RouteAddressCorrection: {
    sessionId: string;
    deliveryId?: string;
    address: string;
    returnTo: 'route' | 'delivery';
  };
};
