import { formatCurrency } from '@/utils/data';
import { useTestMode } from '@/hooks/useTestMode';
import { useMemo } from 'react';

export function maskCurrency(value: number, enabled: boolean): string {
  return formatCurrency(enabled ? 0 : value);
}

export function maskQuantity(
  value: number,
  enabled: boolean,
  singular = 'balde',
  plural = 'baldes',
): string {
  if (enabled) return `0 ${plural}`;
  return `${value} ${value === 1 ? singular : plural}`;
}

export function maskDistance(value: number, enabled: boolean): string {
  return `${enabled ? 0 : value} km`;
}

export function maskPercentage(value: number, enabled: boolean, fractionDigits = 0): string {
  if (enabled) return '0%';
  return `${value.toFixed(fractionDigits).replace('.', ',')}%`;
}

export function maskNumber(value: number | string, enabled: boolean): string {
  return enabled ? '0' : String(value);
}

export function maskNumericInput(value: string | undefined, enabled: boolean): string | undefined {
  if (!enabled || value === undefined || value.trim() === '') return value;
  if (value.includes('R$')) return 'R$ 0,00';
  if (/[,.]/.test(value)) return '0,00';
  return '0';
}

export function maskPresentationText(value: string, enabled: boolean): string {
  if (!enabled || !value) return value;

  return value
    .replace(/R\$\s*[-\d.,]+/g, 'R$ 0,00')
    .replace(
      /[-\d.,]+\s*(km\/l|km|baldes?|entregas?|pagamentos?|compras?|pontos?|bytes?|documentos?)/gi,
      '0 $1',
    )
    .replace(/[-\d.,]+\s*%/g, '0%')
    .replace(/^[-\d.,]+$/, '0');
}

export function useTestModePresentation() {
  const { enabled } = useTestMode();
  return useMemo(
    () => ({
      enabled,
      currency: (value: number) => maskCurrency(value, enabled),
      distance: (value: number) => maskDistance(value, enabled),
      input: (value: string | undefined) => maskNumericInput(value, enabled),
      number: (value: number | string) => maskNumber(value, enabled),
      percentage: (value: number, fractionDigits = 0) =>
        maskPercentage(value, enabled, fractionDigits),
      quantity: (value: number, singular = 'balde', plural = 'baldes') =>
        maskQuantity(value, enabled, singular, plural),
      text: (value: string) => maskPresentationText(value, enabled),
    }),
    [enabled],
  );
}
