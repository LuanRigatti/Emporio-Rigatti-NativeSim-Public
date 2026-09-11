import { getAvailableRouteDates } from '@/services/routes/routeDates';

describe('getAvailableRouteDates', () => {
  it('returns unique delivery dates from newest to oldest', () => {
    expect(
      getAvailableRouteDates([
        { data: '2026-07-10' },
        { data: '2026-07-25' },
        { data: '2026-07-10' },
        { data: '2026-06-30' },
      ]),
    ).toEqual(['2026-07-25', '2026-07-10', '2026-06-30']);
  });

  it('normalizes legacy dates and ignores invalid dates', () => {
    expect(
      getAvailableRouteDates([
        { data: '25/07/2026' },
        { data: '2026-07-24' },
        { data: 'data inválida' },
        { data: '' },
      ]),
    ).toEqual(['2026-07-25', '2026-07-24']);
  });
});
