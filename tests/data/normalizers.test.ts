import {
  formatClientName,
  normalizeClientAlias,
  normalizeClientKey,
  normalizeLegacyDate,
  normalizeMoney,
} from '@/utils/data';

describe('data normalizers', () => {
  it('normalizes legacy money formats without applying business calculations', () => {
    expect(normalizeMoney('R$ 1.234,56')).toBe(1234.56);
    expect(normalizeMoney('48,50')).toBe(48.5);
    expect(normalizeMoney('invalid')).toBeUndefined();
  });

  it('normalizes legacy dates without changing the source value', () => {
    expect(normalizeLegacyDate('20/03/2026')).toBe('2026-03-20');
    expect(normalizeLegacyDate('2026-03-20')).toBe('2026-03-20');
  });

  it('preserves the confirmed client aliases', () => {
    expect(normalizeClientAlias('Santos')).toBe('Elias');
    expect(normalizeClientAlias('Adri Guilherme')).toBe('Adri');
    expect(normalizeClientKey('Márcia')).toBe('marcia');
    expect(formatClientName('  márcia  ')).toBe('Márcia');
  });
});
