import {
  calculateScheduledMonthComparisonCutoffs,
  getScheduledRouteDatesInMonth,
  SCHEDULED_ROUTE_WEEKDAYS,
} from '@/services/finance/FinancialScheduledComparison';

describe('FinancialScheduledComparison', () => {
  describe('SCHEDULED_ROUTE_WEEKDAYS', () => {
    it('deve conter segunda (1), quarta (3) e sexta (5)', () => {
      expect(SCHEDULED_ROUTE_WEEKDAYS).toEqual([1, 3, 5]);
    });
  });

  describe('getScheduledRouteDatesInMonth', () => {
    it('deve listar corretamente os dias programados de Julho de 2026 (14 dias)', () => {
      const dates = getScheduledRouteDatesInMonth('2026-07');
      expect(dates).toEqual([
        '2026-07-01', // Quarta
        '2026-07-03', // Sexta
        '2026-07-06', // Segunda
        '2026-07-08', // Quarta
        '2026-07-10', // Sexta
        '2026-07-13', // Segunda
        '2026-07-15', // Quarta
        '2026-07-17', // Sexta
        '2026-07-20', // Segunda
        '2026-07-22', // Quarta
        '2026-07-24', // Sexta
        '2026-07-27', // Segunda
        '2026-07-29', // Quarta
        '2026-07-31', // Sexta
      ]);
      expect(dates).toHaveLength(14);
    });

    it('deve listar corretamente os dias programados de Agosto de 2026 (13 dias)', () => {
      const dates = getScheduledRouteDatesInMonth('2026-08');
      expect(dates).toEqual([
        '2026-08-03', // Segunda
        '2026-08-05', // Quarta
        '2026-08-07', // Sexta
        '2026-08-10', // Segunda
        '2026-08-12', // Quarta
        '2026-08-14', // Sexta
        '2026-08-17', // Segunda
        '2026-08-19', // Quarta
        '2026-08-21', // Sexta
        '2026-08-24', // Segunda
        '2026-08-26', // Quarta
        '2026-08-28', // Sexta
        '2026-08-31', // Segunda
      ]);
      expect(dates).toHaveLength(13);
    });

    it('deve listar corretamente os dias programados de Junho de 2026 (13 dias)', () => {
      const dates = getScheduledRouteDatesInMonth('2026-06');
      expect(dates).toHaveLength(13);
    });
  });

  describe('calculateScheduledMonthComparisonCutoffs', () => {
    it('deve cortar na sexta anterior quando hoje for domingo entre rotas no mês atual', () => {
      const today = new Date('2026-08-16T12:00:00'); // Domingo
      const cutoffs = calculateScheduledMonthComparisonCutoffs('2026-08', today);

      expect(cutoffs.n).toBe(6);
      expect(cutoffs.comparableN).toBe(6);
      expect(cutoffs.currentCutoff).toBe('2026-08-14'); // Sexta-feira anterior
      expect(cutoffs.previousCutoff).toBe('2026-07-13'); // 6º dia de Julho
    });

    it('deve retornar comparableN = 0 antes do primeiro dia programado do mês', () => {
      const today = new Date('2026-08-02T12:00:00'); // Domingo, antes de 03/08 (segunda)
      const cutoffs = calculateScheduledMonthComparisonCutoffs('2026-08', today);

      expect(cutoffs.n).toBe(0);
      expect(cutoffs.comparableN).toBe(0);
      expect(cutoffs.currentCutoff).toBeNull();
      expect(cutoffs.previousCutoff).toBeNull();
    });

    it('deve limitar pelo comparableN quando mês concluído tem 14 dias e o anterior tem 13', () => {
      // Julho/2026 (14 rotas) comparado com Junho/2026 (13 rotas), visto a partir de Setembro/2026
      const today = new Date('2026-09-01T12:00:00');
      const cutoffs = calculateScheduledMonthComparisonCutoffs('2026-07', today);

      expect(cutoffs.n).toBe(14);
      expect(cutoffs.comparableN).toBe(13); // min(14, 13)
      expect(cutoffs.currentCutoff).toBe('2026-07-29'); // 13º dia de Julho
      expect(cutoffs.previousCutoff).toBe('2026-06-29'); // 13º dia de Junho
    });

    it('deve limitar pelo comparableN quando mês concluído tem 13 dias e o anterior tem 14', () => {
      // Agosto/2026 (13 rotas) comparado com Julho/2026 (14 rotas), visto a partir de Setembro/2026
      const today = new Date('2026-09-01T12:00:00');
      const cutoffs = calculateScheduledMonthComparisonCutoffs('2026-08', today);

      expect(cutoffs.n).toBe(13);
      expect(cutoffs.comparableN).toBe(13); // min(13, 14)
      expect(cutoffs.currentCutoff).toBe('2026-08-31'); // 13º dia de Agosto
      expect(cutoffs.previousCutoff).toBe('2026-07-29'); // 13º dia de Julho
    });

    it('deve retornar comparableN = 0 para meses futuros', () => {
      const today = new Date('2026-08-16T12:00:00');
      const cutoffs = calculateScheduledMonthComparisonCutoffs('2026-09', today);

      expect(cutoffs.n).toBe(0);
      expect(cutoffs.comparableN).toBe(0);
      expect(cutoffs.currentCutoff).toBeNull();
      expect(cutoffs.previousCutoff).toBeNull();
    });
  });
});
