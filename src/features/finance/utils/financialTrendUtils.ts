export function formatTrendPercentage(percentual: number | undefined | null): string {
  if (
    percentual === undefined ||
    percentual === null ||
    Number.isNaN(percentual) ||
    !Number.isFinite(percentual)
  ) {
    return '0,0%';
  }
  const abs = Math.abs(percentual);
  return `${abs.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}
