export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { currency: 'BRL', style: 'currency' }).format(value);
}

export function maskFinancialValue(value: string, hidden: boolean): string {
  return hidden ? '••••' : value;
}
