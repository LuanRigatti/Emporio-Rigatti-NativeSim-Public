import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

import type { FinancialPeriodSelection } from '@/types/data';

function currentMonth(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}

function currentDate(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate(),
  ).padStart(2, '0')}`;
}

export interface FinancialPeriodContextValue {
  selection: FinancialPeriodSelection;
  setSelection: (selection: FinancialPeriodSelection) => void;
}

const FinancialPeriodContext = createContext<FinancialPeriodContextValue | undefined>(undefined);

export function FinancialPeriodProvider({ children }: PropsWithChildren) {
  const [selection, setSelection] = useState<FinancialPeriodSelection>({
    kind: 'month',
    month: currentMonth(),
  });
  const value = useMemo(() => ({ selection, setSelection }), [selection]);

  return (
    <FinancialPeriodContext.Provider value={value}>{children}</FinancialPeriodContext.Provider>
  );
}

export function useFinancialPeriod(): FinancialPeriodContextValue {
  const context = useContext(FinancialPeriodContext);
  if (!context) {
    throw new Error('useFinancialPeriod deve ser usado dentro de FinancialPeriodProvider.');
  }
  return context;
}

export function defaultFinancialPeriodSelection(): FinancialPeriodSelection {
  return { kind: 'month', month: currentMonth() };
}

export function todayFinancialPeriodSelection(): FinancialPeriodSelection {
  return { kind: 'day', date: currentDate() };
}
