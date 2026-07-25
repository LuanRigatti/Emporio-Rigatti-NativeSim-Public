import { createNativeStackNavigator } from '@react-navigation/native-stack';

import {
  CostCalculationDetails,
  CostPeriod,
  DailyExpenseForm,
  ExpenseHistory,
  ExpensesHome,
  MonthlyLight,
} from '@/screens/expenses';
import {
  FinanceChartsScreen,
  FinanceFactoryDetailsScreen,
  FinanceFactoryScreen,
  FactoryReceiptFormScreen,
  FinanceHomeScreen,
  FinanceIndicatorDetailsScreen,
  FinancePeriodReportScreen,
  FinanceRankingScreen,
} from '@/screens/finance';
import { FinancialPeriodProvider } from '@/providers';

import type { FinanceStackParamList } from './types';

const Stack = createNativeStackNavigator<FinanceStackParamList>();

export function FinanceNavigator() {
  return (
    <FinancialPeriodProvider>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen component={FinanceHomeScreen} name="FinanceHome" />
        <Stack.Screen component={FinancePeriodReportScreen} name="FinancePeriodReport" />
        <Stack.Screen component={FinanceIndicatorDetailsScreen} name="FinanceIndicatorDetails" />
        <Stack.Screen component={FinanceChartsScreen} name="FinanceCharts" />
        <Stack.Screen component={FinanceRankingScreen} name="FinanceRanking" />
        <Stack.Screen component={FinanceFactoryScreen} name="FinanceFactory" />
        <Stack.Screen component={FinanceFactoryDetailsScreen} name="FinanceFactoryDetails" />
        <Stack.Screen
          component={FactoryReceiptFormScreen}
          name="FinanceFactoryForm"
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen component={ExpensesHome} name="ExpensesHome" />
        <Stack.Screen component={ExpenseHistory} name="ExpenseHistory" />
        <Stack.Screen
          component={DailyExpenseForm}
          name="DailyExpenseForm"
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          component={MonthlyLight}
          name="MonthlyLight"
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen component={CostPeriod} name="CostPeriod" />
        <Stack.Screen
          component={CostCalculationDetails}
          name="CostCalculationDetails"
          options={{ presentation: 'modal' }}
        />
      </Stack.Navigator>
    </FinancialPeriodProvider>
  );
}
