import {
  formatMonthlyPeriodKey,
  parseMonthlyPeriodParam,
} from '@/features/finance/utils/monthlyPeriodUtils';

describe('MonthlyFinancialPeriodParsing', () => {
  const customFallback = { month: 8, year: 2026 };

  describe('parseMonthlyPeriodParam', () => {
    it('deve extrair ano e mês de uma string YYYY-MM válida', () => {
      expect(parseMonthlyPeriodParam('2026-07', customFallback)).toEqual({
        year: 2026,
        month: 7,
      });
      expect(parseMonthlyPeriodParam('2026-08', customFallback)).toEqual({
        year: 2026,
        month: 8,
      });
      expect(parseMonthlyPeriodParam('2025-01', customFallback)).toEqual({
        year: 2025,
        month: 1,
      });
      expect(parseMonthlyPeriodParam('2025-12', customFallback)).toEqual({
        year: 2025,
        month: 12,
      });
    });

    it('deve lidar com array vindo do useLocalSearchParams do expo-router', () => {
      expect(parseMonthlyPeriodParam(['2026-07'], customFallback)).toEqual({
        year: 2026,
        month: 7,
      });
      expect(parseMonthlyPeriodParam(['2026-03', '2026-04'], customFallback)).toEqual({
        year: 2026,
        month: 3,
      });
    });

    it('deve ignorar espaços em branco ao redor', () => {
      expect(parseMonthlyPeriodParam('  2026-07  ', customFallback)).toEqual({
        year: 2026,
        month: 7,
      });
    });

    it('deve retornar fallback quando o parâmetro for ausente, nulo ou vazio', () => {
      expect(parseMonthlyPeriodParam(undefined, customFallback)).toEqual(customFallback);
      expect(parseMonthlyPeriodParam(null, customFallback)).toEqual(customFallback);
      expect(parseMonthlyPeriodParam('', customFallback)).toEqual(customFallback);
      expect(parseMonthlyPeriodParam('   ', customFallback)).toEqual(customFallback);
      expect(parseMonthlyPeriodParam([], customFallback)).toEqual(customFallback);
    });

    it('deve retornar fallback quando o formato for inválido', () => {
      expect(parseMonthlyPeriodParam('2026-7', customFallback)).toEqual(customFallback);
      expect(parseMonthlyPeriodParam('2026/07', customFallback)).toEqual(customFallback);
      expect(parseMonthlyPeriodParam('07-2026', customFallback)).toEqual(customFallback);
      expect(parseMonthlyPeriodParam('julho-2026', customFallback)).toEqual(customFallback);
      expect(parseMonthlyPeriodParam('invalid', customFallback)).toEqual(customFallback);
    });

    it('deve retornar fallback quando mês estiver fora do intervalo 1..12', () => {
      expect(parseMonthlyPeriodParam('2026-00', customFallback)).toEqual(customFallback);
      expect(parseMonthlyPeriodParam('2026-13', customFallback)).toEqual(customFallback);
      expect(parseMonthlyPeriodParam('2026-99', customFallback)).toEqual(customFallback);
    });

    it('deve retornar fallback quando ano estiver fora do intervalo seguro 2000..2100', () => {
      expect(parseMonthlyPeriodParam('1999-07', customFallback)).toEqual(customFallback);
      expect(parseMonthlyPeriodParam('2101-07', customFallback)).toEqual(customFallback);
    });
  });

  describe('formatMonthlyPeriodKey', () => {
    it('deve formatar ano e mês corretamente no padrão YYYY-MM', () => {
      expect(formatMonthlyPeriodKey(2026, 7)).toBe('2026-07');
      expect(formatMonthlyPeriodKey(2026, 12)).toBe('2026-12');
      expect(formatMonthlyPeriodKey(2025, 1)).toBe('2025-01');
    });
  });
});
