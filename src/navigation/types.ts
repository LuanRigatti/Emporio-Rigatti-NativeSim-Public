import type { NavigatorScreenParams } from '@react-navigation/native';

import type {
  ClientId,
  FinancialChartGranularity,
  FinancialMetric,
  FinancialPeriodSelection,
  FinancialReportPeriod,
  HistoryFilters,
} from '@/types/data';

export type RootStackParamList = {
  Auth: undefined;
  MainTabs: NavigatorScreenParams<PremiumMainTabParamList> | undefined;
  Modal: undefined;
  DesignSystemShowcase: undefined;
  PremiumTabBarShowcase: undefined;
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

export type PremiumMainTabParamList = {
  Dashboard: undefined;
  Financeiro: undefined;
  Registrar: undefined;
  Historico: undefined;
};

export type FinanceMetric = FinancialMetric;

export type DashboardPeriod = 'day' | 'month';

export type DashboardStackParamList = {
  HomeDashboard: undefined;
  DashboardIndicatorDetails: { metric: FinanceMetric; period: DashboardPeriod };
  DashboardDeliveryRecords: { mode: 'recent' | 'pending'; period: DashboardPeriod };
};

export type FinanceStackParamList = {
  FinanceHome: undefined;
  FinancePeriodReport:
    { period?: FinancialReportPeriod; selection?: FinancialPeriodSelection } | undefined;
  FinanceIndicatorDetails: {
    metric: FinanceMetric;
    period: FinancialReportPeriod;
    periodLabel: string;
    selection?: FinancialPeriodSelection;
  };
  FinanceCharts:
    | {
        period?: FinancialReportPeriod;
        selection?: FinancialPeriodSelection;
        metric?: FinanceMetric;
        granularity?: FinancialChartGranularity;
      }
    | undefined;
  FinanceRanking:
    { period?: FinancialReportPeriod; selection?: FinancialPeriodSelection } | undefined;
  FinanceFactory: undefined;
  FinanceFactoryDetails: { receiptId?: string } | undefined;
  FinanceFactoryForm: undefined;
  ExpensesHome: undefined;
  ExpenseHistory: { selection?: FinancialPeriodSelection } | undefined;
  DailyExpenseForm: { date?: string } | undefined;
  MonthlyLight: { month?: string } | undefined;
  CostPeriod:
    | {
        period?: 'day' | 'week' | 'month' | 'all' | 'range';
        date?: string;
        month?: string;
        selection?: FinancialPeriodSelection;
      }
    | undefined;
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
  DeliveriesHome: undefined;
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
