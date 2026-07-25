import { createRouteKilometersExpense } from '@/services/expenses/routeKilometers';

describe('route kilometer persistence', () => {
  it('creates the daily expense payload for only the selected route date', () => {
    expect(createRouteKilometersExpense('2026-07-25', 12.3)).toEqual({
      data: '2026-07-25',
      km: 12.3,
    });
  });

  it('preserves the other daily expense fields when saving route kilometers', () => {
    expect(
      createRouteKilometersExpense('2026-07-25', 12.3, {
        data: '2026-07-25',
        estar: 10,
        gasolina: 20,
      }),
    ).toEqual({
      data: '2026-07-25',
      estar: 10,
      gasolina: 20,
      km: 12.3,
    });
  });
});
