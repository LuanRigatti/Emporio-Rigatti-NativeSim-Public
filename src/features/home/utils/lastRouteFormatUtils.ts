export function formatRouteDateLabel(dateIso: string): string {
  const [year, month, day] = dateIso.split('-').map(Number);
  if (!year || !month || !day) return dateIso;

  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
}

export function formatRouteDistanceLabel(meters: number): string {
  return `${(meters / 1000).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} km`;
}
