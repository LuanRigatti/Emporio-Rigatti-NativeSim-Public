export function roundRetailOrderMoney(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Valor monetário inválido.');
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function moneyToCents(value: number): number {
  return Math.round(roundRetailOrderMoney(value) * 100);
}

export function centsToMoney(value: number): number {
  if (!Number.isSafeInteger(value)) throw new Error('Valor monetário fora do limite seguro.');
  return value / 100;
}

export function allocateDiscountCents(
  lineSubtotalsCents: readonly number[],
  discountCents: number,
): number[] {
  if (!Number.isSafeInteger(discountCents) || discountCents < 0) {
    throw new Error('Desconto inválido.');
  }
  const subtotalCents = lineSubtotalsCents.reduce((total, value) => total + value, 0);
  if (discountCents > subtotalCents) throw new Error('O desconto não pode superar o subtotal.');
  if (discountCents === 0) return lineSubtotalsCents.map(() => 0);
  if (subtotalCents === 0) throw new Error('Não é possível aplicar desconto a subtotal zero.');

  const allocations = lineSubtotalsCents.map((lineSubtotalCents, index) => {
    const numerator = discountCents * lineSubtotalCents;
    return {
      cents: Math.floor(numerator / subtotalCents),
      fraction: numerator % subtotalCents,
      index,
    };
  });
  let remaining = discountCents - allocations.reduce((total, item) => total + item.cents, 0);
  allocations
    .slice()
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index)
    .forEach((item) => {
      if (remaining <= 0) return;
      allocations[item.index]!.cents += 1;
      remaining -= 1;
    });
  return allocations.map((item) => item.cents);
}

export function optionalRetailOrderText(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}
