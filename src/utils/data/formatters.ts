let currencyFormatter: Intl.NumberFormat | undefined;

export function formatCurrency(value: number): string {
  currencyFormatter ??= new Intl.NumberFormat('pt-BR', { currency: 'BRL', style: 'currency' });
  return currencyFormatter.format(value);
}

export function maskFinancialValue(value: string, hidden: boolean): string {
  return hidden ? '••••' : value;
}
