import { formatCurrency } from '@/utils/data/formatters';

describe('formatCurrency', () => {
  it('preserves the existing BRL formatter output for finite and special values', () => {
    const values = [0, -0, 1234.56, -1234.56, Number.NaN, Number.POSITIVE_INFINITY];
    const expected = new Intl.NumberFormat('pt-BR', {
      currency: 'BRL',
      style: 'currency',
    });

    expect(values.map(formatCurrency)).toEqual(values.map((value) => expected.format(value)));
  });
});
